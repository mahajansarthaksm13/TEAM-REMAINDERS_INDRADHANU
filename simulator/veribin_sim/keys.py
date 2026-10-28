"""Ed25519 keypair generation, storage, and loading helpers for VeriBin bins.

Private keys are stored locally in simulator/keys/<bin_id>.key as base64 of the 32 raw bytes.
Public keys are formatted as standard base64 of the 32 raw bytes.
"""

from __future__ import annotations

import base64
import os
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

DEFAULT_KEYS_DIR: Path = Path(__file__).resolve().parent.parent / "keys"


def generate_keypair() -> tuple[Ed25519PrivateKey, str]:
    """Generate a new Ed25519 private key and its base64-encoded public key.

    Returns:
        Tuple of (Ed25519PrivateKey, public_key_b64).
    """
    priv = Ed25519PrivateKey.generate()
    pub_b64 = public_key_to_b64(priv.public_key())
    return priv, pub_b64


def public_key_to_b64(public_key: Ed25519PublicKey) -> str:
    """Encode Ed25519PublicKey raw 32 bytes to base64 string."""
    return base64.b64encode(public_key.public_bytes_raw()).decode("ascii")


def private_key_to_b64(private_key: Ed25519PrivateKey) -> str:
    """Encode Ed25519PrivateKey raw 32 bytes to base64 string."""
    return base64.b64encode(private_key.private_bytes_raw()).decode("ascii")


def save_private_key(
    bin_id: str,
    private_key: Ed25519PrivateKey,
    keys_dir: Path | str = DEFAULT_KEYS_DIR,
    force: bool = False,
) -> Path:
    """Save private key as base64 of the 32 raw bytes to <keys_dir>/<bin_id>.key.

    Refuses to overwrite unless force=True.
    Restricts file permissions to 0o600 where supported.

    Returns:
        Path to the saved key file.

    Raises:
        FileExistsError: If key file exists and force is False.
    """
    directory = Path(keys_dir)
    directory.mkdir(parents=True, exist_ok=True)
    key_path = directory / f"{bin_id}.key"

    if key_path.exists() and not force:
        raise FileExistsError(
            f"Key file already exists for bin '{bin_id}' at '{key_path}'. "
            "Pass --force to overwrite."
        )

    b64_content = private_key_to_b64(private_key)
    # Write atomically or with mode
    key_path.write_text(f"{b64_content}\n", encoding="ascii")

    # Restrict permissions where supported (POSIX)
    try:
        os.chmod(key_path, 0o600)
    except (OSError, NotImplementedError):
        pass

    return key_path


def load_private_key(
    target: str | Path,
    keys_dir: Path | str | None = None,
) -> Ed25519PrivateKey:
    """Load Ed25519PrivateKey from a file path or bin ID.

    Args:
        target: File path or bin ID string.
        keys_dir: Optional directory to look up if target is a bin ID.

    Returns:
        Ed25519PrivateKey instance.

    Raises:
        FileNotFoundError: If key file is not found.
        ValueError: If key file content is invalid.
    """
    path = Path(target)
    if not path.is_file():
        search_dir = Path(keys_dir) if keys_dir is not None else DEFAULT_KEYS_DIR
        candidate = search_dir / f"{target}.key"
        if candidate.is_file():
            path = candidate
        else:
            raise FileNotFoundError(
                f"Key file not found for '{target}' (looked at '{path}' and '{candidate}')."
            )

    raw_text = path.read_text(encoding="ascii").strip()
    return load_private_key_b64(raw_text)


def load_private_key_b64(b64_str: str) -> Ed25519PrivateKey:
    """Load Ed25519PrivateKey from base64 string of 32 raw bytes."""
    try:
        raw_bytes = base64.b64decode(b64_str.strip())
        if len(raw_bytes) != 32:
            raise ValueError(f"Expected 32 raw bytes for private key, got {len(raw_bytes)}.")
        return Ed25519PrivateKey.from_private_bytes(raw_bytes)
    except Exception as exc:
        raise ValueError(f"Invalid private key base64 string: {exc}") from exc


def load_public_key_b64(b64_str: str) -> Ed25519PublicKey:
    """Load Ed25519PublicKey from base64 string of 32 raw bytes."""
    try:
        raw_bytes = base64.b64decode(b64_str.strip())
        if len(raw_bytes) != 32:
            raise ValueError(f"Expected 32 raw bytes for public key, got {len(raw_bytes)}.")
        return Ed25519PublicKey.from_public_bytes(raw_bytes)
    except Exception as exc:
        raise ValueError(f"Invalid public key base64 string: {exc}") from exc
