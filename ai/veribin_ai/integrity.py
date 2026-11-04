import hashlib

from cryptography.hazmat.primitives.asymmetric import ed25519

GENESIS_HASH = "0" * 64


class IntegrityChecker:
    """Verifies Ed25519 cryptographic signatures and hash chain continuity."""

    @staticmethod
    def compute_record_hash(record_text: str) -> str:
        """Compute SHA-256 hash of the canonical raw record text."""
        return hashlib.sha256(record_text.encode()).hexdigest()

    @staticmethod
    def compute_chain_hash(prev_chain_hash: str, record_hash: str) -> str:
        """Compute SHA-256 chain hash linking prev_chain_hash and record_hash."""
        payload = f"{prev_chain_hash}:{record_hash}".encode()
        return hashlib.sha256(payload).hexdigest()

    def verify_scan_signature(self, raw_text: str, signature_hex: str, public_key_hex: str) -> bool:
        """Verify Ed25519 signature over raw_text payload."""
        try:
            pub_bytes = bytes.fromhex(public_key_hex)
            sig_bytes = bytes.fromhex(signature_hex)
            pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
            pub_key.verify(sig_bytes, raw_text.encode())
            return True
        except Exception:
            return False

    def verify_batch(self, scan_list: list[dict]) -> dict:
        """Batch verify signatures across multiple scan records."""
        corrupted = []
        for scan in scan_list:
            is_valid = self.verify_scan_signature(
                scan["raw_text"], scan["signature"], scan["public_key"]
            )
            if not is_valid:
                corrupted.append(scan)
        return {
            "total": len(scan_list),
            "corrupted_count": len(corrupted),
            "corrupted": corrupted,
        }

    def verify_chain(self, scans: list[dict]) -> dict:
        """Verify SHA-256 ledger hash chain continuity, genesis, and record hashes.

        Returns a result dict:
            {
                "valid": bool,
                "total_scans": int,
                "broken_index": int | None,
                "error": str | None
            }
        """
        if not scans:
            return {"valid": True, "total_scans": 0, "broken_index": None, "error": None}

        # 1. Genesis check for sequence 1
        first_scan = scans[0]
        first_prev = first_scan.get("prev_chain_hash", "")
        if first_prev != GENESIS_HASH:
            return {
                "valid": False,
                "total_scans": len(scans),
                "broken_index": 0,
                "error": f"Genesis prev_chain_hash must be {GENESIS_HASH}, got {first_prev}",
            }

        # 2. Sequential continuity and hash recalculation
        for i, scan in enumerate(scans):
            # Check link continuity from previous scan
            if i > 0:
                expected_prev = scans[i - 1].get("chain_hash")
                if scan.get("prev_chain_hash") != expected_prev:
                    return {
                        "valid": False,
                        "total_scans": len(scans),
                        "broken_index": i,
                        "error": (
                            f"Broken chain link at index {i} (seq {scan.get('sequence')}): "
                            f"prev_chain_hash {scan.get('prev_chain_hash')} != {expected_prev}"
                        ),
                    }

            # Check record_hash matches record_text if record_text is present
            if "record_text" in scan:
                computed_record_hash = self.compute_record_hash(scan["record_text"])
                rec_hash = scan.get("record_hash")
                if rec_hash and rec_hash != computed_record_hash:
                    return {
                        "valid": False,
                        "total_scans": len(scans),
                        "broken_index": i,
                        "error": (
                            f"Altered payload at index {i} (seq {scan.get('sequence')}): "
                            f"record_hash {rec_hash} != {computed_record_hash}"
                        ),
                    }

            # Check chain_hash matches computed SHA256(prev_chain_hash:record_hash)
            actual_record_hash = scan.get("record_hash") or (
                self.compute_record_hash(scan["record_text"]) if "record_text" in scan else None
            )
            if actual_record_hash and scan.get("chain_hash"):
                computed_chain_hash = self.compute_chain_hash(
                    scan["prev_chain_hash"], actual_record_hash
                )
                if scan["chain_hash"] != computed_chain_hash:
                    return {
                        "valid": False,
                        "total_scans": len(scans),
                        "broken_index": i,
                        "error": (
                            f"Invalid chain_hash at index {i} (seq {scan.get('sequence')}): "
                            f"chain_hash {scan.get('chain_hash')} != {computed_chain_hash}"
                        ),
                    }

        return {"valid": True, "total_scans": len(scans), "broken_index": None, "error": None}
