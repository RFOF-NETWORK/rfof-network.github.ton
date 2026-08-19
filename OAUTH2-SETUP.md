# OAuth2 Setup (GitHub / Google / Microsoft)

## Demo-Modus (ohne Backend)

Die UI nutzt drei OAuth2-Buttons und simuliert den Callback lokal.
Dabei wird kein echter Token-Austausch durchgeführt.

## Echte OAuth2 Aktivierung (mit Backend)

1. OAuth2-App bei GitHub, Google und Microsoft anlegen.
2. Redirect URI auf die produktive Callback-URL setzen, z. B.
   `https://RFOF-NETWORK.github.io/rfof-network.github.ton/` (Frontend)
   plus serverseitige Callback-Route für den Code-Austausch.
3. Client-ID/Secrets serverseitig speichern (nie im Frontend).
4. Im Backend den Authorization Code gegen Access/ID Token tauschen.
5. `state`-Wert validieren, Userdaten laden und Session ausstellen.
6. Optional: bestehende System-Accounts anhand E-Mail/Subject verknüpfen.

## Provider-Hinweise

- **GitHub:** Scope z. B. `read:user user:email`
- **Google:** Scope z. B. `openid profile email`
- **Microsoft:** Scope z. B. `openid profile email User.Read`

## Sicherheitscheckliste

- HTTPS erzwingen
- `state` gegen CSRF validieren
- ID-Token Signatur prüfen
- Refresh Token nur serverseitig speichern
- Audit Log für Login/Linking/Logout führen
