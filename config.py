"""Environment-Konfiguration fuer Auth/Crypto/Web3."""

from __future__ import annotations

from dataclasses import dataclass
import os

from dotenv import load_dotenv

if __package__:
    from .errors import ConfigError
else:
    from errors import ConfigError


@dataclass(frozen=True)
class AppConfig:
    jwt_secret: str
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    oauth_redirect_uri: str = ""
    web3_provider_url: str = ""


def require_env(name: str) -> str:
    value = os.getenv(name, "")
    if not value:
        raise ConfigError(f"Fehlende Umgebungsvariable: {name}")
    return value


def load_config(env_file: str = ".env") -> AppConfig:
    """Laedt Konfiguration aus .env und System-Environment."""
    load_dotenv(env_file, override=False)
    return AppConfig(
        jwt_secret=require_env("JWT_SECRET"),
        google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
        google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET", ""),
        github_client_id=os.getenv("GITHUB_CLIENT_ID", ""),
        github_client_secret=os.getenv("GITHUB_CLIENT_SECRET", ""),
        oauth_redirect_uri=os.getenv("OAUTH_REDIRECT_URI", ""),
        web3_provider_url=os.getenv("WEB3_PROVIDER_URL", ""),
    )
