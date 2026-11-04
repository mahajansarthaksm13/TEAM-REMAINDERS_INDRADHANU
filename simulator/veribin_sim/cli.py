import argparse
import csv
import json
import os
import random
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric import ed25519
import requests

STATE_FILE = Path("simulator/veribin_sim/sim_state.json")
LABELS_FILE = Path("data/sim_labels.csv")
PUBLIC_KEYS_FILE = Path("data/bin_public_keys.csv")

# Supabase Edge Ingest URL (Default local / dev endpoint)
INGEST_URL = os.getenv("INGEST_URL", "http://127.0.0.1:54321/functions/v1/ingest")


def load_or_create_state():
    """Load local sequence counter and Ed25519 key state."""
    if STATE_FILE.exists():
        with open(STATE_FILE, "r") as f:
            return json.load(f)

    # Generate a default keypair if state file does not exist
    priv_key = ed25519.Ed25519PrivateKey.generate()
    priv_hex = priv_key.private_bytes_raw().hex()
    pub_hex = priv_key.public_key().public_bytes_raw().hex()

    state = {
        "bin_id": "BIN-001",
        "sequence": 0,
        "private_key_hex": priv_hex,
        "public_key_hex": pub_hex,
    }
    save_state(state)
    return state


def save_state(state):
    """Save updated sequence counter and key state locally."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def sign_payload(raw_text: str, private_key_hex: str) -> str:
    """Sign raw text line using Ed25519 private key."""
    priv_bytes = bytes.fromhex(private_key_hex)
    priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(priv_bytes)
    sig_bytes = priv_key.sign(raw_text.encode("utf-8"))
    return sig_bytes.hex()


def create_scan_record(state, weight_g=250, product_id="PROD-001", ts=None, anomaly_label="normal"):
    """Construct, sign, and increment sequence for a scan event."""
    state["sequence"] += 1
    seq = state["sequence"]

    if ts is None:
        ts = datetime.now(timezone.utc).isoformat()

    bin_id = state["bin_id"]
    raw_text = f"{ts}|{bin_id}|{product_id}|{seq}|{weight_g}"
    signature = sign_payload(raw_text, state["private_key_hex"])

    save_state(state)

    scan_data = {
        "raw_text": raw_text,
        "signature": signature,
        "public_key": state["public_key_hex"],
        "anomaly_label": anomaly_label,
    }

    log_label(raw_text, anomaly_label)
    return scan_data


def log_label(raw_text, label):
    """Append every generated scan record and truth label to data/sim_labels.csv."""
    LABELS_FILE.parent.mkdir(parents=True, exist_ok=True)
    file_exists = LABELS_FILE.exists()

    with open(LABELS_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["raw_text", "label", "timestamp"])
        writer.writerow([raw_text, label, datetime.now(timezone.utc).isoformat()])


def send_to_ingest(scan_data):
    """POST signed payload to Supabase Edge Ingest Function."""
    payload = {
        "raw_text": scan_data["raw_text"],
        "signature": scan_data["signature"],
        "public_key": scan_data["public_key"],
    }
    try:
        res = requests.post(INGEST_URL, json=payload, timeout=5)
        print(
            f"[{res.status_code}] Sent: {scan_data['raw_text']} "
            f"| Label: {scan_data['anomaly_label']}"
        )
    except requests.RequestException as e:
        print(f"[ERR] Failed to post scan: {e}")


# --- EXECUTION MODES ---


def run_live_mode(state, count=10, delay=2):
    """Stream real-time scans every few seconds."""
    print(f"--- Running LIVE mode ({count} scans, delay {delay}s) ---")
    for _ in range(count):
        scan = create_scan_record(
            state, weight_g=random.randint(200, 500), anomaly_label="normal"
        )
        send_to_ingest(scan)
        time.sleep(delay)


def run_offline_mode(state, queue_size=20):
    """Buffer scans locally in a queue before flushing."""
    print(f"--- Running OFFLINE mode (Queueing {queue_size} scans) ---")
    queue = []
    for _ in range(queue_size):
        scan = create_scan_record(
            state, weight_g=random.randint(180, 450), anomaly_label="offline_queued"
        )
        queue.append(scan)

    print(f"Flushing {len(queue)} offline scans to ingest endpoint...")
    for scan in queue:
        send_to_ingest(scan)


def run_fraud_mode(state):
    """Generate anomalous scan events (low weight, odd hours, burst rescans)."""
    print("--- Running FRAUD simulation mode ---")

    # 1. Very low weight scan
    print("Simulating: Low weight anomaly")
    scan1 = create_scan_record(state, weight_g=5, anomaly_label="very_low_weight")
    send_to_ingest(scan1)

    # 2. Odd hours scan (3:00 AM)
    print("Simulating: Odd hours anomaly")
    odd_ts = datetime.now(timezone.utc).replace(hour=3, minute=15).isoformat()
    scan2 = create_scan_record(state, weight_g=300, ts=odd_ts, anomaly_label="odd_hours")
    send_to_ingest(scan2)

    # 3. Burst rescans (< 3 seconds apart)
    print("Simulating: Rapid burst rescans")
    for _ in range(3):
        scan3 = create_scan_record(state, weight_g=250, anomaly_label="burst_rescan")
        send_to_ingest(scan3)
        time.sleep(0.5)


def run_backfill_mode(state, days=90, scans_per_day=5):
    """Populate historical scan records spanning back up to 90 days."""
    print(f"--- Running BACKFILL mode ({days} days) ---")
    now = datetime.now(timezone.utc)
    for d in range(days, 0, -1):
        day_date = now - timedelta(days=d)
        for _ in range(scans_per_day):
            ts = (day_date + timedelta(hours=random.randint(8, 18))).isoformat()
            scan = create_scan_record(
                state,
                weight_g=random.randint(200, 600),
                ts=ts,
                anomaly_label="backfill_historical",
            )
            send_to_ingest(scan)


def main():
    parser = argparse.ArgumentParser(description="VeriBin CLI Smart Bin Simulator")
    parser.add_argument(
        "--mode",
        choices=["live", "offline", "fraud", "backfill"],
        default="live",
        help="Simulator execution mode",
    )
    args = parser.parse_args()

    state = load_or_create_state()

    if args.mode == "live":
        run_live_mode(state)
    elif args.mode == "offline":
        run_offline_mode(state)
    elif args.mode == "fraud":
        run_fraud_mode(state)
    elif args.mode == "backfill":
        run_backfill_mode(state)


if __name__ == "__main__":
    main()
