# rfof-network.github.ton

[![CI](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/ci.yml/badge.svg)](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/pages.yml/badge.svg)](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/pages.yml)
[![Final Deploy](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/final-deploy.yml/badge.svg)](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/final-deploy.yml)

PRAIAI[Copilot(PRAI[Gemini/GoogleAI{Deepseek}]GPT) #BlueDeepGold macht alles nutzbar in GitHub von RFOF-NETWORK.
Mit eigener Python Paket Reihe v0.1.0 **multi_spark_tokenizer_python_paket**

[![Python Package](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/python-publish.yml/badge.svg)](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/python-publish.yml)

## Live Demo & Docs

- 🌐 **Live Demo (GitHub Pages):** <https://RFOF-NETWORK.github.io/rfof-network.github.ton/>
- 📖 Projektdoku: [`docs/README.md`](docs/README.md)
- 🚀 Deployment-Guide: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- 🔐 Security-Policy: [`SECURITY.md`](SECURITY.md)
- 🔑 OAuth2 Setup: [`OAUTH2-SETUP.md`](OAUTH2-SETUP.md)
- 🧪 Testing Guide: [`TESTING.md`](TESTING.md)

## ABC Finale Auth-Demo

- OAuth2 Buttons für **GitHub, Google, Microsoft** (Demo-Flow mit Callback-Handler vorbereitet)
- Fallback **System Account** (Registrieren + Login)
- Dual-Session-Handling (OAuth2 oder System Account) mit einheitlichem Logout
- AES-256-GCM Secure Note, SHA256→SHA512 Passwort-Flow, Lockout, Audit Logs
- Admin Panel mit User-Überblick und Export-Funktionen

## Schneller Test

```bash
node --test auth.test.mjs
python test_tokenizers.py
```

# Mein Tokenizer-Projekt

Ein Lernprojekt, um zu verstehen, wie LLMs Text (Buchstaben, Zahlen,
Sonderzeichen) in etwas umwandeln, mit dem sie rechnen können.

## Was ist hier drin?

| Datei | Was sie zeigt |
|---|---|
| `char_tokenizer.py` | Zeichen-Tokenizer: jedes Zeichen = eine Zahl (ID) |
| `bpe_tokenizer.py` | BPE-Tokenizer: das Verfahren, das echte LLMs (GPT, Llama, ...) nutzen |

## Grundkonzepte

- **Tokenisierung**: Text → Zahlen. Ein Modell "liest" keine Buchstaben,
  sondern nur Zahlen (IDs), die auf Text-Bausteine zeigen.
- **Vokabular**: die Liste aller möglichen Tokens, die ein Modell kennt.
- **BPE (Byte Pair Encoding)**: häufige Buchstaben-Kombinationen werden
  automatisch zu einem einzigen Token verschmolzen. Macht das Modell
  effizienter, weil häufige Wortteile weniger "Denkschritte" brauchen.

## Installation

```bash
pip install git+https://github.com/RFOF-NETWORK/rfof-network.github.ton.git
```

## Ausführen

```bash
python3 char_tokenizer.py
python3 bpe_tokenizer.py
python3 test_tokenizers.py
python3 test_security_web3.py
```

## Als Python-Paket nutzen

## Neue Module

- `auth.py`: Basic Auth, OAuth2-Provider (Google/GitHub), JWT
- `crypto_utils.py`: SHA256/SHA512, Double-Hashing, Password-Salting, AES-GCM
- `web3_integration.py`: Wallet-Handling, Contract-Laden, Transaction Signing
- `config.py`: Environment-Variablen-Config via `.env`
- `logging_utils.py`: zentrales Logging
- `errors.py`: modulare Fehlerklassen


```python
from multi_spark_tokenizer_python_paket import CharTokenizer, BPETokenizer

# Zeichen-Tokenizer
tok = CharTokenizer()
ids = tok.encode("Hallo Welt!")
text = tok.decode(ids)
print(ids)   # [32, 9, 22, 22, 25, 0, ...]
print(text)  # 'Hallo Welt!'

# BPE-Tokenizer
bpe = BPETokenizer(anzahl_merges=20)
bpe.trainieren("python python python lernen lernen")
tokens = bpe.tokenisieren("python")
print(tokens)  # ['python</w>']
```

## Warum das der richtige erste Schritt ist

Bevor ein LLM irgendetwas "versteht", muss der Text erst in Zahlen
umgewandelt werden. Dieses Projekt zeigt genau diesen ersten,
fundamentalen Schritt - ganz ohne dass man ein riesiges Modell
braucht oder trainieren muss.

## Lizenz

Siehe [PRAIAI_LICENSE](./PRAIAI_LICENSE)

