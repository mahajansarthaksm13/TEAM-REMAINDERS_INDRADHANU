"""Unit tests for simulator/veribin_sim/record.py (Task Y5)."""

from __future__ import annotations

import base64

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from veribin_sim.record import (
    GENESIS,
    build_record,
    chain_hash,
    record_hash,
    sign_record,
    verify_record,
)


def test_genesis_hash() -> None:
    """GENESIS must be 64 zeros."""
    assert GENESIS == "0" * 64
    assert len(GENESIS) == 64


def test_build_record_valid_qr() -> None:
    """build_record succeeds with valid QR code."""
    record = build_record(
        bin_id="VB-PUN-0001",
        sequence=1,
        scanned_at="2026-10-25T10:30:05Z",
        code_type="qr",
        code="VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596",
        weight_g=184,
    )
    expected = (
        "v1|VB-PUN-0001|1|2026-10-25T10:30:05Z|qr|"
        "VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596|184"
    )
    assert record == expected


def test_build_record_valid_barcode() -> None:
    """build_record succeeds with valid numeric barcode."""
    record = build_record(
        bin_id="VB-MUM-0002",
        sequence=42,
        scanned_at="2026-10-26T12:00:00Z",
        code_type="barcode",
        code="8901030999991",
        weight_g=25,
    )
    assert record == "v1|VB-MUM-0002|42|2026-10-26T12:00:00Z|barcode|8901030999991|25"


@pytest.mark.parametrize(
    "bin_id",
    ["INVALID", "VB-PUN", "VB-PUN-01", "VB-pun-0001", "", 123],
)
def test_build_record_invalid_bin_id(bin_id: str) -> None:
    """Invalid bin_id formats must raise ValueError."""
    with pytest.raises(ValueError, match="Invalid bin_id"):
        build_record(
            bin_id=bin_id,  # type: ignore
            sequence=1,
            scanned_at="2026-10-25T10:30:05Z",
            code_type="barcode",
            code="8901030999991",
            weight_g=25,
        )


@pytest.mark.parametrize("sequence", [0, -1, True, False, 1.5, "1"])
def test_build_record_invalid_sequence(sequence: int) -> None:
    """Invalid sequence values must raise ValueError."""
    with pytest.raises(ValueError, match="Invalid sequence"):
        build_record(
            bin_id="VB-PUN-0001",
            sequence=sequence,  # type: ignore
            scanned_at="2026-10-25T10:30:05Z",
            code_type="barcode",
            code="8901030999991",
            weight_g=25,
        )


@pytest.mark.parametrize(
    "scanned_at",
    [
        "2026-10-25 10:30:05",
        "2026-10-25T10:30:05+05:30",
        "2026-10-25T10:30:05",
        "2026-02-30T10:30:05Z",  # Invalid calendar date
        "invalid",
    ],
)
def test_build_record_invalid_scanned_at(scanned_at: str) -> None:
    """Invalid timestamp strings must raise ValueError."""
    with pytest.raises(ValueError, match="Invalid .*scanned_at"):
        build_record(
            bin_id="VB-PUN-0001",
            sequence=1,
            scanned_at=scanned_at,
            code_type="barcode",
            code="8901030999991",
            weight_g=25,
        )


def test_build_record_invalid_code_type() -> None:
    """Invalid code_type must raise ValueError."""
    with pytest.raises(ValueError, match="Invalid code_type"):
        build_record(
            bin_id="VB-PUN-0001",
            sequence=1,
            scanned_at="2026-10-25T10:30:05Z",
            code_type="nfc",
            code="8901030999991",
            weight_g=25,
        )


@pytest.mark.parametrize(
    "qr_code",
    [
        "VBQ1.P007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596",  # 3 digit product code
        "VBQ1.P0007.9F2C4E1A7B3D48C6A5E0D1F2B3C4A596",  # uppercase hex
        "VBQ1.P0007.9f2c4e1a",  # short serial
        "VBQ2.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596",  # wrong prefix
    ],
)
def test_build_record_invalid_qr_code(qr_code: str) -> None:
    """Invalid QR code payloads must raise ValueError."""
    with pytest.raises(ValueError, match="Invalid QR code"):
        build_record(
            bin_id="VB-PUN-0001",
            sequence=1,
            scanned_at="2026-10-25T10:30:05Z",
            code_type="qr",
            code=qr_code,
            weight_g=25,
        )


@pytest.mark.parametrize(
    "barcode",
    [
        "1234567",  # 7 digits (< 8)
        "123456789012345",  # 15 digits (> 14)
        "890103099999A",  # non-digit
        "",
    ],
)
def test_build_record_invalid_barcode(barcode: str) -> None:
    """Invalid barcodes must raise ValueError."""
    with pytest.raises(ValueError, match="Invalid barcode"):
        build_record(
            bin_id="VB-PUN-0001",
            sequence=1,
            scanned_at="2026-10-25T10:30:05Z",
            code_type="barcode",
            code=barcode,
            weight_g=25,
        )


