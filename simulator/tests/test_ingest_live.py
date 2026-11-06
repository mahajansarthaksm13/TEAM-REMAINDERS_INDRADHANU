"""Y7 · Ingest test suite against a REAL ingest endpoint (local or dev).

Skipped unless both are set:
    INGEST_URL              e.g. http://127.0.0.1:54321/functions/v1/ingest
    TEST_BIN_PRIVATE_KEY    base64 private key of VB-PUN-0900

The seed (D4) must contain, all with VB-PUN-0900's PUBLIC key:
    VB-PUN-0900  active    (company of product P0001)
    VB-PUN-0901  revoked
    VB-PUN-0902  active
and product P0001 (approved, has a barcode) plus dev QR code serial
QR_SERIAL_1 below (see database/scripts/build_seed.py).

Sequences are taken from the clock, so the suite can run again and again.
"""

from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
import requests
from veribin_sim.keys import load_private_key_b64
from veribin_sim.record import build_record, sign_record

INGEST_URL = os.getenv("INGEST_URL")
KEY_B64 = os.getenv("TEST_BIN_PRIVATE_KEY")

pytestmark = pytest.mark.skipif(
    not (INGEST_URL and KEY_B64), reason="INGEST_URL and TEST_BIN_PRIVATE_KEY not set"
)

ACTIVE, REVOKED, SECOND = "VB-PUN-0900", "VB-PUN-0901", "VB-PUN-0902"
BARCODE = os.getenv("TEST_BARCODE", "8901234560013")          # P0001 in data/products.csv
QR_SERIAL_1 = os.getenv("TEST_QR_SERIAL", "")                  # printed by build_seed.py
_last = 0


def seq() -> int:
    """Strictly increasing across calls and across runs."""
    global _last
    _last = max(_last + 1, time.time_ns() // 1_000_000)
    return _last


def stamp(delta: timedelta = timedelta()) -> str:
    return (datetime.now(UTC) + delta).strftime("%Y-%m-%dT%H:%M:%SZ")


def post(record: str, signature: str) -> dict:
    res = requests.post(INGEST_URL, json={"record": record, "signature": signature}, timeout=15)
    return res.json()


def signed(bin_id: str, code_type: str = "barcode", code: str = BARCODE,
           weight: int = 22, delta: timedelta = timedelta(), sequence: int | None = None):
    key = load_private_key_b64(KEY_B64)
    record = build_record(bin_id, sequence or seq(), stamp(delta), code_type, code, weight)
    return record, sign_record(key, record)


def test_01_valid_scan_is_accepted():
    # unique barcode use: wait out any cooldown from a previous run
    time.sleep(1)
    out = post(*signed(SECOND, delta=timedelta(seconds=-40)))
    assert out["status"] == "accepted", out


@pytest.mark.skipif(not QR_SERIAL_1, reason="TEST_QR_SERIAL not set")
def test_02_reused_qr_is_rejected():
    code = f"VBQ1.P0001.{QR_SERIAL_1}"
    first = post(*signed(ACTIVE, "qr", code))
    assert first.get("status") == "accepted" or first.get("reason") == "qr_already_used", first
    second = post(*signed(ACTIVE, "qr", code))
    assert second.get("reason") == "qr_already_used", second


def test_03_tampered_text_is_rejected():
    record, sig = signed(ACTIVE)
    tampered = record[: record.rfind("|") + 1] + "999"
    assert post(tampered, sig).get("reason") == "bad_signature"


def test_04_unknown_bin_is_rejected():
    assert post(*signed("VB-ZZZ-9999")).get("reason") == "unknown_bin"


def test_05_revoked_bin_is_rejected():
    assert post(*signed(REVOKED)).get("reason") == "bin_inactive"


def test_06_replay_is_rejected():
    record, sig = signed(ACTIVE, delta=timedelta(minutes=-3))
    post(record, sig)
    assert post(record, sig).get("reason") == "duplicate_sequence"


def test_07_future_time_is_rejected():
    out = post(*signed(ACTIVE, delta=timedelta(hours=1)))
    assert out.get("reason") == "time_too_far_future"


def test_08_barcode_within_30_seconds_is_rejected():
    post(*signed(ACTIVE, delta=timedelta(minutes=-10)))
    out = post(*signed(ACTIVE, delta=timedelta(minutes=-10, seconds=5)))
    assert out.get("reason") == "barcode_cooldown"


def test_09_sequence_gap_is_accepted_with_alert():
    out = post(*signed(ACTIVE, delta=timedelta(minutes=-20), sequence=seq() + 50))
    assert out["status"] == "accepted", out   # a gap is evidence, not a reason to drop data


def test_10_two_bins_at_once():
    jobs = []
    for i in range(10):
        bin_id = ACTIVE if i % 2 == 0 else SECOND
        # different minutes so no barcode cooldown clashes
        jobs.append(signed(bin_id, delta=timedelta(minutes=-30 - i)))
    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(lambda job: post(*job), jobs))
    assert all(r["status"] == "accepted" for r in results), results
