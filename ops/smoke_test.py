"""Y19 · Production smoke test, run by .github/workflows/deploy-prod.yml after every deploy.

Checks, in order:
  1. demo bin            the demo bin exists, is flagged is_demo and is active. Anything else
                         stops the test: it never sends a scan from a real bin.
  2. signed scan         mints a fresh one-time QR code for a demo product (issue_demo_qr),
                         signs the next record with the demo bin's key exactly as a bin would,
                         and sends it to the real ingest Edge Function; expects `accepted`.
                         Demo scans are excluded from every company and national total.
  3. latest checkpoint   at least one nightly checkpoint exists (skipped with --first-deploy,
                         because the first one appears at 00:05 IST after deploying).
  4. verify endpoint     the public verify_report function answers without a server error.
  5. website             only when WEB_URL is set: / and /simulator load.

Environment (names only; values are secrets):
  SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, DEMO_BIN_PRIVATE_KEY
  optional: DEMO_BIN_ID (default VB-PUN-9999-DEMO), INGEST_URL, WEB_URL

Run:  PYTHONPATH=simulator:ops python ops/smoke_test.py [--first-deploy]
Exit code 1 if any check fails.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

import requests
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from veribin_sim.keys import load_private_key_b64
from veribin_sim.record import build_record, sign_record

ZERO_UUID = "00000000-0000-0000-0000-000000000000"


class Api(Protocol):
    def get(self, path: str, service: bool = False) -> tuple[int, Any]: ...
    def post(self, path: str, body: dict, service: bool = False) -> tuple[int, Any]: ...
    def ingest(self, record: str, signature: str) -> tuple[int, dict]: ...
    def web(self, path: str) -> int: ...


@dataclass
class Config:
    bin_id: str
    key: Ed25519PrivateKey
    first_deploy: bool = False
    web_url: str | None = None


@dataclass
class Result:
    name: str
    status: str  # PASS | FAIL | SKIP
    detail: str = ""


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _signed_scan(api: Api, cfg: Config, demo_bin: dict) -> Result:
    name = "signed scan accepted"
    status, products = api.get(
        f"products?company_id=eq.{demo_bin['company_id']}&approved=eq.true"
        "&select=id,product_code,unit_weight_g&order=product_code.desc&limit=1",
        service=True,
    )
    if status != 200 or not products:
        return Result(name, "FAIL", "no approved demo product")
    product = products[0]
    status, minted = api.post(
        "rpc/issue_demo_qr", {"p_product_id": product["id"], "p_quantity": 1}, service=True
    )
    if status != 200 or not minted:
        return Result(name, "FAIL", f"could not mint a demo QR code (HTTP {status})")
    code = minted[0]["qr_payload"]

    sequence = int(demo_bin["last_sequence"])
    for attempt in range(2):
        record = build_record(
            cfg.bin_id, sequence + 1, _now(), "qr", code, int(product["unit_weight_g"])
        )
        _, reply = api.ingest(record, sign_record(cfg.key, record))
        if reply.get("status") == "accepted":
            return Result(name, "PASS", f"scan {reply.get('scan_id')}")
        if reply.get("reason") == "duplicate_sequence" and attempt == 0:
            # another demo deposit took that number at the same moment; read the bin again
            _, rows = api.get(f"bins?id=eq.{cfg.bin_id}&select=last_sequence", service=True)
            sequence = max(sequence + 1, int(rows[0]["last_sequence"])) if rows else sequence + 1
            continue
        return Result(name, "FAIL", f"rejected: {reply.get('reason', reply)}")
    return Result(name, "FAIL", "rejected twice: duplicate_sequence")


def run(api: Api, cfg: Config) -> list[Result]:
    results: list[Result] = []

    status, rows = api.get(
        f"bins?id=eq.{cfg.bin_id}&select=id,is_demo,status,last_sequence,company_id", service=True
    )
    demo_bin = rows[0] if status == 200 and rows else None
    if not demo_bin:
        results.append(Result("demo bin", "FAIL", f"{cfg.bin_id} not found (was the seed pushed?)"))
    elif not demo_bin.get("is_demo"):
        results.append(
            Result(
                "demo bin", "FAIL", f"{cfg.bin_id} is not flagged is_demo; refusing to send a scan"
            )
        )
    elif demo_bin.get("status") != "active":
        results.append(Result("demo bin", "FAIL", f"{cfg.bin_id} is {demo_bin.get('status')}"))
    else:
        results.append(Result("demo bin", "PASS", cfg.bin_id))
        results.append(_signed_scan(api, cfg, demo_bin))

    status, rows = api.get("checkpoints?select=day&order=day.desc&limit=1")
    if status == 200 and rows:
        results.append(Result("latest checkpoint", "PASS", rows[0]["day"]))
    elif cfg.first_deploy:
        results.append(
            Result(
                "latest checkpoint",
                "SKIP",
                "first deploy: the first checkpoint is made at 00:05 IST",
            )
        )
    else:
        results.append(Result("latest checkpoint", "FAIL", f"none found (HTTP {status})"))

    status, _ = api.post("rpc/verify_report", {"p_report_id": ZERO_UUID})
    results.append(Result("verify endpoint", "PASS" if status < 500 else "FAIL", f"HTTP {status}"))

    if cfg.web_url:
        codes = {path: api.web(path) for path in ("/", "/simulator")}
        bad = {p: c for p, c in codes.items() if c != 200}
        results.append(
            Result(
                "website",
                "FAIL" if bad else "PASS",
                ", ".join(f"{p} {c}" for p, c in codes.items()),
            )
        )
    return results


def exit_code(results: list[Result]) -> int:
    return 1 if any(r.status == "FAIL" for r in results) else 0


class HttpApi:
    """PostgREST + the ingest Edge Function over HTTPS."""

    def __init__(
        self, url: str, publishable: str, service: str, ingest_url: str, web_url: str | None
    ):
        self.rest = f"{url.rstrip('/')}/rest/v1/"
        self.keys = {False: publishable, True: service}
        self.ingest_url = ingest_url
        self.web_url = (web_url or "").rstrip("/")
        self.http = requests.Session()

    def _headers(self, service: bool) -> dict:
        key = self.keys[service]
        return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    @staticmethod
    def _json(res: requests.Response) -> Any:
        try:
            return res.json()
        except ValueError:
            return {}

    def get(self, path: str, service: bool = False) -> tuple[int, Any]:
        res = self.http.get(self.rest + path, headers=self._headers(service), timeout=20)
        return res.status_code, self._json(res)

    def post(self, path: str, body: dict, service: bool = False) -> tuple[int, Any]:
        res = self.http.post(
            self.rest + path, json=body, headers=self._headers(service), timeout=20
        )
        return res.status_code, self._json(res)

    def ingest(self, record: str, signature: str) -> tuple[int, dict]:
        res = self.http.post(
            self.ingest_url, json={"record": record, "signature": signature}, timeout=30
        )
        return res.status_code, self._json(res)

    def web(self, path: str) -> int:
        return self.http.get(self.web_url + path, timeout=30).status_code


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="VeriBin production smoke test (demo bin only)")
    parser.add_argument(
        "--first-deploy",
        action="store_true",
        help="skip the checkpoint check on the very first deploy",
    )
    args = parser.parse_args(argv)

    need = [
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "DEMO_BIN_PRIVATE_KEY",
    ]
    missing = [n for n in need if not os.getenv(n)]
    if missing:
        print(f"Missing environment variables: {', '.join(missing)}", file=sys.stderr)
        return 2
    url = os.environ["SUPABASE_URL"]
    api = HttpApi(
        url,
        os.environ["SUPABASE_PUBLISHABLE_KEY"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        os.getenv("INGEST_URL") or f"{url.rstrip('/')}/functions/v1/ingest",
        os.getenv("WEB_URL"),
    )
    cfg = Config(
        bin_id=os.getenv("DEMO_BIN_ID") or "VB-PUN-9999-DEMO",
        key=load_private_key_b64(os.environ["DEMO_BIN_PRIVATE_KEY"]),
        first_deploy=args.first_deploy,
        web_url=os.getenv("WEB_URL"),
    )
    results = run(api, cfg)
    for r in results:
        print(f"{r.status:4}  {r.name}: {r.detail}")
    return exit_code(results)


if __name__ == "__main__":
    sys.exit(main())
