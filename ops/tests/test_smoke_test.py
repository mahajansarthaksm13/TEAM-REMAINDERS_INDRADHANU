"""Unit tests for ops/smoke_test.py (Y19). No network: a fake API stands in for Supabase."""

from __future__ import annotations

from smoke_test import Config, exit_code, run
from veribin_sim.keys import generate_keypair
from veribin_sim.record import verify_record

DEMO = "VB-PUN-9999-DEMO"
CODE = "VBQ1.P9999." + "a" * 32


class FakeApi:
    """Answers like PostgREST / the ingest Edge Function would."""

    def __init__(
        self, *, is_demo=True, checkpoints=1, verify_status=404, ingest=None, web_status=200
    ):
        self.bin = {
            "id": DEMO,
            "is_demo": is_demo,
            "status": "active",
            "last_sequence": 41,
            "company_id": "d0000000-0000-4000-8000-00000000de00",
        }
        self.checkpoints = checkpoints
        self.verify_status = verify_status
        self.ingest_replies = list(
            ingest or [{"status": "accepted", "scan_id": "s1", "chain_hash": "c" * 64}]
        )
        self.web_status = web_status
        self.sent: list[tuple[str, str]] = []
        self.calls: list[str] = []

    def get(self, path, service=False):
        self.calls.append(path)
        if path.startswith("bins?"):
            return 200, [self.bin]
        if path.startswith("products?"):
            return 200, [{"id": "p1", "product_code": "P9999", "unit_weight_g": 24}]
        if path.startswith("checkpoints?"):
            return 200, [{"day": "2026-11-08"}] * self.checkpoints
        return 404, {}

    def post(self, path, body, service=False):
        self.calls.append(path)
        if path == "rpc/issue_demo_qr":
            return 200, [{"qr_payload": CODE}]
        if path == "rpc/verify_report":
            return self.verify_status, {"message": "report not found"}
        return 404, {}

    def ingest(self, record, signature):
        self.sent.append((record, signature))
        return 200, self.ingest_replies.pop(0)

    def web(self, path):
        return self.web_status


def config(**kw):
    key, public = generate_keypair()
    return Config(
        bin_id=DEMO, key=key, first_deploy=kw.get("first_deploy", False), web_url=kw.get("web_url")
    ), public


def by_name(results):
    return {r.name: r for r in results}


def test_all_checks_pass_on_a_healthy_deploy():
    cfg, _ = config(web_url="https://veribin.example")
    results = run(FakeApi(), cfg)
    assert [r.status for r in results] == ["PASS"] * len(results)
    assert exit_code(results) == 0


def test_the_scan_is_a_correctly_signed_next_record_from_the_demo_bin():
    cfg, public = config()
    api = FakeApi()
    run(api, cfg)
    record, signature = api.sent[0]
    parts = record.split("|")
    assert parts[1] == DEMO
    assert parts[2] == "42", "uses last_sequence + 1"
    assert parts[4:6] == ["qr", CODE], "a fresh one-time QR code, so no barcode cooldown"
    assert verify_record(public, record, signature)


def test_refuses_a_bin_that_is_not_flagged_demo_and_sends_nothing():
    cfg, _ = config()
    api = FakeApi(is_demo=False)
    results = by_name(run(api, cfg))
    assert results["demo bin"].status == "FAIL"
    assert api.sent == [], "never sends a scan from a real bin"
    assert "rpc/issue_demo_qr" not in api.calls, "never mints codes for a real bin"


def test_a_rejected_scan_fails_the_smoke_test():
    cfg, _ = config()
    results = by_name(run(FakeApi(ingest=[{"status": "rejected", "reason": "bad_signature"}]), cfg))
    assert results["signed scan accepted"].status == "FAIL"
    assert "bad_signature" in results["signed scan accepted"].detail


def test_retries_once_when_another_scan_took_the_same_sequence():
    cfg, _ = config()
    api = FakeApi(
        ingest=[
            {"status": "rejected", "reason": "duplicate_sequence"},
            {"status": "accepted", "scan_id": "s2"},
        ]
    )
    results = by_name(run(api, cfg))
    assert results["signed scan accepted"].status == "PASS"
    assert len(api.sent) == 2


def test_no_checkpoint_fails_unless_this_is_the_first_deploy():
    cfg, _ = config()
    assert by_name(run(FakeApi(checkpoints=0), cfg))["latest checkpoint"].status == "FAIL"
    cfg, _ = config(first_deploy=True)
    assert by_name(run(FakeApi(checkpoints=0), cfg))["latest checkpoint"].status == "SKIP"


def test_the_verify_endpoint_must_answer_without_a_server_error():
    cfg, _ = config()
    assert by_name(run(FakeApi(verify_status=404), cfg))["verify endpoint"].status == "PASS"
    assert by_name(run(FakeApi(verify_status=503), cfg))["verify endpoint"].status == "FAIL"


def test_website_checks_run_only_when_a_url_is_given():
    cfg, _ = config()
    assert "website" not in by_name(run(FakeApi(), cfg))
    cfg, _ = config(web_url="https://veribin.example")
    assert by_name(run(FakeApi(web_status=500), cfg))["website"].status == "FAIL"


def test_exit_code_is_non_zero_when_anything_fails():
    cfg, _ = config()
    assert exit_code(run(FakeApi(verify_status=500), cfg)) == 1
