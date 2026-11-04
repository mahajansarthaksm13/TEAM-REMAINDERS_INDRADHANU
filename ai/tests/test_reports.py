from ai.veribin_ai.reports import ReportSnapshotEngine


def test_deterministic_fingerprint():
    engine = ReportSnapshotEngine()
    hashes = ["hash_abc", "hash_xyz", "hash_123"]

    snap1 = engine.generate_snapshot("COMP-001", "CAT-1", hashes)
    snap2 = engine.generate_snapshot("COMP-001", "CAT-1", hashes)

    assert snap1["fingerprint"] == snap2["fingerprint"]
    assert snap1["scan_count"] == 3
