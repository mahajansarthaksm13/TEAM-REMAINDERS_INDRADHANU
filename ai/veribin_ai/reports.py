import hashlib


class ReportSnapshotEngine:
    """Generates immutable report snapshots and SHA-256 chain fingerprints."""

    def generate_snapshot(self, company_id: str, epr_category: str, scan_chain_hashes: list):
        # Concatenate chain hashes in deterministic order
        combined_hashes = "".join(sorted(scan_chain_hashes))
        fingerprint = hashlib.sha256(combined_hashes.encode("utf-8")).hexdigest()

        return {
            "company_id": company_id,
            "epr_category": epr_category,
            "scan_count": len(scan_chain_hashes),
            "fingerprint": fingerprint,
        }
