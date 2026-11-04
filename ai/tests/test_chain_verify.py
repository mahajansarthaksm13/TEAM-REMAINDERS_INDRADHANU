import csv
from pathlib import Path

import pytest

from ai.veribin_ai.integrity import GENESIS_HASH, IntegrityChecker


@pytest.fixture
def checker() -> IntegrityChecker:
    return IntegrityChecker()


@pytest.fixture
def sample_chain(checker: IntegrityChecker) -> list[dict]:
    """Generates a valid sequential 5-scan ledger hash chain."""
    bin_id = "BIN-TEST-001"
    scans = []
    prev_hash = GENESIS_HASH

    for seq in range(1, 6):
        record_text = (
            f"v1|{bin_id}|{seq}|2026-10-25T10:30:0{seq}Z|qr|VBQ1.P0001.abc{seq}|{200 + seq * 10}"
        )
        rec_hash = checker.compute_record_hash(record_text)
        chain_hash = checker.compute_chain_hash(prev_hash, rec_hash)

        scans.append(
            {
                "id": f"scan-{seq}",
                "bin_id": bin_id,
                "sequence": seq,
                "record_text": record_text,
                "record_hash": rec_hash,
                "prev_chain_hash": prev_hash,
                "chain_hash": chain_hash,
            }
        )
        prev_hash = chain_hash

    return scans


def test_empty_chain(checker: IntegrityChecker):
    """Empty list is trivially valid."""
    result = checker.verify_chain([])
    assert result["valid"] is True
    assert result["total_scans"] == 0
    assert result["broken_index"] is None


def test_genesis_validation_success(checker: IntegrityChecker, sample_chain: list[dict]):
    """Genesis scan with 64 zero prev_chain_hash succeeds."""
    single_genesis = [sample_chain[0]]
    result = checker.verify_chain(single_genesis)
    assert result["valid"] is True
    assert result["total_scans"] == 1
    assert result["broken_index"] is None


def test_genesis_validation_failure(checker: IntegrityChecker, sample_chain: list[dict]):
    """Genesis scan with non-zero prev_chain_hash must fail."""
    corrupted_genesis = [dict(sample_chain[0])]
    corrupted_genesis[0]["prev_chain_hash"] = "f" * 64

    result = checker.verify_chain(corrupted_genesis)
    assert result["valid"] is False
    assert result["broken_index"] == 0
    assert "Genesis prev_chain_hash must be" in result["error"]


def test_chain_continuity_valid(checker: IntegrityChecker, sample_chain: list[dict]):
    """Valid unbroken sequential chain verifies successfully."""
    result = checker.verify_chain(sample_chain)
    assert result["valid"] is True
    assert result["total_scans"] == len(sample_chain)
    assert result["broken_index"] is None
    assert result["error"] is None


def test_altered_payload_detection(checker: IntegrityChecker, sample_chain: list[dict]):
    """Tampering record_text without updating record_hash is detected as altered payload."""
    tampered_chain = [dict(s) for s in sample_chain]
    # Tamper with weight in scan at index 2 (sequence 3)
    tampered_chain[2]["record_text"] = tampered_chain[2]["record_text"].replace("230", "999")

    result = checker.verify_chain(tampered_chain)
    assert result["valid"] is False
    assert result["broken_index"] == 2
    assert "Altered payload" in result["error"]


def test_broken_hash_link_detection(checker: IntegrityChecker, sample_chain: list[dict]):
    """Altering prev_chain_hash in middle of chain is detected as broken link."""
    broken_chain = [dict(s) for s in sample_chain]
    # Break link at index 3 (sequence 4)
    broken_chain[3]["prev_chain_hash"] = "1" * 64

    result = checker.verify_chain(broken_chain)
    assert result["valid"] is False
    assert result["broken_index"] == 3
    assert "Broken chain link" in result["error"]


def test_tampered_chain_hash_detection(checker: IntegrityChecker, sample_chain: list[dict]):
    """Tampering chain_hash directly is detected."""
    tampered_chain = [dict(s) for s in sample_chain]
    # Alter chain_hash of scan at index 1
    tampered_chain[1]["chain_hash"] = "e" * 64

    result = checker.verify_chain(tampered_chain)
    assert result["valid"] is False
    assert result["broken_index"] == 1
    assert "Invalid chain_hash" in result["error"]


def test_mock_dataset_chain_continuity(checker: IntegrityChecker):
    """Verify chain continuity of real scans from data/scans.csv for a planted bin."""
    scans_path = Path("data/scans.csv")
    if not scans_path.exists():
        pytest.skip("data/scans.csv not found")

    bin_scans: list[dict] = []
    with open(scans_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["bin_id"] == "VB-PUN-0001":
                bin_scans.append(row)

    assert len(bin_scans) > 0, "No scans found for VB-PUN-0001"
    # Sort strictly by sequence
    bin_scans.sort(key=lambda x: int(x["sequence"]))

    result = checker.verify_chain(bin_scans)
    assert result["valid"] is True
    assert result["total_scans"] == len(bin_scans)
    assert result["broken_index"] is None


def test_tamper_mock_dataset_scan(checker: IntegrityChecker):
    """Tampering with a scan from data/scans.csv is reliably detected."""
    scans_path = Path("data/scans.csv")
    if not scans_path.exists():
        pytest.skip("data/scans.csv not found")

    bin_scans: list[dict] = []
    with open(scans_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["bin_id"] == "VB-MUM-0001":
                bin_scans.append(dict(row))

    bin_scans.sort(key=lambda x: int(x["sequence"]))
    assert len(bin_scans) >= 5

    # Tamper scan at index 3
    orig_text = bin_scans[3]["record_text"]
    bin_scans[3]["record_text"] = orig_text + "_tampered"

    result = checker.verify_chain(bin_scans)
    assert result["valid"] is False
    assert result["broken_index"] == 3
    assert "Altered payload" in result["error"]
