"""Unit tests for simulator/keygen.py and simulator/veribin_sim/keys.py (Task Y5)."""

from __future__ import annotations

import base64
import csv
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from keygen import (
    ACTIVE_TEST_BIN_2,
    CI_TEST_BIN,
    REVOKED_TEST_BIN,
    SEED_BINS,
    main,
    resolve_bin_ids,
)
from veribin_sim.keys import (
    generate_keypair,
    load_private_key,
    load_private_key_b64,
    load_public_key_b64,
    private_key_to_b64,
    public_key_to_b64,
    save_private_key,
)


def test_generate_keypair() -> None:
    """generate_keypair returns private key instance and valid base64 public key."""
    priv, pub_b64 = generate_keypair()
    assert isinstance(priv, Ed25519PrivateKey)
    raw_pub = base64.b64decode(pub_b64)
    assert len(raw_pub) == 32


def test_save_and_load_private_key(tmp_path: Path) -> None:
    """save_private_key writes 32-byte b64 key and load_private_key reads it back."""
    priv, pub_b64 = generate_keypair()
    bin_id = "VB-PUN-0001"
    key_path = save_private_key(bin_id, priv, keys_dir=tmp_path)

    assert key_path.exists()
    assert key_path.name == "VB-PUN-0001.key"

    loaded_priv = load_private_key(key_path)
    assert loaded_priv.private_bytes_raw() == priv.private_bytes_raw()

    # Load via bin_id lookup
    loaded_via_id = load_private_key(bin_id, keys_dir=tmp_path)
    assert loaded_via_id.private_bytes_raw() == priv.private_bytes_raw()


def test_save_refuses_overwrite_without_force(tmp_path: Path) -> None:
    """save_private_key raises FileExistsError if key exists and force=False."""
    priv1, _ = generate_keypair()
    priv2, _ = generate_keypair()
    bin_id = "VB-PUN-0001"

    save_private_key(bin_id, priv1, keys_dir=tmp_path)
    with pytest.raises(FileExistsError, match="Key file already exists"):
        save_private_key(bin_id, priv2, keys_dir=tmp_path, force=False)

    # Overwrite works with force=True
    save_private_key(bin_id, priv2, keys_dir=tmp_path, force=True)
    loaded = load_private_key(bin_id, keys_dir=tmp_path)
    assert loaded.private_bytes_raw() == priv2.private_bytes_raw()


def test_load_helpers_roundtrip() -> None:
    """load_private_key_b64 and load_public_key_b64 roundtrip raw bytes."""
    priv, pub_b64 = generate_keypair()
    priv_b64 = private_key_to_b64(priv)

    loaded_priv = load_private_key_b64(priv_b64)
    assert loaded_priv.private_bytes_raw() == priv.private_bytes_raw()

    loaded_pub = load_public_key_b64(pub_b64)
    assert isinstance(loaded_pub, Ed25519PublicKey)
    assert public_key_to_b64(loaded_pub) == pub_b64


def test_resolve_bin_ids_defaults() -> None:
    """resolve_bin_ids without args returns 6 seed bins + 3 test bins."""
    bins = resolve_bin_ids(None, None, None)
    expected = SEED_BINS + [CI_TEST_BIN, REVOKED_TEST_BIN, ACTIVE_TEST_BIN_2]
    assert bins == expected
    assert len(bins) == 9


def test_resolve_bin_ids_single() -> None:
    """resolve_bin_ids with --bin-id returns single bin."""
    assert resolve_bin_ids("VB-MUM-9999", None, None) == ["VB-MUM-9999"]


def test_resolve_bin_ids_count_prefix() -> None:
    """resolve_bin_ids with --count and --prefix generates correctly formatted IDs."""
    bins = resolve_bin_ids(None, 3, "VB-PUN-08")
    assert bins == ["VB-PUN-0801", "VB-PUN-0802", "VB-PUN-0803"]


def test_keygen_cli_end_to_end(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """keygen CLI generates all default bins, writes public CSV, and never leaks private keys."""
    keys_dir = tmp_path / "keys"
    csv_file = tmp_path / "bin_public_keys.csv"

    test_args = [
        "keygen.py",
        "--keys-dir",
        str(keys_dir),
        "--output-csv",
        str(csv_file),
    ]

    with patch.object(sys, "argv", test_args):
        ret = main()

    assert ret == 0
    captured = capsys.readouterr()

    # Verify all 9 key files exist
    expected_bins = SEED_BINS + [CI_TEST_BIN, REVOKED_TEST_BIN, ACTIVE_TEST_BIN_2]
    for b_id in expected_bins:
        key_file = keys_dir / f"{b_id}.key"
        assert key_file.exists()

        # Read the raw private key b64
        priv_b64 = key_file.read_text(encoding="ascii").strip()

        # CRITICAL SECURITY CHECK: Private key must NEVER appear in stdout or stderr
        assert priv_b64 not in captured.out
        assert priv_b64 not in captured.err

    # Verify CSV was written and contains public keys only
    assert csv_file.exists()
    with csv_file.open("r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
        assert len(reader) == 9
        for row in reader:
            assert row["bin_id"] in expected_bins
            pub_raw = base64.b64decode(row["public_key"])
            assert len(pub_raw) == 32

    # Verify reminder for CI test bin is printed
    assert "TEST_BIN_PRIVATE_KEY" in captured.out
    assert CI_TEST_BIN in captured.out


def test_keygen_cli_refuses_overwrite(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """keygen CLI exits with code 1 if keys exist and --force is not given."""
    keys_dir = tmp_path / "keys"
    csv_file = tmp_path / "bin_public_keys.csv"

    test_args = [
        "keygen.py",
        "--keys-dir",
        str(keys_dir),
        "--output-csv",
        str(csv_file),
    ]

    with patch.object(sys, "argv", test_args):
        assert main() == 0

    # Second run without --force must fail
    with patch.object(sys, "argv", test_args):
        assert main() == 1

    captured = capsys.readouterr()
    assert "Use --force to overwrite" in captured.err

    # Third run with --force must succeed
    test_args_force = test_args + ["--force"]
    with patch.object(sys, "argv", test_args_force):
        assert main() == 0
