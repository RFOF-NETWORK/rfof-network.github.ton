# Setup Guide

## 1) Installation

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 2) Environment konfigurieren

```bash
cp .env.example .env
```

Dann in `.env` mindestens `JWT_SECRET` setzen.

## 3) Tests ausführen

```bash
python3 test_tokenizers.py
python3 test_security_web3.py
```

---

# API Dokumentation

## Auth (`auth.py`)

- `BasicAuthManager.register_user(username, password)`
- `BasicAuthManager.authenticate(username, password)`
- `issue_jwt(subject, secret, expires_in_seconds=3600, additional_claims=None)`
- `verify_jwt(token, secret)`
- `build_google_oauth2(...)`
- `build_github_oauth2(...)`

## Cryptography (`crypto_utils.py`)

- `hash_sha256(text)`
- `hash_sha512(text)`
- `double_hash_sha256_sha512(text)` (SHA256 -> SHA512)
- `hash_password(password, salt=None, iterations=100_000)`
- `verify_password(password, salt, expected_hash, iterations=100_000)`
- `aes_encrypt(plaintext, secret, associated_data=None)`
- `aes_decrypt(token, secret, associated_data=None)`

## Web3 (`web3_integration.py`)

- `Web3Integration.create_wallet()`
- `Web3Integration.load_contract(address, abi)`
- `Web3Integration.sign_transaction(transaction, private_key)`
- `Web3Integration.get_eth_balance_wei(address)`

---

# Security Best Practices

1. Niemals echte API Keys oder Private Keys committen.
2. `.env` lokal halten, nur `.env.example` versionieren.
3. Starke, lange `JWT_SECRET` verwenden.
4. Passwörter nie im Klartext speichern (nur Salt + Hash).
5. Bei produktiven OAuth2-Flows immer HTTPS erzwingen.

---

# Examples & Tutorials

## Basic Auth + JWT

```python
from auth import BasicAuthManager, issue_jwt

manager = BasicAuthManager()
manager.register_user("alice", "strong-password")

if manager.authenticate("alice", "strong-password"):
    token = issue_jwt("alice", "my-jwt-secret")
    print(token)
```

## AES Encrypt/Decrypt

```python
from crypto_utils import aes_encrypt, aes_decrypt

cipher = aes_encrypt("hello", "my-secret")
plain = aes_decrypt(cipher, "my-secret")
print(plain)
```

## Web3 Transaction Signing

```python
from web3_integration import Web3Integration

address, key = Web3Integration.create_wallet()
tx = {
    "nonce": 0,
    "gasPrice": 1,
    "gas": 21000,
    "to": "0x000000000000000000000000000000000000dEaD",
    "value": 1,
    "data": "0x",
    "chainId": 1,
}
signed = Web3Integration.sign_transaction(tx, key)
print(signed.transaction_hash_hex)
```
