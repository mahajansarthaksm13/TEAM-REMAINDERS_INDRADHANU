"""CLI tool to generate Ed25519 keypairs for VeriBin bins (Task Y5).

Stores private keys locally in simulator/keys/<bin_id>.key (git-ignored).
Exports public keys to data/bin_public_keys.csv (safe to commit).
Never prints or exposes private keys.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

# Add simulator root to sys.path so veribin_sim can be imported directly
SIMULATOR_ROOT = Path(__file__).resolve().parent
if str(SIMULATOR_ROOT) not in sys.path:
    sys.path.insert(0, str(SIMULATOR_ROOT))

from veribin_sim.keys import (  # noqa: E402
    DEFAULT_KEYS_DIR,
    generate_keypair,
    save_private_key,
)

# Seed bins from Task Y2
SEED_BINS: list[str] = [
    "VB-PUN-0001",
    "VB-PUN-0002",
    "VB-MUM-0001",
    "VB-MUM-0002",
    "VB-NAG-0001",
    "VB-NAG-0002",
]

# CI and test bins for Task Y7
CI_TEST_BIN: str = "VB-PUN-0900"
# DECISION: Two extra test bins for Task Y7 suite
REVOKED_TEST_BIN: str = "VB-PUN-0901"
ACTIVE_TEST_BIN_2: str = "VB-PUN-0902"

DEFAULT_BINS: list[str] = SEED_BINS + [
    CI_TEST_BIN,
    REVOKED_TEST_BIN,
    ACTIVE_TEST_BIN_2,
]

DEFAULT_CSV_PATH: Path = SIMULATOR_ROOT.parent / "data" / "bin_public_keys.csv"


def resolve_bin_ids(
    bin_id: str | None,
    count: int | None,
    prefix: str | None,
) -> list[str]:
    """Resolve the list of bin IDs to process based on CLI arguments."""
    if bin_id:
        return [bin_id]

    if count is not None:
        if count <= 0:
            raise ValueError(f"--count must be a positive integer, got {count}")
        pref = prefix or "VB-PUN-08"
        bin_list: list[str] = []
        for i in range(1, count + 1):
            if len(pref.split("-")) == 3 and len(pref.split("-")[2]) == 2:
                # e.g., 'VB-PUN-08' -> 'VB-PUN-0801'
                resolved = f"{pref}{i:02d}"
            elif pref.endswith("-"):
                resolved = f"{pref}{i:04d}"
            else:
                resolved = f"{pref}-{i:04d}"
            bin_list.append(resolved)
        return bin_list

    return list(DEFAULT_BINS)


def main() -> int:
    """CLI entrypoint for keygen."""
    parser = argparse.ArgumentParser(
        description="Generate Ed25519 keys for VeriBin bins.",
    )
    parser.add_argument(
        "--bin-id",
        type=str,
        default=None,
        help="Generate key for a single bin ID (e.g., VB-PUN-0001).",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=None,
        help="Generate N keys (used with --prefix for load testing).",
    )
    parser.add_argument(
        "--prefix",
        type=str,
        default=None,
        help="Prefix for numbered bins (e.g., VB-PUN-08).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing private key files.",
    )
    parser.add_argument(
        "--keys-dir",
        type=Path,
        default=DEFAULT_KEYS_DIR,
        help="Directory to store private keys (default: simulator/keys).",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help="Path to output public keys CSV (default: data/bin_public_keys.csv).",
    )

    args = parser.parse_args()

    try:
        bin_ids = resolve_bin_ids(args.bin_id, args.count, args.prefix)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    keys_dir = Path(args.keys_dir)
    keys_dir.mkdir(parents=True, exist_ok=True)

    # Check for existing key files if not force
    if not args.force:
        existing = [b for b in bin_ids if (keys_dir / f"{b}.key").exists()]
        if existing:
            first_few = ", ".join(existing[:5])
            suffix = "..." if len(existing) > 5 else ""
            print(
                f"Error: Key files already exist for {len(existing)} bin(s): {first_few}{suffix}. "
                "Use --force to overwrite.",
                file=sys.stderr,
            )
            return 1

    # Load existing public keys if modifying a subset
    public_keys_map: dict[str, str] = {}
    csv_path = Path(args.output_csv)
    if csv_path.exists() and (args.bin_id or args.count):
        try:
            with csv_path.open("r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if "bin_id" in row and "public_key" in row:
                        public_keys_map[row["bin_id"]] = row["public_key"]
        except Exception:
            pass

    # Generate or reload keys
    results: list[tuple[str, str]] = []
    for b_id in bin_ids:
        priv, pub_b64 = generate_keypair()
        save_private_key(b_id, priv, keys_dir=keys_dir, force=args.force)
        public_keys_map[b_id] = pub_b64
        results.append((b_id, pub_b64))

    # Write public keys to CSV (safe to commit)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["bin_id", "public_key"])
        for b_id, pub_b64 in sorted(public_keys_map.items()):
            writer.writerow([b_id, pub_b64])

    # Print table of bin_id and public_key (NO private keys printed)
    print(f"\nGenerated Ed25519 keys for {len(results)} bin(s):")
    print(f"{'Bin ID':<16} | {'Public Key (Base64 32-bytes)':<48}")
    print("-" * 68)
    for b_id, pub_b64 in results:
        print(f"{b_id:<16} | {pub_b64:<48}")
    print("-" * 68)
    print(f"Public keys saved to: {csv_path.resolve()}")
    print(f"Private keys saved to: {keys_dir.resolve()} (mode 0600, git-ignored)")

    # Print reminder for CI test bin
    if any(b_id == CI_TEST_BIN for b_id in bin_ids):
        print(
            f"\n[REMINDER] Store the private key for CI test bin '{CI_TEST_BIN}' "
            f"(located in {keys_dir / f'{CI_TEST_BIN}.key'}) as the "
            "TEST_BIN_PRIVATE_KEY secret in GitHub Actions."
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
