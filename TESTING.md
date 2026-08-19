# Testing Guide

## Manueller Test Flow

1. Admin registrieren
2. Ausloggen
3. Fünfmal falsches Passwort eingeben
4. Sperrlog im Audit Log Viewer prüfen

## OAuth2 Demo Szenario

1. GitHub/Google/Microsoft Button klicken
2. Simulierter Callback wird verarbeitet
3. Session zeigt `OAuth2 (provider)`
4. Logout durchführen und erneut mit System Account einloggen

## Automatisierte Tests

```bash
node --test auth.test.mjs
python test_tokenizers.py
python test_security_web3.py
```

## Abgedeckte Szenarien

- Login mit OAuth2 (simuliert)
- Login mit System Account
- Password Strength Validierung
- Account Lockout nach 5 Versuchen
- AES-256 Verschlüsselung/Entschlüsselung
- Audit Log Export
- Session Management
- XSS/CSRF Prevention Checks
