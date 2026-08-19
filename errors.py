"""Projektweite, gezielte Fehlerklassen."""


class AuthError(Exception):
    """Fehler bei Authentifizierung, JWT oder OAuth2."""


class CryptoError(Exception):
    """Fehler bei kryptographischen Operationen."""


class Web3IntegrationError(Exception):
    """Fehler in der Web3-Integration."""


class ConfigError(Exception):
    """Fehler beim Laden von Konfigurationen aus Umgebungsvariablen."""
