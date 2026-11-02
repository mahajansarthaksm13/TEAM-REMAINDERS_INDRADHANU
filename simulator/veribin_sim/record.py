"""Canonical record building, signing, verification, and hashing helpers for VeriBin.

Adheres strictly to docs/CONTRACTS.md:
- Record format: v1|<bin_id>|<sequence>|<scanned_at>|<code_type>|<code>|<weight_g>
- Signature: Ed25519 over exact UTF-8 bytes, base64 encoded
- record_hash: SHA-256(record_text) lowercase hex (64 chars)
- chain_hash: SHA-256('<prev_chain_hash>:<record_hash>') lowercase hex (64 chars)
- Genesis prev_chain_hash: 64 zeros
"""

from __future__ import annotations

import base64
import hashlib
import re
from datetime import datetime

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

GENESIS: str = "0" * 64

# Bin ID format: VB-<CITY3>-<NNNN> or VB-<CITY3>-<NNNN>-<SUFFIX>
BIN_ID_REGEX: re.Pattern[str] = re.compile(r"^VB-[A-Z]{3}-\d{4}(?:-[A-Za-z0-9]+)?$")
# QR code format: VBQ1.<product_code>.<serial> (serial is 32 lowercase hex chars)
QR_CODE_REGEX: re.Pattern[str] = re.compile(r"^VBQ1\.P\d{4}\.[0-9a-f]{32}$")
# Barcode format: 8 to 14 digits
BARCODE_REGEX: re.Pattern[str] = re.compile(r"^\d{8,14}$")
# ISO 8601 UTC timestamp format: YYYY-MM-DDTHH:MM:SSZ
TIMESTAMP_REGEX: re.Pattern[str] = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def build_record(
    bin_id: str,
    sequence: int,
    scanned_at: str,
    code_type: str,
    code: str,
    weight_g: int,
) -> str:
    """Build and validate canonical record text.

    Format: v1|<bin_id>|<sequence>|<scanned_at>|<code_type>|<code>|<weight_g>

    Raises:
        ValueError: If any input field does not conform to the contract.
    """
    if not isinstance(bin_id, str) or not BIN_ID_REGEX.match(bin_id):
        raise ValueError(
            f"Invalid bin_id: '{bin_id}'. Expected format 'VB-<CITY3>-<NNNN>', e.g., 'VB-PUN-0001'."
        )

    if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 1:
        raise ValueError(
            f"Invalid sequence: {sequence}. Must be an integer >= 1."
        )

    if not isinstance(scanned_at, str) or not TIMESTAMP_REGEX.match(scanned_at):
        raise ValueError(
            f"Invalid scanned_at format: '{scanned_at}'. "
            "Expected ISO 8601 UTC 'YYYY-MM-DDTHH:MM:SSZ'."
        )

    try:
        datetime.strptime(scanned_at, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise ValueError(f"Invalid calendar date/time in scanned_at: '{scanned_at}'.") from exc

    if code_type not in ("qr", "barcode"):
        raise ValueError(
            f"Invalid code_type: '{code_type}'. Must be 'qr' or 'barcode'."
        )

    if not isinstance(code, str):
        raise ValueError(f"Invalid code type: {type(code)}. Expected string.")

    if code_type == "qr" and not QR_CODE_REGEX.match(code):
        raise ValueError(
            f"Invalid QR code: '{code}'. Expected format 'VBQ1.P<4digits>.<32hex>'."
        )

    if code_type == "barcode" and not BARCODE_REGEX.match(code):
        raise ValueError(
            f"Invalid barcode: '{code}'. Expected 8 to 14 digits."
        )

    if not isinstance(weight_g, int) or isinstance(weight_g, bool) or weight_g < 1:
        raise ValueError(
            f"Invalid weight_g: {weight_g}. Must be an integer >= 1."
        )

    return f"v1|{bin_id}|{sequence}|{scanned_at}|{code_type}|{code}|{weight_g}"


def sign_record(
    private_key: Ed25519PrivateKey | bytes,
    record_text: str,
) -> str:
    """Sign exact UTF-8 bytes of record text using Ed25519 and return base64 string."""
    if isinstance(private_key, bytes):
        if len(private_key) != 32:
            raise ValueError(f"Private key bytes must be 32 raw bytes, got {len(private_key)}.")
        priv = Ed25519PrivateKey.from_private_bytes(private_key)
    elif isinstance(private_key, Ed25519PrivateKey):
        priv = private_key
    else:
        raise TypeError(f"Expected Ed25519PrivateKey or bytes, got {type(private_key)}")

    signature_bytes = priv.sign(record_text.encode("utf-8"))
    return base64.b64encode(signature_bytes).decode("ascii")


def verify_record(
    public_key_b64: str,
    record_text: str,
    signature_b64: str,
) -> bool:
    """Verify Ed25519 signature over exact UTF-8 bytes of record text.

    Args:
        public_key_b64: Base64-encoded 32-byte raw Ed25519 public key.
        record_text: Exact string received.
        signature_b64: Base64-encoded 64-byte Ed25519 signature.

    Returns:
        True if signature is valid, False otherwise.
    """
    try:
        pub_bytes = base64.b64decode(public_key_b64)
        if len(pub_bytes) != 32:
            return False
        pub = Ed25519PublicKey.from_public_bytes(pub_bytes)

        sig_bytes = base64.b64decode(signature_b64)
        if len(sig_bytes) != 64:
            return False

        pub.verify(sig_bytes, record_text.encode("utf-8"))
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


def record_hash(record_text: str) -> str:
    """Compute SHA-256 of record text as lowercase hex (64 characters)."""
    return hashlib.sha256(record_text.encode("utf-8")).hexdigest().lower()


def chain_hash(prev_chain_hash: str, record_hash_hex: str) -> str:
    """Compute SHA-256 of '<prev_chain_hash>:<record_hash>' as lowercase hex (64 chars)."""
    payload = f"{prev_chain_hash}:{record_hash_hex}".encode()
    return hashlib.sha256(payload).hexdigest().lower()
