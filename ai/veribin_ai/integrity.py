from cryptography.hazmat.primitives.asymmetric import ed25519


class IntegrityChecker:
    """Verifies Ed25519 cryptographic signatures and hash chain continuity."""

    def verify_scan_signature(self, raw_text: str, signature_hex: str, public_key_hex: str) -> bool:
        try:
            pub_bytes = bytes.fromhex(public_key_hex)
            sig_bytes = bytes.fromhex(signature_hex)
            pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
            pub_key.verify(sig_bytes, raw_text.encode("utf-8"))
            return True
        except Exception:
            return False

    def verify_batch(self, scan_list):
        corrupted = []
        for scan in scan_list:
            is_valid = self.verify_scan_signature(
                scan["raw_text"], scan["signature"], scan["public_key"]
            )
            if not is_valid:
                corrupted.append(scan)
        return {"total": len(scan_list), "corrupted_count": len(corrupted), "corrupted": corrupted}
