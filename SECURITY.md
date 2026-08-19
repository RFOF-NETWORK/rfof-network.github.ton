# Security Policy

## Unterstützte Versionen

| Version | Support |
|---------|---------|
| `main` (aktuell) | ✅ Aktiv |

## Kryptografie-Übersicht

| Algorithmus | Einsatz |
|-------------|---------|
| SHA-256 | Erster Hashing-Schritt für Passwörter |
| SHA-512 | Zweiter Hashing-Schritt (Double-Hashing) |
| PBKDF2-HMAC-SHA-512 | Schlüsselableitung für AES (Web Crypto API) |
| AES-GCM 256-bit | Verschlüsselung sensibler Daten |
| Argon2id / PBKDF2 | Passwort-Hashing (Python-Backend) |
| JWT (HS256) | Sitzungstokens |

## Best Practices (implementiert)

- **Salting**: Jedes Passwort erhält einen zufälligen 128-bit-Salt.
- **Double-Hashing**: SHA-256 → SHA-512 für Front-end-Hashing.
- **Account Lockout**: Nach 5 Fehlversuchen wird das Konto 15 Minuten
  gesperrt.
- **Session Timeout**: Sitzungen laufen nach 15 Minuten Inaktivität ab.
- **CSRF-Schutz**: Jede Sitzung erhält ein CSRF-Token; Logout erfordert
  dessen Vorlage.
- **XSS-Prävention**: Benutzernamen werden vor Verarbeitung sanitiert.
- **HTTPS only**: GitHub Pages liefert ausschließlich über HTTPS aus.
- **Audit-Logging**: Alle Auth-Ereignisse werden mit Zeitstempel
  protokolliert.

## Sicherheitslücke melden

Bitte eine **private** GitHub-Security-Advisory an dieses Repository
öffnen oder eine E-Mail an den Repository-Eigentümer senden.  
Öffentliche Issues eignen sich **nicht** für Sicherheitsmeldungen.

## Hinweise zur Produktionsnutzung

> Diese Anwendung demonstriert kryptografische Techniken im Browser.
> Für eine echte Produktionsumgebung sollte das Passwort-Hashing
> **ausschließlich serverseitig** (z. B. mit Argon2id) erfolgen.
> Das Front-end-Hashing dient der Demonstration, ersetzt aber kein
> serverseitiges Hashing.
