"""Auth-Modul: Basic Auth, OAuth2-Helfer, JWT-Session-Tokens."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt

if __package__:
    from .crypto_utils import hash_password, verify_password
    from .errors import AuthError
else:
    from crypto_utils import hash_password, verify_password
    from errors import AuthError


@dataclass(frozen=True)
class UserRecord:
    username: str
    password_salt: str
    password_hash: str


class BasicAuthManager:
    """Einfaches, in-memory Basic Auth Management."""

    def __init__(self):
        self._users: dict[str, UserRecord] = {}

    def register_user(self, username: str, password: str) -> UserRecord:
        if not username or not password:
            raise AuthError("Username und Passwort sind erforderlich")
        if username in self._users:
            raise AuthError("Username existiert bereits")

        salt, password_hash = hash_password(password)
        record = UserRecord(
            username=username,
            password_salt=salt,
            password_hash=password_hash,
        )
        self._users[username] = record
        return record

    def authenticate(self, username: str, password: str) -> bool:
        user = self._users.get(username)
        if not user:
            return False
        return verify_password(password, user.password_salt, user.password_hash)


def issue_jwt(
    subject: str,
    secret: str,
    expires_in_seconds: int = 3600,
    additional_claims: dict | None = None,
) -> str:
    if not secret:
        raise AuthError("JWT_SECRET fehlt")

    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in_seconds),
    }
    if additional_claims:
        payload.update(additional_claims)

    return jwt.encode(payload, secret, algorithm="HS256")


def verify_jwt(token: str, secret: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise AuthError("JWT Verifikation fehlgeschlagen") from exc


@dataclass(frozen=True)
class OAuth2Provider:
    name: str
    authorize_url: str
    token_url: str
    client_id: str
    client_secret: str
    redirect_uri: str
    scope: str

    def authorization_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": self.scope,
            "state": state,
        }
        return f"{self.authorize_url}?{urlencode(params)}"

    def token_payload(self, code: str) -> dict[str, str]:
        return {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
        }


def build_google_oauth2(
    client_id: str, client_secret: str, redirect_uri: str
) -> OAuth2Provider:
    return OAuth2Provider(
        name="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope="openid email profile",
    )


def build_github_oauth2(
    client_id: str, client_secret: str, redirect_uri: str
) -> OAuth2Provider:
    return OAuth2Provider(
        name="github",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope="read:user user:email",
    )
