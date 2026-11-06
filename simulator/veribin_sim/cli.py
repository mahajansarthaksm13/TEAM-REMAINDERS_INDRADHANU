"""VeriBin bin simulator (Y6), contract v1.

Builds and signs records ONLY through veribin_sim.record (the same helpers the
tests and the contract use), and posts them to the ingest Edge Function as
    {"record": "<v1 text>", "signature": "<base64 Ed25519>"}

Run from the repo root:
    python -m veribin_sim.cli --bin VB-PUN-0001 --mode live --count 20
    python -m veribin_sim.cli --bin VB-PUN-0001 --mode fraud
    python -m veribin_sim.cli --bin VB-PUN-0001 --mode live --dry-run   # print, don't send
(PYTHONPATH must include simulator/, e.g.  PYTHONPATH=simulator python -m ...)

Environment:
    INGEST_URL     default http://127.0.0.1:54321/functions/v1/ingest
    HEARTBEAT_URL  default http://127.0.0.1:54321/functions/v1/heartbeat

Local files (both git-ignored):
    simulator/keys/<bin_id>.key     private key from keygen.py
    simulator/state/<bin_id>.json   {"sequence": <last sequence used>}
    simulator/state/labels.csv      ground truth for every record sent (Y15)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import requests

from veribin_sim.keys import load_private_key
from veribin_sim.record import build_record, sign_record

REPO_ROOT = Path(__file__).resolve().parents[2]
KEYS_DIR = REPO_ROOT / "simulator" / "keys"
STATE_DIR = REPO_ROOT / "simulator" / "state"
LABELS_FILE = STATE_DIR / "labels.csv"
BINS_CSV = REPO_ROOT / "data" / "bins.csv"
PRODUCTS_CSV = REPO_ROOT / "data" / "products.csv"

INGEST_URL = os.getenv("INGEST_URL", "http://127.0.0.1:54321/functions/v1/ingest")
HEARTBEAT_URL = os.getenv("HEARTBEAT_URL", "http://127.0.0.1:54321/functions/v1/heartbeat")

BARCODE_COOLDOWN_S = 30
IST = timedelta(hours=5, minutes=30)


@dataclass
class Product:
    product_code: str
    barcode: str
    category: str
    unit_weight_g: int


@dataclass
class Signed:
    record: str
    signature: str
    label: str


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------

def utc_stamp(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_products_for_bin(bin_id: str) -> list[Product]:
    company_id = None
    with open(BINS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["id"] == bin_id:
                company_id = row["company_id"]
    if company_id is None:
        sys.exit(f"{bin_id} is not in {BINS_CSV}. Use one of the seeded bins.")
    products = []
    with open(PRODUCTS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            usable = row["approved"].lower() == "true" and row["barcode"]
            if row["company_id"] == company_id and usable:
                products.append(Product(row["product_code"], row["barcode"],
                                        row["category"], int(row["unit_weight_g"])))
    if not products:
        sys.exit(f"No approved products with barcodes for the company of {bin_id}.")
    return products


def next_sequence(bin_id: str) -> int:
    """Reserve the next sequence number and save it BEFORE signing, so a crash
    can never reuse a sequence."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    path = STATE_DIR / f"{bin_id}.json"
    state = json.loads(path.read_text()) if path.exists() else {"sequence": 0}
    state["sequence"] += 1
    path.write_text(json.dumps(state))
    return state["sequence"]


def log_label(bin_id: str, record: str, label: str) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    new = not LABELS_FILE.exists()
    with open(LABELS_FILE, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["bin_id", "sequence", "fraud_type", "record_text"])
        w.writerow([bin_id, record.split("|")[2], label, record])


# ---------------------------------------------------------------------------
# Building and sending
# ---------------------------------------------------------------------------

class Bin:
    def __init__(self, bin_id: str, dry_run: bool) -> None:
        self.bin_id = bin_id
        self.key = load_private_key(bin_id, keys_dir=KEYS_DIR)
        self.products = load_products_for_bin(bin_id)
        self.dry_run = dry_run
        self.last_used: dict[str, datetime] = {}

    def pick_product(self, at: datetime) -> Product:
        """A product whose barcode was not used on this bin in the last 30 s,
        so normal scans never trip barcode_cooldown."""
        never = datetime.min.replace(tzinfo=UTC)
        free = [p for p in self.products
                if (at - self.last_used.get(p.barcode, never)).total_seconds() > BARCODE_COOLDOWN_S]
        product = random.choice(free or self.products)
        self.last_used[product.barcode] = at
        return product

    def make(self, at: datetime, product: Product, weight_g: int, label: str) -> Signed:
        record = build_record(self.bin_id, next_sequence(self.bin_id), utc_stamp(at),
                              "barcode", product.barcode, max(1, weight_g))
        log_label(self.bin_id, record, label)
        return Signed(record, sign_record(self.key, record), label)

    def normal(self, at: datetime, label: str = "normal") -> Signed:
        p = self.pick_product(at)
        weight = round(p.unit_weight_g * random.uniform(0.9, 1.1))
        return self.make(at, p, weight, label)

    def send(self, s: Signed) -> dict:
        body = {"record": s.record, "signature": s.signature}
        if self.dry_run:
            print(json.dumps(body))
            return {"status": "dry_run"}
        try:
            res = requests.post(INGEST_URL, json=body, timeout=10)
            out = res.json()
        except Exception as exc:  # noqa: BLE001 - print and keep going
            out = {"status": "error", "reason": str(exc)}
        print(f"{out.get('status', '?'):9} {out.get('reason', ''):20} {s.label:22} {s.record}")
        return out


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

