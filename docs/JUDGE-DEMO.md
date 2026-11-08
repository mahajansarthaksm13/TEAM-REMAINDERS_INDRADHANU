# Judge demo: the 3-minute VeriBin run

Open **`/simulator`**; no login is needed. Everything below runs against the real backend. The demo bin `VB-PUN-9999-DEMO` signs records, the ingest function checks the signature, and the ledger chains each record. Only the bin's camera and scale are simulated, and they are labelled as simulated on screen.

## Before you start (30 seconds)
- Run **A. Genuine deposit** once, so scenario D has a used code to reuse.
- If you are running locally, the ingest Edge Function must be running. See "Local setup" below.

## The script

| Time | Say | Do | What the judges see |
|---|---|---|---|
| 0:00 | "Today a scan, or a certificate, is counted as collected plastic. Nobody checks that the packet actually went in." | Point at the headline. | "A scan is not a deposit." |
| 0:20 | "In VeriBin a scan only unlocks the bin. Watch." | **Run complete deposit** (scenario A) | The QR appears and the server says the code is registered. The lid opens, the bottle drops past the camera and the scale reads 24 g. **Deposit verified and counted.** The receipt appears and the live feed updates without a refresh. |
| 1:00 | "Now let's try to cheat." | **B. Fake QR code** | The lid shakes and stays shut ("unknown code"). Nothing is recorded. |
| 1:15 | | **D. Reused code** | The lid stays shut ("code already used"). One code, one deposit. |
| 1:30 | "What if someone scans and walks away?" | **C. Scan, but no deposit** | The lid opens, the camera sees nothing and the scale doesn't move. **Not counted.** The pending entry is rejected and the code stays unused. |
| 1:50 | "Or puts in the wrong thing?" | **E. Wrong weight** | The camera sees an item, but it weighs 96 g instead of about 24 g. **Recorded, but sent for review**, and kept out of reports. |
| 2:10 | "Don't trust us. Check it." | In the receipt: **Verify in browser**, then tick **Tamper with it** and verify again | ✓ Signature valid and the chain hash matches. After tampering: ✗ the signature fails and the chain hash no longer matches. The edit is detected. Only the browser copy changes, never the ledger. |
| 2:30 | "Five attempts. A scan-counting system would have counted five. VeriBin counted one." | Point at the **Why it matters** scoreboard. | "a scan-counter would count: 5" next to "VeriBin counted: 1". |
| 2:45 | "The same two-step protocol is what a real ESP32 bin will speak. Next in the chain: pickup, transport, recycler receipt and processing." | Scroll to "What happens next". | The roadmap strip, honestly labelled. |

## What is real and what is simulated

- **Real:**
  - the code check: `open_deposit_session`, the same rules as the ledger;
  - the deposit policy: `decide_deposit`, which runs in the database;
  - the Ed25519 signature;
  - the ingest Edge Function and `ingest_scan`;
  - one-time QR redemption, the hash chain and the realtime broadcast.
- **Simulated (in the browser):**
  - the lid motor;
  - the camera's "item crossed the opening" result;
  - the scale reading.
- **Excluded:** demo deposits never count toward company or national totals.

## Local setup
1. Start Supabase as usual. Then apply migrations up to `20261110090000_deposit_sessions.sql`.
2. The ingest Edge Function must be reachable at `${SUPABASE_URL}/functions/v1/ingest` (or set `INGEST_URL`).
3. `web/.env.local` needs `SUPABASE_SERVICE_ROLE_KEY` and `DEMO_BIN_PRIVATE_KEY`. The demo key is the base64 seed from `simulator/keys/VB-PUN-9999-DEMO.key`, and its public key must match the demo bin's `public_key`.
4. The demo catalogue (one product per EPR category) is created automatically on first load by `ensure_demo_catalogue()`.
