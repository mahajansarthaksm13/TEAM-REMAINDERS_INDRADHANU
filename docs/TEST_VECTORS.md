# VeriBin Cryptographic Test Vectors

This document defines canonical cryptographic test vectors for VeriBin records, signatures, and hash chains.

Edge Functions (Deno / TypeScript), database routines, and external simulators must all verify against these exact bytes and hashes.

---

## 1. Test Keypair

- **Private Key Raw Seed (32 bytes hex):**
  ```
  0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
  ```
- **Private Key (Base64 of 32 raw bytes):**
  ```
  ASNFZ4mrze8BI0VniavN7wEjRWeJq83vASNFZ4mrze8=
  ```
- **Public Key Raw Bytes (32 bytes hex):**
  ```
  207a067892821e25d770f1fba0c47c11ff4b813e54162ece9eb839e076231ab6
  ```
- **Public Key (Base64 of 32 raw bytes):**
  ```
  IHoGeJKCHiXXcPH7oMR8Ef9LgT5UFi7Onrg54HYjGrY=
  ```

---

## 2. Sample Record

- **Fields:**
  - `bin_id`: `VB-PUN-0001`
  - `sequence`: `1`
  - `scanned_at`: `2026-10-25T10:30:05Z`
  - `code_type`: `qr`
  - `code`: `VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596`
  - `weight_g`: `184`

- **Canonical Record Text (exact UTF-8 string, no trailing newline, no spaces):**
  ```
  v1|VB-PUN-0001|1|2026-10-25T10:30:05Z|qr|VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596|184
  ```

---

## 3. Signature (Ed25519)

Signed over the exact UTF-8 bytes of the canonical record text above using the Ed25519 private key seed.

- **Signature (Standard Base64 of 64 raw signature bytes):**
  ```
  kUjZsgjn0bRIIXxDvAqsUjAAPYyLwFgPf3zR2T9oX22KLEBN3gJ74PSwH/2QPdPEDfNxn7ZboJqjHk1FsDp/AA==
  ```

---

## 4. Record Hash & Chain Hash (SHA-256)

1. **`record_hash`**: SHA-256 of the UTF-8 bytes of `record_text` (lowercase hex):
   ```
   41f4874be7625d29b3d9063dd1911d3ccc89f9a4ffdc2574fe36a727fceb3826
   ```

2. **`prev_chain_hash` (Genesis):** 64 zeros:
   ```
   0000000000000000000000000000000000000000000000000000000000000000
   ```

3. **`chain_hash`**: SHA-256 of `<prev_chain_hash>:<record_hash>` (lowercase hex):
   - Input payload string:
     `0000000000000000000000000000000000000000000000000000000000000000:41f4874be7625d29b3d9063dd1911d3ccc89f9a4ffdc2574fe36a727fceb3826`
   - Output hash:
     ```
     81e0742e16e782d4813cdd8eae9a0454ee47bd157964aa8d8903fe4c3b0d6d92
     ```
