"""D7 · Create the test logins (local or dev). Never commit passwords.

    SUPABASE_URL=http://127.0.0.1:54321 \
    SUPABASE_SERVICE_ROLE_KEY=<service role key> \
    TEST_USER_PASSWORD=<from password manager> \
    python database/scripts/create_test_users.py

Creates (or reuses) one login per mock company, one auditor assigned to the
first company, one regulator and one admin, and writes their profiles.
Emails: company1@veribin.test, company2@..., auditor@, regulator@, admin@
Run AFTER the seed, because company users point at seeded companies.
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PASSWORD = os.environ.get("TEST_USER_PASSWORD", "")
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def get_or_create_user(email: str) -> str:
    res = requests.post(f"{URL}/auth/v1/admin/users", headers=HEADERS, timeout=15,
                        json={"email": email, "password": PASSWORD, "email_confirm": True})
    if res.status_code in (200, 201):
        return res.json()["id"]
    # Already exists: find it
    page = requests.get(f"{URL}/auth/v1/admin/users?per_page=1000", headers=HEADERS, timeout=15)
    page.raise_for_status()
    for user in page.json().get("users", []):
        if user["email"] == email:
            return user["id"]
    sys.exit(f"could not create or find {email}: {res.status_code} {res.text}")


def upsert(table: str, row: dict) -> None:
    res = requests.post(f"{URL}/rest/v1/{table}", timeout=15, json=row,
                        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"})
    if res.status_code not in (200, 201, 204):
        sys.exit(f"{table}: {res.status_code} {res.text}")


def main() -> None:
    if not (URL and KEY and PASSWORD):
        sys.exit("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and TEST_USER_PASSWORD.")
    with open(ROOT / "data" / "companies.csv", newline="", encoding="utf-8") as f:
        companies = [c for c in csv.DictReader(f) if c["is_demo"].lower() != "true"]

    for i, company in enumerate(companies, start=1):
        uid = get_or_create_user(f"company{i}@veribin.test")
        upsert("profiles", {"user_id": uid, "role": "company", "company_id": company["id"],
                            "full_name": f"{company['name']} user"})
        print(f"company{i}@veribin.test -> {company['name']}")

    auditor = get_or_create_user("auditor@veribin.test")
    upsert("profiles", {"user_id": auditor, "role": "auditor", "full_name": "Test auditor"})
    upsert("auditor_assignments", {"auditor_id": auditor, "company_id": companies[0]["id"]})
    print(f"auditor@veribin.test -> assigned to {companies[0]['name']}")

    for role in ("regulator", "admin"):
        uid = get_or_create_user(f"{role}@veribin.test")
        upsert("profiles", {"user_id": uid, "role": role, "full_name": f"Test {role}"})
        print(f"{role}@veribin.test")


if __name__ == "__main__":
    main()
