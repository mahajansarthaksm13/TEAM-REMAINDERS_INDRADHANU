# VeriBin Mock Dataset (Task Y2)

This directory contains deterministic mock EPR data for VeriBin development, testing, AI model training, and database seeding.

All column names, reason codes, identifier formats, and cryptographic chaining strictly follow [`docs/CONTRACTS.md`](../docs/CONTRACTS.md).

---

## Files

| File | Rows | Description | Schema / Columns |
|---|---|---|---|
| `companies.csv` | 3 | Producer companies reporting EPR data | `id, name, created_at, is_demo` |
| `products.csv` | 15 | Products across all 4 EPR categories (4/4/4/3) with valid EAN-13 barcodes | `id, company_id, product_code, name, barcode, category, unit_weight_g, approved, created_at` |
| `bins.csv` | 6 | Smart bins in 3 cities (2 in PUN, 2 in MUM, 2 in NAG). Real public keys added in Y5 | `id, company_id, city, public_key, status, last_sequence, chain_head, last_seen, is_demo` |
| `targets.csv` | 12 | Annual EPR collection targets per company and category (FY 2026-27) | `company_id, financial_year, category, target_kg` |
| `scans.csv` | 2,000 | Scans over the last 90 days with gap-free sequence, Ed25519 signature, SHA-256 record hash and chain hash | `id, bin_id, company_id, product_id, category, sequence, scanned_at, received_at, code_type, code, weight_g, record_text, signature, record_hash, prev_chain_hash, chain_hash, insertion_order` |
| `scans_labels.csv` | 2,000 | Ground-truth labels for AI detector development (Task Y4/Y11/Y15) | `scan_id, is_suspicious, fraud_type` |
| `rejected_scans.csv` | 60 | Ingest rejection logs with realistic reason codes | `id, bin_id, record_text, reason, received_at` |

---

## Dataset Characteristics

- **Seed**: `42` (pure standard library plus `cryptography` for Ed25519 signing).
- **Time window**: 90 days ending `2026-10-26T23:59:59Z`.
- **EPR Categories**:
  - `cat1_rigid`: 4 products (water bottle 22g, milk can 42g, detergent bottle 48g, syrup jug 54g)
  - `cat2_flexible`: 4 products (chips packet 6g, carry bag 9g, bread wrap 4g, peas pouch 8g)
  - `cat3_multilayer`: 4 products (shampoo sachet 3g, juice carton 12g, biscuit wrap 7g, coffee pouch 15g)
  - `cat4_compostable`: 3 products (bio carry bag 8g, PLA food container 28g, cutlery pack 18g)
- **Bins**:
  - Pune: `VB-PUN-0001`, `VB-PUN-0002`
  - Mumbai: `VB-MUM-0001`, `VB-MUM-0002`
  - Nagpur: `VB-NAG-0001`, `VB-NAG-0002`
- **Planted Suspicious Scans**:
  - Exactly **50 suspicious scans** (10 of each of the 5 fraud types), concentrated on planted bins `VB-PUN-0002`, `VB-MUM-0002`, and `VB-NAG-0002`:
    - `burst_rescan` (10 scans): 2 runs of 5 scans of different barcodes < 3 seconds apart.
    - `very_low_weight` (10 scans): weight 1 to 4 g for products with unit weight $\ge$ 10 g.
    - `wrong_category_weight` (10 scans): weight is 3× to 6× product unit weight (capped at 5000 g).
    - `night_burst` (10 scans): 2 runs of 5 scans between 01:00 and 04:00 IST within 2 minutes.
    - `replay` (10 scans): 2 runs of 5 scans of identical barcode and weight at exact 60-second intervals.
  - Bins `VB-PUN-0001`, `VB-MUM-0001`, and `VB-NAG-0001` remain completely clean.
- **Rejected Scans**:
  - Exactly 60 rejected scans using contract reason codes: `barcode_cooldown` (38), `duplicate_sequence` (8), `qr_already_used` (8), `unknown_product` (6).

---

## How to Regenerate and Validate

To regenerate the CSV files deterministically:
```bash
.venv\Scripts\python.exe data/generate_mock.py
```
*(or `python data/generate_mock.py` if the virtual environment is activated)*

To run all integrity and contract validation checks:
```bash
.venv\Scripts\python.exe data/validate_mock.py
```
*(must print `ALL CHECKS PASSED` with exit code `0`)*
