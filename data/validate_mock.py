"""Validate mock EPR dataset for VeriBin (Task Y2).

Asserts all contract constraints, column names, cryptographic chaining,
sequence continuity, fraud label distribution, and EAN-13 check digits.
Exits 0 and prints 'ALL CHECKS PASSED' if valid; exits 1 on any error.
"""

from __future__ import annotations

import base64
import csv
import hashlib
import sys
from pathlib import Path

DATA_DIR: Path = Path(__file__).resolve().parent

CONTRACT_COLUMNS: dict[str, list[str]] = {
    "companies.csv": ["id", "name", "created_at", "is_demo"],
    "products.csv": [
        "id",
        "company_id",
        "product_code",
        "name",
        "barcode",
        "category",
        "unit_weight_g",
        "approved",
        "created_at",
    ],
    "bins.csv": [
        "id",
        "company_id",
        "city",
        "public_key",
        "status",
        "last_sequence",
        "chain_head",
        "last_seen",
        "is_demo",
    ],
    "targets.csv": ["company_id", "financial_year", "category", "target_kg"],
    "scans.csv": [
        "id",
        "bin_id",
        "company_id",
        "product_id",
        "category",
        "sequence",
        "scanned_at",
        "received_at",
        "code_type",
        "code",
        "weight_g",
        "record_text",
        "signature",
        "record_hash",
        "prev_chain_hash",
        "chain_hash",
        "insertion_order",
    ],
    "scans_labels.csv": ["scan_id", "is_suspicious", "fraud_type"],
    "rejected_scans.csv": ["id", "bin_id", "record_text", "reason", "received_at"],
}

EXPECTED_BINS: list[str] = [
    "VB-PUN-0001",
    "VB-PUN-0002",
    "VB-MUM-0001",
    "VB-MUM-0002",
    "VB-NAG-0001",
    "VB-NAG-0002",
]

EXPECTED_FRAUD_TYPES: set[str] = {
    "burst_rescan",
    "very_low_weight",
    "wrong_category_weight",
    "night_burst",
    "replay",
}

VALID_REASONS: set[str] = {
    "bad_method",
    "bad_format",
    "unknown_bin",
    "bin_inactive",
    "bad_signature",
    "time_too_far_future",
    "time_too_old",
    "duplicate_sequence",
    "qr_already_used",
    "qr_unknown",
    "barcode_cooldown",
    "unknown_product",
    "weight_out_of_range",
}


def read_csv(filename: str) -> tuple[list[str], list[dict[str, str]]]:
    """Read a CSV file returning header fieldnames and row dicts."""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Missing required mock data file: {filepath}")
    with open(filepath, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)
    return list(fieldnames), rows


def verify_ean13_check_digit(barcode: str) -> bool:
    """Verify GS1 EAN-13 check digit."""
    if len(barcode) != 13 or not barcode.isdigit():
        return False
    digits = [int(d) for d in barcode]
    odd_sum = sum(digits[i] for i in range(0, 12, 2))
    even_sum = sum(digits[i] for i in range(1, 12, 2))
    total = odd_sum + (even_sum * 3)
    check_digit = (10 - (total % 10)) % 10
    return digits[12] == check_digit