@pytest.mark.parametrize("weight_g", [0, -10, True, False, "100", 2.5])
def test_build_record_invalid_weight(weight_g: int) -> None:
    """Invalid weight values must raise ValueError."""
    with pytest.raises(ValueError, match="Invalid weight_g"):
        build_record(
            bin_id="VB-PUN-0001",
            sequence=1,
            scanned_at="2026-10-25T10:30:05Z",
            code_type="barcode",
            code="8901030999991",
            weight_g=weight_g,  # type: ignore
        )


def test_sign_and_verify_roundtrip() -> None:
    """Valid record signs and verifies successfully."""
    priv = Ed25519PrivateKey.generate()
    pub_raw = priv.public_key().public_bytes_raw()
    pub_b64 = base64.b64encode(pub_raw).decode("ascii")

    record = build_record(
        bin_id="VB-PUN-0001",
        sequence=1,
        scanned_at="2026-10-25T10:30:05Z",
        code_type="qr",
        code="VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596",
        weight_g=184,
    )
    sig_b64 = sign_record(priv, record)
    assert verify_record(pub_b64, record, sig_b64) is True


def test_verify_fails_on_tampered_text() -> None:
    """Altering any character in the record text invalidates verification."""
    priv = Ed25519PrivateKey.generate()
    pub_b64 = base64.b64encode(priv.public_key().public_bytes_raw()).decode("ascii")

    record = build_record(
        bin_id="VB-PUN-0001",
        sequence=1,
        scanned_at="2026-10-25T10:30:05Z",
        code_type="qr",
        code="VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596",
        weight_g=184,
    )
    sig_b64 = sign_record(priv, record)

    # Tamper weight
    tampered_record = (
        "v1|VB-PUN-0001|1|2026-10-25T10:30:05Z|qr|"
        "VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596|185"
    )
    assert verify_record(pub_b64, tampered_record, sig_b64) is False


def test_verify_fails_on_wrong_key() -> None:
    """Verifying with a different public key fails."""
    priv1 = Ed25519PrivateKey.generate()
    priv2 = Ed25519PrivateKey.generate()
    pub2_b64 = base64.b64encode(priv2.public_key().public_bytes_raw()).decode("ascii")

    record = "v1|VB-PUN-0001|1|2026-10-25T10:30:05Z|barcode|8901030999991|25"
    sig1_b64 = sign_record(priv1, record)
    assert verify_record(pub2_b64, record, sig1_b64) is False


def test_verify_handles_malformed_base64() -> None:
    """verify_record safely returns False on malformed keys or signatures."""
    record = "v1|VB-PUN-0001|1|2026-10-25T10:30:05Z|barcode|8901030999991|25"
    assert verify_record("not_valid_base64!", record, "also_not_valid!") is False
    assert verify_record("AAAA", record, "AAAA") is False


def test_test_vectors_exact_match() -> None:
    """Recompute exact vectors documented in docs/TEST_VECTORS.md."""
    seed_hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    seed_bytes = bytes.fromhex(seed_hex)
    priv = Ed25519PrivateKey.from_private_bytes(seed_bytes)

    pub_raw = priv.public_key().public_bytes_raw()
    pub_hex = pub_raw.hex()
    pub_b64 = base64.b64encode(pub_raw).decode("ascii")

    assert pub_hex == "207a067892821e25d770f1fba0c47c11ff4b813e54162ece9eb839e076231ab6"
    assert pub_b64 == "IHoGeJKCHiXXcPH7oMR8Ef9LgT5UFi7Onrg54HYjGrY="

    record = build_record(
        bin_id="VB-PUN-0001",
        sequence=1,
        scanned_at="2026-10-25T10:30:05Z",
        code_type="qr",
        code="VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596",
        weight_g=184,
    )
    expected = (
        "v1|VB-PUN-0001|1|2026-10-25T10:30:05Z|qr|"
        "VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596|184"
    )
    assert record == expected

    sig_b64 = sign_record(priv, record)
    expected_sig = (
        "kUjZsgjn0bRIIXxDvAqsUjAAPYyLwFgPf3zR2T9oX22KLEBN3gJ74PSwH/2QPdPEDfNxn7ZboJqjHk1FsDp/AA=="
    )
    assert sig_b64 == expected_sig
    assert verify_record(pub_b64, record, sig_b64) is True

    rec_h = record_hash(record)
    assert rec_h == "41f4874be7625d29b3d9063dd1911d3ccc89f9a4ffdc2574fe36a727fceb3826"

    c_h = chain_hash(GENESIS, rec_h)
    assert c_h == "81e0742e16e782d4813cdd8eae9a0454ee47bd157964aa8d8903fe4c3b0d6d92"
