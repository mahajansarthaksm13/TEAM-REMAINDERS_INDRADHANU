"""Integrity check, the first step of every nightly run (Y10/Y11).

1. Re-verify the Ed25519 signature of every scan (keys and signatures are
   base64, per CONTRACTS §5) - Postgres cannot do this, so Python does.
2. Ask the database to walk each bin's hash chain (verify_chain, D15).
Any failure -> the run writes a chain_break alert and STOPS: no scores or
insights are published on top of a ledger that does not verify.
"""

from __future__ import annotations

import base64

import pandas as pd
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


def signature_ok(public_key_b64: str, signature_b64: str, text: str) -> bool:
    try:
        key = Ed25519PublicKey.from_public_bytes(base64.b64decode(public_key_b64))
        key.verify(base64.b64decode(signature_b64), text.encode("utf-8"))
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


def bad_signatures(scans: pd.DataFrame) -> list[dict]:
    """scans needs: id, bin_id, record_text, signature, public_key."""
    bad = []
    for row in scans.itertuples(index=False):
        if not signature_ok(row.public_key, row.signature, row.record_text):
            bad.append({"scan_id": str(row.id), "bin_id": row.bin_id})
    return bad


def chain_breaks(verify, bin_ids: list[str]) -> list[dict]:
    """verify(bin_id) -> {'ok', 'scans_checked', 'failing_scan', 'reason'}."""
    breaks = []
    for bin_id in bin_ids:
        result = verify(bin_id)
        if not result["ok"]:
            breaks.append({"bin_id": bin_id, "failing_scan": result["failing_scan"],
                           "reason": result["reason"]})
    return breaks