def validate() -> None:
    """Run all validation assertions against the mock dataset."""
    print("Validating mock dataset...")

    # 1. Exact Column Names
    for filename, expected_cols in CONTRACT_COLUMNS.items():
        headers, _ = read_csv(filename)
        assert headers == expected_cols, (
            f"Column mismatch in {filename}.\nExpected: {expected_cols}\nActual:   {headers}"
        )
    print("  [OK] Exact column names match docs/CONTRACTS.md")

    # 2. Companies Validation
    _, companies = read_csv("companies.csv")
    assert len(companies) == 3, f"Expected 3 companies, found {len(companies)}"
    company_ids = {c["id"] for c in companies}
    assert len(company_ids) == 3, "Company IDs must be unique"
    for c in companies:
        assert c["is_demo"] == "false", f"Company {c['id']} unexpected is_demo: {c['is_demo']}"
    print("  [OK] companies.csv: 3 unique companies validated")

    # 3. Products Validation
    _, products = read_csv("products.csv")
    assert len(products) == 15, f"Expected 15 products, found {len(products)}"
    categories_count: dict[str, int] = {}
    for p in products:
        assert p["approved"] == "true", f"Product {p['id']} not approved"
        assert p["company_id"] in company_ids, (
            f"Product {p['id']} has unknown company_id {p['company_id']}"
        )
        assert verify_ean13_check_digit(p["barcode"]), (
            f"Product {p['id']} has invalid EAN-13 barcode: {p['barcode']}"
        )
        wt = int(p["unit_weight_g"])
        assert 1 <= wt <= 5000, f"Product {p['id']} unit_weight_g out of range: {wt}"
        cat = p["category"]
        categories_count[cat] = categories_count.get(cat, 0) + 1

    expected_cat_distribution = {
        "cat1_rigid": 4,
        "cat2_flexible": 4,
        "cat3_multilayer": 4,
        "cat4_compostable": 3,
    }
    assert categories_count == expected_cat_distribution, (
        f"Product category distribution mismatch. Expected {expected_cat_distribution}, "
        f"got {categories_count}"
    )
    print(
        "  [OK] products.csv: 15 products (4/4/4/3 across categories) with valid EAN-13 barcodes"
    )

    # 4. Bins Validation
    _, bins = read_csv("bins.csv")
    assert len(bins) == 6, f"Expected 6 bins, found {len(bins)}"
    bin_ids = [b["id"] for b in bins]
    assert sorted(bin_ids) == sorted(EXPECTED_BINS), (
        f"Bins mismatch. Expected {EXPECTED_BINS}, got {bin_ids}"
    )
    city_counts: dict[str, int] = {}
    for b in bins:
        assert b["public_key"] == "PLACEHOLDER", (
            f"Bin {b['id']} public_key must be PLACEHOLDER, got: {b['public_key']}"
        )
        assert b["status"] == "active", f"Bin {b['id']} status must be active, got: {b['status']}"
        assert b["is_demo"] == "false", f"Bin {b['id']} is_demo must be false, got: {b['is_demo']}"
        city_counts[b["city"]] = city_counts.get(b["city"], 0) + 1
    assert city_counts == {"PUN": 2, "MUM": 2, "NAG": 2}, (
        f"Expected 2 bins per city (PUN, MUM, NAG), got: {city_counts}"
    )
    print("  [OK] bins.csv: 6 bins in 3 cities (2 per city), status active, public_key PLACEHOLDER")

    # 5. Targets Validation
    _, targets = read_csv("targets.csv")
    assert len(targets) == 12, f"Expected 12 target rows (3x4), found {len(targets)}"
    for t in targets:
        assert t["company_id"] in company_ids
        assert t["financial_year"] == "2026-27"
        assert int(t["target_kg"]) > 0
    print("  [OK] targets.csv: 12 targets for FY 2026-27 validated")

    # 6. Scans Validation
    _, scans = read_csv("scans.csv")
    assert 1900 <= len(scans) <= 2100, f"Expected about 2,000 scans, found {len(scans)}"

    # Check insertion_order strictly increasing
    insertion_orders = [int(s["insertion_order"]) for s in scans]
    assert insertion_orders == list(range(1, len(scans) + 1)), (
        "insertion_order must be globally increasing 1..N"
    )

    # Validate scans per bin (sequences, chaining, hashes)
    scans_by_bin: dict[str, list[dict[str, str]]] = {b_id: [] for b_id in EXPECTED_BINS}
    for s in scans:
        assert s["bin_id"] in scans_by_bin, f"Unknown bin_id {s['bin_id']} in scan {s['id']}"
        scans_by_bin[s["bin_id"]].append(s)

        # Check weight in range 1..5000
        wt = int(s["weight_g"])
        assert 1 <= wt <= 5000, f"Scan {s['id']} weight_g {wt} outside contract range 1..5000"

        # Check signature format (base64 of 64 bytes Ed25519)
        sig_raw = base64.b64decode(s["signature"])
        assert len(sig_raw) == 64, (
            f"Scan {s['id']} signature must decode to 64 bytes, got {len(sig_raw)}"
        )

        # Check record text format
        expected_text = (
            f"v1|{s['bin_id']}|{s['sequence']}|{s['scanned_at']}|"
            f"{s['code_type']}|{s['code']}|{s['weight_g']}"
        )
        assert s["record_text"] == expected_text, (
            f"Scan {s['id']} record_text mismatch.\n"
            f"Expected: {expected_text}\n"
            f"Actual:   {s['record_text']}"
        )

        # Check record_hash
        calc_record_hash = hashlib.sha256(s["record_text"].encode()).hexdigest()
        assert s["record_hash"] == calc_record_hash, (
            f"Scan {s['id']} record_hash mismatch. "
            f"Expected {calc_record_hash}, got {s['record_hash']}"
        )

        # Check chain_hash computation
        calc_chain_hash = hashlib.sha256(
            f"{s['prev_chain_hash']}:{s['record_hash']}".encode()
        ).hexdigest()
        assert s["chain_hash"] == calc_chain_hash, (
            f"Scan {s['id']} chain_hash mismatch. Expected {calc_chain_hash}, got {s['chain_hash']}"
        )

    # Validate sequence continuity and chain links per bin
    bins_by_id = {b["id"]: b for b in bins}
    for bin_id, b_scans in scans_by_bin.items():
        assert len(b_scans) > 0, f"Bin {bin_id} has no scans"
        # Sort by sequence
        b_scans.sort(key=lambda s: int(s["sequence"]))
        sequences = [int(s["sequence"]) for s in b_scans]
        assert sequences == list(range(1, len(b_scans) + 1)), (
            f"Bin {bin_id} sequence has gaps or does not start at 1: "
            f"{sequences[:5]}...{sequences[-5:]}"
        )

        # Check chaining from genesis
        assert b_scans[0]["prev_chain_hash"] == "0" * 64, (
            f"Bin {bin_id} sequence 1 prev_chain_hash must be 64 zeros, "
            f"got {b_scans[0]['prev_chain_hash']}"
        )
        for i in range(1, len(b_scans)):
            assert b_scans[i]["prev_chain_hash"] == b_scans[i - 1]["chain_hash"], (
                f"Bin {bin_id} chain broken at seq {b_scans[i]['sequence']}. "
                f"prev_chain_hash: {b_scans[i]['prev_chain_hash']} != {b_scans[i-1]['chain_hash']}"
            )

        # Check bins.csv last_sequence, chain_head, last_seen match final scan
        bin_meta = bins_by_id[bin_id]
        final_scan = b_scans[-1]
        assert int(bin_meta["last_sequence"]) == int(final_scan["sequence"]), (
            f"Bin {bin_id} last_sequence mismatch: "
            f"{bin_meta['last_sequence']} vs {final_scan['sequence']}"
        )
        assert bin_meta["chain_head"] == final_scan["chain_hash"], (
            f"Bin {bin_id} chain_head mismatch: "
            f"{bin_meta['chain_head']} vs {final_scan['chain_hash']}"
        )
        assert bin_meta["last_seen"] == final_scan["scanned_at"], (
            f"Bin {bin_id} last_seen mismatch: "
            f"{bin_meta['last_seen']} vs {final_scan['scanned_at']}"
        )

    print(
        f"  [OK] scans.csv: {len(scans)} scans verified "
        "(gap-free sequences, hash chains intact, weights 1..5000)"
    )

    # 7. Labels Validation
    _, labels = read_csv("scans_labels.csv")
    assert len(labels) == len(scans), (
        f"scans_labels.csv row count ({len(labels)}) != scans.csv row count ({len(scans)})"
    )

    scans_id_set = {s["id"] for s in scans}
    labels_id_set = {lbl["scan_id"] for lbl in labels}
    assert scans_id_set == labels_id_set, "scans_labels scan_id set does not match scans.csv id set"

    suspicious_count = 0
    fraud_counts: dict[str, int] = {}
    for lbl in labels:
        is_susp = lbl["is_suspicious"]
        f_type = lbl["fraud_type"]
        if is_susp == "true":
            suspicious_count += 1
            assert f_type in EXPECTED_FRAUD_TYPES, (
                f"Scan {lbl['scan_id']} has unknown fraud_type: {f_type}"
            )
            fraud_counts[f_type] = fraud_counts.get(f_type, 0) + 1
        elif is_susp == "false":
            assert f_type == "", (
                f"Scan {lbl['scan_id']} is not suspicious but has fraud_type: '{f_type}'"
            )
        else:
            raise AssertionError(f"Invalid is_suspicious value: {is_susp}")

    assert suspicious_count == 50, f"Expected exactly 50 suspicious scans, found {suspicious_count}"
    expected_fraud_counts = {ft: 10 for ft in EXPECTED_FRAUD_TYPES}
    assert fraud_counts == expected_fraud_counts, (
        f"Fraud types distribution mismatch. Expected {expected_fraud_counts}, got {fraud_counts}"
    )
    print("  [OK] scans_labels.csv: exactly 50 suspicious scans (10 of each fraud type) validated")

    # 8. Rejected Scans Validation
    _, rejected = read_csv("rejected_scans.csv")
    assert 50 <= len(rejected) <= 70, (
        f"Expected about 60 rejected scans, found {len(rejected)}"
    )
    for r in rejected:
        assert r["bin_id"] in scans_by_bin, f"Rejected scan has unknown bin_id: {r['bin_id']}"
        assert r["reason"] in VALID_REASONS, (
            f"Rejected scan {r['id']} has invalid reason code: {r['reason']}"
        )
        assert r["record_text"].startswith("v1|"), (
            f"Rejected scan {r['id']} malformed record_text: {r['record_text']}"
        )
    print(f"  [OK] rejected_scans.csv: {len(rejected)} rejected scans with valid reason codes")

    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    try:
        validate()
        sys.exit(0)
    except (AssertionError, ValueError, KeyError, OSError) as e:
        print(f"\nVALIDATION ERROR: {e}", file=sys.stderr)
        sys.exit(1)