def mode_live(b: Bin, count: int, delay: float) -> None:
    for _ in range(count):
        b.send(b.normal(datetime.now(UTC)))
        time.sleep(delay)


def mode_offline(b: Bin, count: int) -> None:
    """Queue while 'offline', then flush. Sends the queue in a shuffled order
    to prove out-of-order sync is accepted."""
    queue = []
    for _ in range(count):
        queue.append(b.normal(datetime.now(UTC), "offline_queued"))
        time.sleep(1)
    random.shuffle(queue)
    for s in queue:
        b.send(s)


def mode_fraud(b: Bin) -> None:
    # Everything is placed in the last 20 minutes: ingest rejects times more
    # than 5 minutes in the future.
    now = datetime.now(UTC) - timedelta(minutes=20)
    # burst_rescan: different products, 1 second apart (a script, not a person)
    for i in range(min(6, len(b.products))):
        b.send(b.normal(now + timedelta(seconds=i), "burst_rescan"))
    # very_low_weight: 1-2 g against a catalogue weight of 10+ g
    # (only products of 10 g or more, so 1-2 g is clearly under 20% of the catalogue weight)
    heavy = [p for p in b.products if p.unit_weight_g >= 10] or b.products
    for i in range(5):
        at = now + timedelta(minutes=1, seconds=40 * i)
        p = heavy[i % len(heavy)]
        b.send(b.make(at, p, random.randint(1, 2), "very_low_weight"))
    # wrong_category_weight: 4-5x the catalogue weight (rule flags > 3x)
    for i in range(5):
        at = now + timedelta(minutes=5, seconds=40 * i)
        p = b.pick_product(at)
        b.send(b.make(at, p, p.unit_weight_g * random.randint(4, 5), "wrong_category_weight"))
    # night_burst: 02:00-03:00 IST last night (inside the 7-day window)
    last_night = (now + IST).replace(hour=2, minute=0, second=0, microsecond=0) - IST
    if last_night > now:
        last_night -= timedelta(days=1)
    for i in range(8):
        b.send(b.normal(last_night + timedelta(minutes=7 * i), "night_burst"))
    # replay: send an already-accepted signed record again
    original = b.normal(now + timedelta(minutes=10))
    b.send(original)
    b.send(Signed(original.record, original.signature, "replay"))  # expect duplicate_sequence
    log_label(b.bin_id, original.record, "replay")


def mode_backfill(b: Bin, days: int, per_day: int) -> None:
    """Only for bins seeded with allow_backfill = true (dev). Oldest first."""
    start = datetime.now(UTC) - timedelta(days=days)
    for d in range(days):
        for _ in range(per_day):
            at = start + timedelta(days=d, hours=random.randint(4, 15),
                                   minutes=random.randint(0, 59))
            b.send(b.normal(at, "backfill"))


def mode_heartbeat(b: Bin) -> None:
    message = f"hb1|{b.bin_id}|{utc_stamp(datetime.now(UTC))}"
    body = {"message": message, "signature": sign_record(b.key, message)}
    if b.dry_run:
        print(json.dumps(body))
        return
    res = requests.post(HEARTBEAT_URL, json=body, timeout=10)
    print(res.status_code, res.text)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description="VeriBin bin simulator (contract v1)")
    ap.add_argument("--bin", required=True, help="Seeded bin id, e.g. VB-PUN-0001")
    ap.add_argument("--mode", default="live",
                    choices=["live", "offline", "fraud", "backfill", "heartbeat"])
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--delay", type=float, default=3.0, help="seconds between live scans")
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--per-day", type=int, default=5)
    ap.add_argument("--dry-run", action="store_true",
                    help="print request bodies instead of sending")
    args = ap.parse_args(argv)

    b = Bin(args.bin, args.dry_run)
    if args.mode == "live":
        mode_live(b, args.count, args.delay)
    elif args.mode == "offline":
        mode_offline(b, args.count)
    elif args.mode == "fraud":
        mode_fraud(b)
    elif args.mode == "backfill":
        mode_backfill(b, args.days, args.per_day)
    else:
        mode_heartbeat(b)


if __name__ == "__main__":
    main()
