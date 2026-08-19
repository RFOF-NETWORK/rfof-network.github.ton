# Deployment Guide

## GitHub Pages (automatisch)

Jeder Push auf den `main`-Branch löst den Workflow
`.github/workflows/final-deploy.yml` (und kompatibel `pages.yml`) aus:

1. HTML/JS werden validiert.
2. Node.js-Tests (`auth.test.mjs`) und Python-Tests laufen.
3. Einfache Security-/Lint-Checks laufen mit.
4. Bei Erfolg wird die fertige Site als Pages-Artefakt hochgeladen und
   automatisch deployed.
5. Nach Deploy folgt ein Health-Check der Live-URL.

**Live-URL:**
```
https://RFOF-NETWORK.github.io/rfof-network.github.ton/
```

## Lokale Vorschau

```bash
# Beliebigen statischen Server starten, z. B. mit Python:
python3 -m http.server 8080
# Dann im Browser öffnen:
# http://localhost:8080/
```

## Manuelles Deployment auslösen

Im GitHub-Repository → **Actions** → **Deploy Docs and Demo to GitHub Pages**
→ **Run workflow**.

## Umgebungsvariablen / Secrets

Für den reinen Front-end-Build werden keine Secrets benötigt.
Python-Module (Auth, Web3) benötigen `.env` – siehe `.env.example`.

## Voraussetzungen

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.11 |
| pip-Pakete | siehe `requirements.txt` |
