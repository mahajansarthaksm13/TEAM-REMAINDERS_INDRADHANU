"""Generate deterministic mock EPR dataset for VeriBin (Task Y2).

Adheres strictly to docs/CONTRACTS.md and docs/YASH_TASKS.md.
Uses seed 42 for complete reproducibility and byte-identical outputs.
"""

from __future__ import annotations

import base64
import csv
import hashlib
import random
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

# Fixed seed for deterministic mock dataset generation
SEED: int = 42

# DECISION: Anchor end date is fixed so running generate_mock.py on any calendar day
# produces byte-identical files. Window: 90 days ending at 2026-10-26T23:59:59Z.
ANCHOR_END_TIME: datetime = datetime(2026, 10, 26, 23, 59, 59, tzinfo=UTC)
WINDOW_DAYS: int = 90
ANCHOR_START_TIME: datetime = ANCHOR_END_TIME - timedelta(days=WINDOW_DAYS)

GENESIS_PREV_CHAIN_HASH: str = "0" * 64

DATA_DIR: Path = Path(__file__).resolve().parent


def compute_record_hash(record_text: str) -> str:
    """Compute SHA-256 of record text as lowercase hex string (64 characters)."""
    return hashlib.sha256(record_text.encode()).hexdigest()


def compute_chain_hash(prev_chain_hash: str, record_hash_hex: str) -> str:
    """Compute SHA-256 of '<prev_chain_hash>:<record_hash>' as lowercase hex."""
    payload = f"{prev_chain_hash}:{record_hash_hex}".encode()
    return hashlib.sha256(payload).hexdigest()


def build_record_text(
    bin_id: str,
    sequence: int,
    scanned_at_iso: str,
    code_type: str,
    code: str,
    weight_g: int,
) -> str:
    """Build canonical record text format v1|<bin_id>|<seq>|<scanned_at>|<type>|<code>|<weight_g>."""
    return f"v1|{bin_id}|{sequence}|{scanned_at_iso}|{code_type}|{code}|{weight_g}"


def sign_record(private_key: Ed25519PrivateKey, record_text: str) -> str:
    """Sign exact UTF-8 bytes of record text using Ed25519 and return base64 string."""
    sig_bytes = private_key.sign(record_text.encode())
    return base64.b64encode(sig_bytes).decode("ascii")


def calculate_ean13_check_digit(twelve_digits: str) -> int:
    """Compute GS1 EAN-13 check digit for a 12-digit string."""
    odd_sum = sum(int(twelve_digits[i]) for i in range(0, 12, 2))
    even_sum = sum(int(twelve_digits[i]) for i in range(1, 12, 2))
    total = odd_sum + (even_sum * 3)
    return (10 - (total % 10)) % 10


def make_ean13_barcode(twelve_digits: str) -> str:
    """Create complete 13-digit EAN-13 barcode with valid check digit."""
    check = calculate_ean13_check_digit(twelve_digits)
    return f"{twelve_digits}{check}"


def get_bin_private_key(bin_id: str) -> Ed25519PrivateKey:
    """Derive deterministic in-memory Ed25519 private key from seed and bin_id."""
    # DECISION: Throwaway mock Ed25519 keys derived deterministically from seed 42.
    key_seed = hashlib.sha256(f"veribin-mock-bin-key-{SEED}-{bin_id}".encode()).digest()
    return Ed25519PrivateKey.from_private_bytes(key_seed)


def generate_companies() -> list[dict[str, str]]:
    """Generate exactly 3 companies per contract."""
    # Deterministic fixed UUIDs
    return [
        {
            "id": "c1111111-1111-4111-8111-111111111111",
            "name": "EcoFoods India Ltd",
            "created_at": "2026-01-01T00:00:00Z",
            "is_demo": "false",
        },
        {
            "id": "c2222222-2222-4222-8222-222222222222",
            "name": "PureBeverages Corp",
            "created_at": "2026-01-01T00:00:00Z",
            "is_demo": "false",
        },
        {
            "id": "c3333333-3333-4333-8333-333333333333",
            "name": "GreenPack Naturals",
            "created_at": "2026-01-01T00:00:00Z",
            "is_demo": "false",
        },
    ]


