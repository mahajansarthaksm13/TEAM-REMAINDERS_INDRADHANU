# VeriBin Contracts (DRAFT v0.1)

Agreed by: Sarthak ___  Durgesh ___  Yash ___
Anything marked DECISION needs the team to confirm or change it. After sign-off, changes need all three approvals.

## 1. Global rules
- Financial year: April to March. Example: FY2026-27 runs 2026-04-01 to 2027-03-31.
- Time zone for display, periods and daily jobs: IST (Asia/Kolkata). Stored times are `timestamptz` (UTC inside).
- Weights: whole grams (`weight_g`, integer). Never floats.
- IDs: UUID for database rows, except bin IDs and QR serials (below).
- Roles: `company`, `auditor`, `regulator`, `admin`.

## 2. EPR categories (DECISION: confirm against current CPCB wording)
| Enum value | Meaning |
| --- | --- |
| `cat1_rigid` | Category I, rigid plastic packaging |
| `cat2_flexible` | Category II, flexible plastic packaging (single or multilayer films, sachets, carry bags) |
| `cat3_multilayer` | Category III, multilayer packaging with a non-plastic layer |
| `cat4_compostable` | Category IV, compostable plastic |

## 3. Identifiers
- Bin ID: `VB-<CITY3>-<NNNN>`, for example `VB-PUN-0001`. City codes: PUN, MUM, NAG (DECISION: the 3 mock cities).
- Demo bin: ID ends in `-DEMO`, for example `VB-PUN-9999`, flagged `is_demo = true`.
- QR payload (one-time code): `VBQ1.<product_code>.<serial>` where serial is 32 lowercase hex characters (128 random bits). Example: `VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596`.
- Barcode: digits only, 8 to 14 characters (EAN-8, UPC-A, EAN-13, GTIN-14).
- Product code: `P` plus 4 digits, for example `P0007`.

## 4. Scan record (the signed text)
One line of UTF-8 text, fields separated by `|`, no trailing newline, no spaces:

`v1|<bin_id>|<sequence>|<scanned_at>|<code_type>|<code>|<weight_g>`

- `v1`: format version.
- `sequence`: integer starting at 1 per bin, +1 for every scan, never reused.
- `scanned_at`: UTC, format `YYYY-MM-DDTHH:MM:SSZ`.
- `code_type`: `qr` or `barcode`.
- `code`: the full QR payload or the barcode digits.
- `weight_g`: integer grams.

Example: `v1|VB-PUN-0001|42|2026-10-25T10:30:05Z|qr|VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596|184`

## 5. Signing and hashing
- Signature: Ed25519 over the exact UTF-8 bytes of the record text. Stored and sent as standard base64.
- `record_hash` = SHA-256 of the record text bytes, lowercase hex (64 chars).
- `chain_hash` = SHA-256 of the UTF-8 string `<prev_chain_hash>:<record_hash>`, lowercase hex.
- Genesis `prev_chain_hash` for a new bin: 64 zeros.
- The server verifies the signature over the text exactly as received. It never rebuilds the text.

## 6. Ingest API
`POST <INGEST_URL>` with JSON body:
- `record`: the record text
- `signature`: base64 signature

Success response `200`: `{"status":"accepted","scan_id":"...","chain_hash":"..."}`
Rejection `4xx`: `{"status":"rejected","reason":"<reason_code>"}`

Reason codes: `bad_method`, `bad_format`, `unknown_bin`, `bin_inactive`, `bad_signature`, `time_too_far_future`, `time_too_old`, `duplicate_sequence`, `qr_already_used`, `qr_unknown`, `barcode_cooldown`, `unknown_product`, `weight_out_of_range`.

Ingest rules (from the task sheet): time window up to 5 minutes in the future and up to 7 days old (dev-only backfill flag lifts the old limit); barcode repeat cooldown 30 seconds; a QR code can be redeemed once. DECISION: weight must be within 30% of the product's `unit_weight_g`.

## 7. Tables
| Table | Key columns |
| --- | --- |
| `companies` | id, name, created_at, is_demo |
| `profiles` | user_id, role, company_id, full_name |
| `auditor_assignments` | auditor_id, company_id |
| `products` | id, company_id, product_code, name, barcode, category, unit_weight_g, approved, created_at |
| `qr_batches` | id, product_id, quantity, created_by, created_at |
| `qr_codes` | serial, batch_id, product_id, redeemed_at |
| `bins` | id (bin_id), company_id, city, public_key, status, last_sequence, chain_head, last_seen, is_demo |
| `scans` | id, bin_id, company_id, product_id, category, sequence, scanned_at, received_at, code_type, code, weight_g, record_text, signature, record_hash, prev_chain_hash, chain_hash, insertion_order |
| `rejected_scans` | id, bin_id, record_text, reason, received_at |
| `daily_totals` | day, company_id, category, bin_id, scan_count, weight_g |
| `targets` | company_id, financial_year, category, target_kg |
| `scan_flags` | scan_id, reason, severity, created_at |
| `bin_scores` | bin_id, day, score, reasons (json), scans_considered |
| `insights` | id, company_id, week_start, kind, payload (json), sentence, scan_filter (json) |
| `forecasts` | company_id, category, financial_year, as_of, projected_kg, low_kg, high_kg |
| `alerts` | id, kind, bin_id, company_id, message, opened_at, closed_at |
| `checkpoints` | day, hash, previous_hash, created_at |
| `reports` | id, company_id, category, period_start, period_end, fingerprint, checkpoint_day, storage_path, created_at |

`status` for bins: `active`, `revoked`. Alert `kind`: `bin_offline`, `sequence_gap`, `anomaly`, `target_at_risk`, `chain_break`.

## 8. Read functions (called by the web app)
DECISION: names below, Durgesh may rename before sign-off.
- `get_kpis_by_category(p_from date, p_to date)`
- `get_monthly_trend(p_from date, p_to date)`
- `get_bin_list()`
- `get_public_stats()`
- `issue_qr_codes(p_product_id uuid, p_quantity int)`
- `get_report_snapshot(p_category, p_from, p_to)`
- `verify_report(p_report_id uuid)`
- `verify_chain(p_bin_id text)`

## 9. Realtime channels
- `company:<company_id>`: private, one per company.
- `demo`: public, demo bin only.
- Broadcast event name: `scan`. Payload: scan_id, bin_id, product_id, category, weight_g, scanned_at, chain_hash.

## 10. Mock data files (data/)
CSV column names equal the table column names above. Extra files:
- `scans_labels.csv`: scan_id, is_suspicious, fraud_type
- fraud_type values: `burst_rescan`, `very_low_weight`, `wrong_category_weight`, `night_burst`, `replay`
