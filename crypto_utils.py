"""Kryptografie-Utilities: Hashing, Password-Handling, AES."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

if __package__:
    from .errors import CryptoError
else:
    from errors import CryptoError


def hash_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def hash_sha512(text: str) -> str:
    return hashlib.sha512(text.encode("utf-8")).hexdigest()


def double_hash_sha256_sha512(text: str) -> str:
    first_hash = hash_sha256(text)
    return hash_sha512(first_hash)


def generate_salt(length: int = 16) -> str:
    return base64.urlsafe_b64encode(os.urandom(length)).decode("ascii")


def hash_password(
    password: str, salt: str | None = None, iterations: int = 100_000
) -> tuple[str, str]:
    password_salt = salt or generate_salt()
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), password_salt.encode("utf-8"), iterations
    )
    return password_salt, digest.hex()


def verify_password(
    password: str, salt: str, expected_hash: str, iterations: int = 100_000
) -> bool:
    _, computed_hash = hash_password(password, salt=salt, iterations=iterations)
    return hmac.compare_digest(computed_hash, expected_hash)


def _derive_aes_key(secret: str) -> bytes:
    return hashlib.sha256(secret.encode("utf-8")).digest()


def aes_encrypt(plaintext: str, secret: str, associated_data: bytes | None = None) -> str:
    """Verschluesselt Text via AES-GCM und gibt ein base64-Token zurueck."""
    try:
        key = _derive_aes_key(secret)
        nonce = os.urandom(12)
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data)
        return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")
    except Exception as exc:  # pragma: no cover - Sicherheitsnetz
        raise CryptoError("AES Verschluesselung fehlgeschlagen") from exc


def aes_decrypt(token: str, secret: str, associated_data: bytes | None = None) -> str:
    """Entschluesselt ein von `aes_encrypt` erzeugtes base64-Token."""
    try:
        payload = base64.urlsafe_b64decode(token.encode("ascii"))
        nonce, ciphertext = payload[:12], payload[12:]
        aesgcm = AESGCM(_derive_aes_key(secret))
        plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data)
        return plaintext.decode("utf-8")
    except Exception as exc:
        raise CryptoError("AES Entschluesselung fehlgeschlagen") from exc
