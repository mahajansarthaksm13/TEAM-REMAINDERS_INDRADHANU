# Collection Evidence Report Specification (REPORT-SPEC.md)

## Title
Collection Evidence Report

## Target Audience
EPR Regulators, Auditors, and Corporate Sustainability Officers.

## Layout & Required Fields
1. **Header**: Title, Report ID, Verification URL, Issue Timestamp (IST).
2. **Company Information**: Company Name, Registration ID, Selected EPR Category, Period (April-March Financial Year).
3. **Audit Summary**:
   - Total Scans Included
   - Barcode-tier Total Weight (kg)
   - QR-tier Total Weight (kg)
   - Scans Under Review Count
4. **Cryptographic Proof**:
   - Checkpoint Day & Hash
   - Snapshot Chain Fingerprint (SHA-256 hash over included scan chain hashes)
   - Printable Verification QR Code
