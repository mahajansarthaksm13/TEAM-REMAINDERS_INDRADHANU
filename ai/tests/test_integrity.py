import pytest
from cryptography.hazmat.primitives.asymmetric import ed25519
from ai.veribin_ai.integrity import IntegrityChecker

def test_valid_signature_verification():
    priv = ed25519.Ed25519PrivateKey.generate()
    pub_hex = priv.public_key().public_bytes_raw().hex()
    text = "2026-11-02T12:00:00|BIN-001|PROD-001|1|250"
    sig_hex = priv.sign(text.encode('utf-8')).hex()
    
    checker = IntegrityChecker()
    assert checker.verify_scan_signature(text, sig_hex, pub_hex) is True

def test_tampered_signature_detection():
    priv = ed25519.Ed25519PrivateKey.generate()
    pub_hex = priv.public_key().public_bytes_raw().hex()
    text = "2026-11-02T12:00:00|BIN-001|PROD-001|1|250"
    sig_hex = priv.sign(text.encode('utf-8')).hex()
    
    tampered_text = text.replace("250", "999")
    checker = IntegrityChecker()
    assert checker.verify_scan_signature(tampered_text, sig_hex, pub_hex) is False
