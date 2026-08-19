"""Tests fuer Auth, Crypto und Web3-Integration."""

import os
import tempfile

from auth import BasicAuthManager, build_github_oauth2, build_google_oauth2, issue_jwt, verify_jwt
from config import load_config
from crypto_utils import (
    aes_decrypt,
    aes_encrypt,
    double_hash_sha256_sha512,
    hash_password,
    hash_sha256,
    hash_sha512,
    verify_password,
)
from web3_integration import Web3Integration


def test_hashing_and_passwords():
    text = "RFOF"
    h256 = hash_sha256(text)
    h512 = hash_sha512(text)
    dh = double_hash_sha256_sha512(text)

    assert len(h256) == 64
    assert len(h512) == 128
    assert len(dh) == 128

    salt, pwd_hash = hash_password("supersecret")
    assert verify_password("supersecret", salt, pwd_hash) is True
    assert verify_password("wrong", salt, pwd_hash) is False


def test_aes_roundtrip():
    secret = "my-app-secret"
    message = "Tokenisierte Daten sichern"
    encrypted = aes_encrypt(message, secret)
    decrypted = aes_decrypt(encrypted, secret)
    assert decrypted == message


def test_basic_auth_and_jwt():
    manager = BasicAuthManager()
    manager.register_user("alice", "password123")
    assert manager.authenticate("alice", "password123") is True
    assert manager.authenticate("alice", "x") is False

    jwt_secret = "x" * 32
    token = issue_jwt("alice", jwt_secret, additional_claims={"role": "admin"})
    payload = verify_jwt(token, jwt_secret)
    assert payload["sub"] == "alice"
    assert payload["role"] == "admin"


def test_oauth2_builders():
    google = build_google_oauth2("gid", "gsecret", "http://localhost/callback")
    github = build_github_oauth2("cid", "csecret", "http://localhost/callback")

    google_url = google.authorization_url(state="xyz")
    github_url = github.authorization_url(state="xyz")

    assert "accounts.google.com" in google_url
    assert "github.com/login/oauth/authorize" in github_url
    assert "state=xyz" in google_url
    assert "state=xyz" in github_url


def test_config_load_from_env_file():
    with tempfile.NamedTemporaryFile("w", delete=False) as tmp:
        tmp.write("JWT_SECRET=test-secret\n")
        tmp_path = tmp.name

    try:
        cfg = load_config(tmp_path)
        assert cfg.jwt_secret == "test-secret"
    finally:
        os.unlink(tmp_path)


def test_web3_wallet_and_signing():
    wallet_address, private_key = Web3Integration.create_wallet()
    assert wallet_address.startswith("0x")
    assert private_key.startswith("0x")

    tx = {
        "nonce": 0,
        "gasPrice": 1,
        "gas": 21000,
        "to": "0x000000000000000000000000000000000000dEaD",
        "value": 1,
        "data": "0x",
        "chainId": 1,
    }
    signed = Web3Integration.sign_transaction(tx, private_key)
    assert signed.raw_transaction_hex.startswith("0x")
    assert signed.transaction_hash_hex.startswith("0x")


def main():
    test_hashing_and_passwords()
    test_aes_roundtrip()
    test_basic_auth_and_jwt()
    test_oauth2_builders()
    test_config_load_from_env_file()
    test_web3_wallet_and_signing()
    print("✅ Security/Web3 Tests bestanden")


if __name__ == "__main__":
    main()