def generate_products(companies: list[dict[str, str]]) -> list[dict[str, str | int]]:
    """Generate exactly 15 products across 4 EPR categories (4/4/4/3)."""
    # 4 cat1_rigid, 4 cat2_flexible, 4 cat3_multilayer, 3 cat4_compostable
    specs = [
        # cat1_rigid (4)
        ("P0001", "Eco Water Bottle 500ml", "cat1_rigid", 22, 0),
        ("P0002", "HDPE Milk Can 1L", "cat1_rigid", 42, 0),
        ("P0003", "Rigid Detergent Bottle 750ml", "cat1_rigid", 48, 1),
        ("P0004", "Beverage Syrup Jug 1L", "cat1_rigid", 54, 2),
        # cat2_flexible (4)
        ("P0005", "Potato Chips Packet 50g", "cat2_flexible", 6, 0),
        ("P0006", "Grocers Carry Bag 20L", "cat2_flexible", 9, 1),
        ("P0007", "Bread Packaging Wrap", "cat2_flexible", 4, 1),
        ("P0008", "Frozen Peas Film Pouch", "cat2_flexible", 8, 2),
        # cat3_multilayer (4)
        ("P0009", "Shampoo Sachet 6ml", "cat3_multilayer", 3, 0),
        ("P0010", "Aseptic Fruit Juice Carton 200ml", "cat3_multilayer", 12, 1),
        ("P0011", "Metallised Biscuit Wrapper", "cat3_multilayer", 7, 2),
        ("P0012", "Laminated Roasted Coffee Pouch 250g", "cat3_multilayer", 15, 2),
        # cat4_compostable (3)
        ("P0013", "Compostable Bio Carry Bag", "cat4_compostable", 8, 0),
        ("P0014", "PLA Cornstarch Food Container", "cat4_compostable", 28, 1),
        ("P0015", "Biodegradable Spoon & Fork Pack", "cat4_compostable", 18, 2),
    ]

    products: list[dict[str, str | int]] = []
    for idx, (code, name, category, unit_wt, comp_idx) in enumerate(specs, start=1):
        product_uuid = f"p{idx:07d}-0000-4000-8000-{idx:012d}"
        company_id = str(companies[comp_idx]["id"])
        raw_prefix = f"890123456{idx:03d}"
        barcode = make_ean13_barcode(raw_prefix)
        products.append(
            {
                "id": product_uuid,
                "company_id": company_id,
                "product_code": code,
                "name": name,
                "barcode": barcode,
                "category": category,
                "unit_weight_g": unit_wt,
                "approved": "true",
                "created_at": "2026-01-05T00:00:00Z",
            }
        )
    return products


def generate_targets(companies: list[dict[str, str]]) -> list[dict[str, str | int]]:
    """Generate targets.csv: 3 companies x 4 categories for FY 2026-27."""
    categories = ["cat1_rigid", "cat2_flexible", "cat3_multilayer", "cat4_compostable"]
    # DECISION: Realistic plausible targets for the ~2000 mock scans (total ~40-50 kg in 90 days)
    # Annualized company targets between 20 and 50 kg per category.
    base_targets = {
        "cat1_rigid": 45,
        "cat2_flexible": 35,
        "cat3_multilayer": 25,
        "cat4_compostable": 15,
    }
    targets: list[dict[str, str | int]] = []
    for comp in companies:
        comp_id = str(comp["id"])
        for cat in categories:
            targets.append(
                {
                    "company_id": comp_id,
                    "financial_year": "2026-27",
                    "category": cat,
                    "target_kg": base_targets[cat],
                }
            )
    return targets


