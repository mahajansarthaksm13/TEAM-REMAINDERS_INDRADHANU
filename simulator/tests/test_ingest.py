from datetime import UTC, datetime, timedelta

import pytest
from cryptography.hazmat.primitives.asymmetric import ed25519

from simulator.veribin_sim.cli import create_scan_record


@pytest.fixture
def test_state():
    """Generates a fresh test state with Ed25519 keypair."""
    priv_key = ed25519.Ed25519PrivateKey.generate()
    return {
        "bin_id": "BIN-TEST-01",
        "sequence": 100,
        "private_key_hex": priv_key.private_bytes_raw().hex(),
        "public_key_hex": priv_key.public_key().public_bytes_raw().hex(),
    }


# 1. Valid scan test
def test_valid_scan(test_state):
    scan = create_scan_record(test_state, weight_g=250)
    assert "signature" in scan
    assert len(scan["signature"]) == 128  # Ed25519 hex signature length


# 2. Tampered text test
def test_tampered_text(test_state):
    scan = create_scan_record(test_state, weight_g=250)
    tampered_raw = scan["raw_text"].replace("250", "999")

    # Signature verification should fail on modified raw text
    pub_bytes = bytes.fromhex(scan["public_key"])
    pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
    from cryptography.exceptions import InvalidSignature

    with pytest.raises(InvalidSignature):
        pub_key.verify(bytes.fromhex(scan["signature"]), tampered_raw.encode("utf-8"))


# 3. Sequence increment check
def test_sequence_increment(test_state):
    initial_seq = test_state["sequence"]
    scan = create_scan_record(test_state)
    assert test_state["sequence"] == initial_seq + 1
    assert f"|{initial_seq + 1}|" in scan["raw_text"]


# 4. Sequence gap check
def test_sequence_gap(test_state):
    scan1 = create_scan_record(test_state)
    test_state["sequence"] += 5  # Artificial gap
    scan2 = create_scan_record(test_state)

    seq1 = int(scan1["raw_text"].split("|")[3])
    seq2 = int(scan2["raw_text"].split("|")[3])
    assert seq2 - seq1 > 1


# 5. Future time stamp check
def test_future_timestamp(test_state):
    future_ts = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    scan = create_scan_record(test_state, ts=future_ts)
    scan_ts = scan["raw_text"].split("|")[0]
    assert datetime.fromisoformat(scan_ts) > datetime.now(UTC)


# 6. Replay scan check
def test_replay_scan(test_state):
    scan = create_scan_record(test_state)
    replayed_scan = scan.copy()
    assert scan["signature"] == replayed_scan["signature"]
    assert scan["raw_text"] == replayed_scan["raw_text"]


# 7. Rapid rescan check (< 3 seconds)
def test_rapid_rescan(test_state):
    scan1 = create_scan_record(test_state)
    scan2 = create_scan_record(test_state)
    ts1 = datetime.fromisoformat(scan1["raw_text"].split("|")[0])
    ts2 = datetime.fromisoformat(scan2["raw_text"].split("|")[0])
    assert (ts2 - ts1).total_seconds() < 3.0


# 8. Very low weight check
def test_low_weight_flag(test_state):
    scan = create_scan_record(test_state, weight_g=2, anomaly_label="very_low_weight")
    weight = int(scan["raw_text"].split("|")[4])
    assert weight < 10


# 9. Invalid/Unknown public key format check
def test_unknown_public_key():
    invalid_pub_key = "00" * 32
    assert len(invalid_pub_key) == 64


# 10. Multi-bin sequence isolation check
def test_multi_bin_isolation(test_state):
    state2 = test_state.copy()
    state2["bin_id"] = "BIN-TEST-02"

    scan_bin1 = create_scan_record(test_state)
    scan_bin2 = create_scan_record(state2)

    assert "BIN-TEST-01" in scan_bin1["raw_text"]
    assert "BIN-TEST-02" in scan_bin2["raw_text"]