def generate_mock_dataset() -> None:
    """Generate all mock CSV files deterministically."""
    random.seed(SEED)

    # 1. Companies
    companies = generate_companies()

    # 2. Products
    products = generate_products(companies)
    # Products grouped by company
    products_by_company: dict[str, list[dict[str, str | int]]] = {
        str(c["id"]): [] for c in companies
    }
    for p in products:
        products_by_company[str(p["company_id"])].append(p)

    # Products with unit_weight >= 10g for very_low_weight fraud
    high_weight_products = [p for p in products if int(p["unit_weight_g"]) >= 10]

    # 3. Bins setup
    # 6 bins, 3 cities (PUN, MUM, NAG), 2 per city
    bin_specs = [
        ("VB-PUN-0001", "PUN", companies[0]["id"]),
        ("VB-PUN-0002", "PUN", companies[0]["id"]),  # Planted bin 1
        ("VB-MUM-0001", "MUM", companies[1]["id"]),
        ("VB-MUM-0002", "MUM", companies[1]["id"]),  # Planted bin 2
        ("VB-NAG-0001", "NAG", companies[2]["id"]),
        ("VB-NAG-0002", "NAG", companies[2]["id"]),  # Planted bin 3
    ]

    # Pre-derive in-memory Ed25519 signing keys
    bin_keys = {bin_id: get_bin_private_key(bin_id) for bin_id, _, _ in bin_specs}

    # DECISION: Distribute suspicious scans across 3 planted bins (VB-PUN-0002, VB-MUM-0002, VB-NAG-0002)
    # One per city, keeping VB-PUN-0001, VB-MUM-0001, VB-NAG-0001 completely clean.
    # Total scans = 2000. Exactly 50 suspicious scans, 1950 normal scans.
    # Scans per bin:
    # VB-PUN-0001: 333 (all normal)
    # VB-PUN-0002: 334 (20 suspicious: 10 burst_rescan, 10 very_low_weight; 314 normal)
    # VB-MUM-0001: 333 (all normal)
    # VB-MUM-0002: 334 (20 suspicious: 10 wrong_category_weight, 10 night_burst; 314 normal)
    # VB-NAG-0001: 333 (all normal)
    # VB-NAG-0002: 333 (10 suspicious: 10 replay; 323 normal)
    # Total = 333 + 334 + 333 + 334 + 333 + 333 = 2000 scans.

    total_window_seconds = int((ANCHOR_END_TIME - ANCHOR_START_TIME).total_seconds())

    # Generate normal timestamps for a bin: daytime weighted (07:00 to 22:00 IST)
    # IST = UTC + 5:30. Daytime 07:00-22:00 IST is 01:30 to 16:30 UTC.
    def random_daytime_timestamp() -> datetime:
        while True:
            offset_sec = random.randint(0, total_window_seconds - 60)
            candidate = ANCHOR_START_TIME + timedelta(seconds=offset_sec)
            # IST hour
            ist_time = candidate + timedelta(hours=5, minutes=30)
            if 7 <= ist_time.hour < 22:
                return candidate

    # Structure to hold scan raw definitions before sequencing and chaining
    class RawScan:

        def __init__(
            self,
            bin_id: str,
            company_id: str,
            product: dict[str, str | int],
            scanned_at: datetime,
            code_type: str,
            code: str,
            weight_g: int,
            is_suspicious: bool,
            fraud_type: str,
        ) -> None:
            self.bin_id = bin_id
            self.company_id = company_id
            self.product = product
            self.scanned_at = scanned_at
            self.code_type = code_type
            self.code = code
            self.weight_g = weight_g
            self.is_suspicious = is_suspicious
            self.fraud_type = fraud_type

    bin_raw_scans: dict[str, list[RawScan]] = {b[0]: [] for b in bin_specs}

    def make_qr_code(product_code: str) -> str:
        serial_hex = f"{random.getrandbits(128):032x}"
        return f"VBQ1.{product_code}.{serial_hex}"

    def make_normal_weight(unit_wt: int) -> int:
        factor = random.uniform(0.92, 1.08)
        val = round(unit_wt * factor)
        return max(1, min(5000, val))

    # --- Generate Planted Suspicious Scans ---
    # 1. burst_rescan on VB-PUN-0002 (10 scans: 2 bursts of 5)
    c1_id = str(companies[0]["id"])
    c1_prods = products_by_company[c1_id]
    for _ in range(2):
        burst_base_time = random_daytime_timestamp()
        # 5 scans separated by 1-2 seconds (< 3s), different barcodes
        shuffled_prods = random.sample(c1_prods, 5)
        for i in range(5):
            scan_time = burst_base_time + timedelta(seconds=i * 2)
            p = shuffled_prods[i]
            bin_raw_scans["VB-PUN-0002"].append(
                RawScan(
                    bin_id="VB-PUN-0002",
                    company_id=c1_id,
                    product=p,
                    scanned_at=scan_time,
                    code_type="barcode",
                    code=str(p["barcode"]),
                    weight_g=make_normal_weight(int(p["unit_weight_g"])),
                    is_suspicious=True,
                    fraud_type="burst_rescan",
                )
            )

    # 2. very_low_weight on VB-PUN-0002 (10 scans)
    # Weight 1 to 4 g for products whose unit weight is >= 10 g
    for _ in range(10):
        scan_time = random_daytime_timestamp()
        p = random.choice(high_weight_products)
        low_wt = random.randint(1, 4)
        is_qr = random.random() < 0.6
        code_type = "qr" if is_qr else "barcode"
        code = make_qr_code(str(p["product_code"])) if is_qr else str(p["barcode"])
        bin_raw_scans["VB-PUN-0002"].append(
            RawScan(
                bin_id="VB-PUN-0002",
                company_id=str(p["company_id"]),
                product=p,
                scanned_at=scan_time,
                code_type=code_type,
                code=code,
                weight_g=low_wt,
                is_suspicious=True,
                fraud_type="very_low_weight",
            )
        )

    # 3. wrong_category_weight on VB-MUM-0002 (10 scans)
    # Weight is 3x to 6x unit weight (capped at 5000)
    c2_id = str(companies[1]["id"])
    c2_prods = products_by_company[c2_id]
    for _ in range(10):
        scan_time = random_daytime_timestamp()
        p = random.choice(c2_prods)
        unit_wt = int(p["unit_weight_g"])
        mult = random.uniform(3.0, 6.0)
        high_wt = min(5000, max(1, round(unit_wt * mult)))
        is_qr = random.random() < 0.6
        code_type = "qr" if is_qr else "barcode"
        code = make_qr_code(str(p["product_code"])) if is_qr else str(p["barcode"])
        bin_raw_scans["VB-MUM-0002"].append(
            RawScan(
                bin_id="VB-MUM-0002",
                company_id=c2_id,
                product=p,
                scanned_at=scan_time,
                code_type=code_type,
                code=code,
                weight_g=high_wt,
                is_suspicious=True,
                fraud_type="wrong_category_weight",
            )
        )

    # 4. night_burst on VB-MUM-0002 (10 scans: 2 bursts of 5)
    # Runs of 5 scans between 01:00 and 04:00 IST within 2 minutes
    # 01:00 to 04:00 IST is 19:30 to 22:30 UTC of previous calendar day
    for _ in range(2):
        # Pick a random day in the window
        day_offset = random.randint(5, WINDOW_DAYS - 5)
        # Night base time between 01:30 and 03:30 IST
        ist_night_dt = (ANCHOR_START_TIME + timedelta(days=day_offset)).replace(
            hour=2, minute=random.randint(0, 50), second=0
        )
        utc_night_dt = ist_night_dt - timedelta(hours=5, minutes=30)
        for i in range(5):
            scan_time = utc_night_dt + timedelta(seconds=i * 20)  # within 100 seconds (< 2 min)
            p = random.choice(c2_prods)
            is_qr = random.random() < 0.6
            code_type = "qr" if is_qr else "barcode"
            code = make_qr_code(str(p["product_code"])) if is_qr else str(p["barcode"])
            bin_raw_scans["VB-MUM-0002"].append(
                RawScan(
                    bin_id="VB-MUM-0002",
                    company_id=c2_id,
                    product=p,
                    scanned_at=scan_time,
                    code_type=code_type,
                    code=code,
                    weight_g=make_normal_weight(int(p["unit_weight_g"])),
                    is_suspicious=True,
                    fraud_type="night_burst",
                )
            )

    # 5. replay on VB-NAG-0002 (10 scans: 2 runs of 5)
    # Scripted repeater: identical barcode and weight at exact fixed 60s interval
    c3_id = str(companies[2]["id"])
    c3_prods = products_by_company[c3_id]
    for run_idx in range(2):
        replay_base_time = random_daytime_timestamp()
        p = c3_prods[run_idx % len(c3_prods)]
        fixed_barcode = str(p["barcode"])
        fixed_weight = make_normal_weight(int(p["unit_weight_g"]))
        for i in range(5):
            scan_time = replay_base_time + timedelta(seconds=i * 60)
            bin_raw_scans["VB-NAG-0002"].append(
                RawScan(
                    bin_id="VB-NAG-0002",
                    company_id=c3_id,
                    product=p,
                    scanned_at=scan_time,
                    code_type="barcode",
                    code=fixed_barcode,
                    weight_g=fixed_weight,
                    is_suspicious=True,
                    fraud_type="replay",
                )
            )

    # Target scan counts per bin
    # 333 for VB-PUN-0001, VB-MUM-0001, VB-NAG-0001, VB-NAG-0002
    # 334 for VB-PUN-0002, VB-MUM-0002
    target_counts = {
        "VB-PUN-0001": 333,
        "VB-PUN-0002": 334,
        "VB-MUM-0001": 333,
        "VB-MUM-0002": 334,
        "VB-NAG-0001": 333,
        "VB-NAG-0002": 333,
    }

    # Generate remaining normal scans per bin
    for bin_id, _, comp_id in bin_specs:
        needed = target_counts[bin_id] - len(bin_raw_scans[bin_id])
        comp_prods = products_by_company[str(comp_id)]
        for _ in range(needed):
            scan_time = random_daytime_timestamp()
            p = random.choice(comp_prods)
            is_qr = random.random() < 0.6  # ~60% QR, ~40% barcode
            code_type = "qr" if is_qr else "barcode"
            code = make_qr_code(str(p["product_code"])) if is_qr else str(p["barcode"])
            wt = make_normal_weight(int(p["unit_weight_g"]))
            bin_raw_scans[bin_id].append(
                RawScan(
                    bin_id=bin_id,
                    company_id=str(comp_id),
                    product=p,
                    scanned_at=scan_time,
                    code_type=code_type,
                    code=code,
                    weight_g=wt,
                    is_suspicious=False,
                    fraud_type="",
                )
            )

    # For each bin, sort chronologically to build strictly increasing sequence and hash chain
    # Ensure no two scans on the same bin share the exact same second
    all_processed_scans: list[dict[str, str | int]] = []
    bin_last_sequence: dict[str, int] = {}
    bin_chain_head: dict[str, str] = {}
    bin_last_seen: dict[str, str] = {}

    for bin_id, _, _ in bin_specs:
        scans = bin_raw_scans[bin_id]
        # Sort by scanned_at
        scans.sort(key=lambda s: s.scanned_at)

        # Ensure strictly ascending scanned_at timestamps without collisions
        for i in range(1, len(scans)):
            if scans[i].scanned_at <= scans[i - 1].scanned_at:
                scans[i].scanned_at = scans[i - 1].scanned_at + timedelta(seconds=1)

        prev_chain = GENESIS_PREV_CHAIN_HASH
        private_key = bin_keys[bin_id]

        for seq, scan in enumerate(scans, start=1):
            scanned_iso = scan.scanned_at.strftime("%Y-%m-%dT%H:%M:%SZ")
            # received_at is 1-3s after scanned_at
            received_dt = scan.scanned_at + timedelta(seconds=random.randint(1, 3))
            received_iso = received_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

            rec_text = build_record_text(
                bin_id=bin_id,
                sequence=seq,
                scanned_at_iso=scanned_iso,
                code_type=scan.code_type,
                code=scan.code,
                weight_g=scan.weight_g,
            )
            sig = sign_record(private_key, rec_text)
            rec_hash = compute_record_hash(rec_text)
            ch_hash = compute_chain_hash(prev_chain, rec_hash)

            scan_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{bin_id}-{seq}-{scanned_iso}"))

            scan_row: dict[str, str | int] = {
                "id": scan_uuid,
                "bin_id": bin_id,
                "company_id": scan.company_id,
                "product_id": str(scan.product["id"]),
                "category": str(scan.product["category"]),
                "sequence": seq,
                "scanned_at": scanned_iso,
                "received_at": received_iso,
                "code_type": scan.code_type,
                "code": scan.code,
                "weight_g": scan.weight_g,
                "record_text": rec_text,
                "signature": sig,
                "record_hash": rec_hash,
                "prev_chain_hash": prev_chain,
                "chain_hash": ch_hash,
                "is_suspicious": "true" if scan.is_suspicious else "false",
                "fraud_type": scan.fraud_type,
                "_received_dt": received_dt.isoformat(),
            }
            all_processed_scans.append(scan_row)
            prev_chain = ch_hash

        bin_last_sequence[bin_id] = len(scans)
        bin_chain_head[bin_id] = prev_chain
        bin_last_seen[bin_id] = scans[-1].scanned_at.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Order all scans globally by received_at to assign global insertion_order
    all_processed_scans.sort(
        key=lambda s: (str(s["_received_dt"]), str(s["bin_id"]), int(s["sequence"]))
    )
    for idx, row in enumerate(all_processed_scans, start=1):
        row["insertion_order"] = idx

    # Separate into scans.csv rows and scans_labels.csv rows
    scans_csv_rows: list[dict[str, str | int]] = []
    labels_csv_rows: list[dict[str, str]] = []
    for s in all_processed_scans:
        scans_csv_rows.append(
            {
                "id": s["id"],
                "bin_id": s["bin_id"],
                "company_id": s["company_id"],
                "product_id": s["product_id"],
                "category": s["category"],
                "sequence": s["sequence"],
                "scanned_at": s["scanned_at"],
                "received_at": s["received_at"],
                "code_type": s["code_type"],
                "code": s["code"],
                "weight_g": s["weight_g"],
                "record_text": s["record_text"],
                "signature": s["signature"],
                "record_hash": s["record_hash"],
                "prev_chain_hash": s["prev_chain_hash"],
                "chain_hash": s["chain_hash"],
                "insertion_order": s["insertion_order"],
            }
        )
        labels_csv_rows.append(
            {
                "scan_id": str(s["id"]),
                "is_suspicious": str(s["is_suspicious"]),
                "fraud_type": str(s["fraud_type"]),
            }
        )

    # 4. Generate bins.csv
    bins_csv_rows: list[dict[str, str | int]] = []
    for bin_id, city, comp_id in bin_specs:
        bins_csv_rows.append(
            {
                "id": bin_id,
                "company_id": str(comp_id),
                "city": city,
                "public_key": "PLACEHOLDER",
                "status": "active",
                "last_sequence": bin_last_sequence[bin_id],
                "chain_head": bin_chain_head[bin_id],
                "last_seen": bin_last_seen[bin_id],
                "is_demo": "false",
            }
        )

    # 5. Generate rejected_scans.csv (exactly 60 rows)
    # DECISION: Real reason codes: 38 barcode_cooldown, 8 duplicate_sequence,
    # 8 qr_already_used, 6 unknown_product
    reasons_distribution = (
        ["barcode_cooldown"] * 38
        + ["duplicate_sequence"] * 8
        + ["qr_already_used"] * 8
        + ["unknown_product"] * 6
    )
    rejected_rows: list[dict[str, str]] = []
    for idx, reason in enumerate(reasons_distribution, start=1):
        rej_uuid = f"r{idx:07d}-0000-4000-8000-{idx:012d}"
        bin_spec = bin_specs[idx % len(bin_specs)]
        bin_id = bin_spec[0]
        comp_id = str(bin_spec[2])
        comp_prods = products_by_company[comp_id]
        prod = comp_prods[idx % len(comp_prods)]

        rej_time = ANCHOR_START_TIME + timedelta(
            seconds=int(total_window_seconds * (idx / (len(reasons_distribution) + 1)))
        )
        rej_iso = rej_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        if reason == "barcode_cooldown":
            rec_text = build_record_text(
                bin_id,
                sequence=idx + 10,
                scanned_at_iso=rej_iso,
                code_type="barcode",
                code=str(prod["barcode"]),
                weight_g=int(prod["unit_weight_g"]),
            )
        elif reason == "duplicate_sequence":
            rec_text = build_record_text(
                bin_id,
                sequence=1,  # duplicated sequence
                scanned_at_iso=rej_iso,
                code_type="barcode",
                code=str(prod["barcode"]),
                weight_g=int(prod["unit_weight_g"]),
            )
        elif reason == "qr_already_used":
            # Reusing a QR code format
            rec_text = build_record_text(
                bin_id,
                sequence=idx + 50,
                scanned_at_iso=rej_iso,
                code_type="qr",
                code=f"VBQ1.{prod['product_code']}.alreadyusedserial0000000000001",
                weight_g=int(prod["unit_weight_g"]),
            )
        else:  # unknown_product
            rec_text = build_record_text(
                bin_id,
                sequence=idx + 100,
                scanned_at_iso=rej_iso,
                code_type="barcode",
                code="8909999999994",  # unknown barcode
                weight_g=25,
            )

        rejected_rows.append(
            {
                "id": rej_uuid,
                "bin_id": bin_id,
                "record_text": rec_text,
                "reason": reason,
                "received_at": rej_iso,
            }
        )

    # 6. Write CSV files with exact column names from docs/CONTRACTS.md
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    def write_csv(filename: str, fieldnames: list[str], rows: list[dict[str, str | int]]) -> None:
        filepath = DATA_DIR / filename
        with open(filepath, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)

    write_csv("companies.csv", ["id", "name", "created_at", "is_demo"], companies)
    write_csv(
        "products.csv",
        [
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
        products,
    )
    write_csv(
        "bins.csv",
        [
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
        bins_csv_rows,
    )
    write_csv(
        "targets.csv",
        ["company_id", "financial_year", "category", "target_kg"],
        generate_targets(companies),
    )
    write_csv(
        "scans.csv",
        [
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
        scans_csv_rows,
    )
    write_csv("scans_labels.csv", ["scan_id", "is_suspicious", "fraud_type"], labels_csv_rows)
    write_csv(
        "rejected_scans.csv",
        ["id", "bin_id", "record_text", "reason", "received_at"],
        rejected_rows,
    )

    print(f"Generated mock dataset in {DATA_DIR}:")
    print(f"  companies.csv: {len(companies)} rows")
    print(f"  products.csv: {len(products)} rows")
    print(f"  bins.csv: {len(bins_csv_rows)} rows")
    print(f"  targets.csv: {len(generate_targets(companies))} rows")
    print(f"  scans.csv: {len(scans_csv_rows)} rows")
    print(f"  scans_labels.csv: {len(labels_csv_rows)} rows")
    print(f"  rejected_scans.csv: {len(rejected_rows)} rows")


if __name__ == "__main__":
    generate_mock_dataset()
