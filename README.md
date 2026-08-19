# rfof-network.github.ton

[![CI](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/ci.yml/badge.svg)](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/pages.yml/badge.svg)](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/pages.yml)

PRAIAI[Copilot(PRAI[Gemini/GoogleAI{Deepseek}]GPT) #BlueDeepGold macht alles nutzbar in GitHub von RFOF-NETWORK.
Mit eigener Python Paket Reihe v0.0.1 [multi_spark_tokenizer_python_paket](https://github.com/RFOF-NETWORK/rfof-network.github.ton/new/main?filename=.github%2Fworkflows%2Fpython-publish.yml&workflow_template=ci%2Fpython-publish)

## Live Demo & Docs

- 🌐 **Live Demo (GitHub Pages):** <https://RFOF-NETWORK.github.io/rfof-network.github.ton/>
- 📖 Projektdoku: [`docs/README.md`](docs/README.md)
- 🚀 Deployment-Guide: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- 🔐 Security-Policy: [`SECURITY.md`](SECURITY.md)

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

## Ausführen

```bash
python3 char_tokenizer.py
python3 bpe_tokenizer.py
python3 test_tokenizers.py
python3 test_security_web3.py
```

## Neue Module

- `auth.py`: Basic Auth, OAuth2-Provider (Google/GitHub), JWT
- `crypto_utils.py`: SHA256/SHA512, Double-Hashing, Password-Salting, AES-GCM
- `web3_integration.py`: Wallet-Handling, Contract-Laden, Transaction Signing
- `config.py`: Environment-Variablen-Config via `.env`
- `logging_utils.py`: zentrales Logging
- `errors.py`: modulare Fehlerklassen

## Nächste Schritte (in Termux)

1. Termux öffnen (F-Droid-Version)
2. `pkg install python git`
3. Diesen Ordner nach Termux übertragen (z.B. per `git clone`, sobald
   auf GitHub oder Hugging Face gepusht)
4. Mit echten, großen Tokenizern vergleichen:
   ```bash
   pip install transformers
   python3 -c "from transformers import AutoTokenizer; t = AutoTokenizer.from_pretrained('gpt2'); print(t.encode('Hallo Welt'))"
   ```
5. Als Hugging Face Space veröffentlichen (siehe Chat-Verlauf für
   die genauen `huggingface-cli`-Befehle)

## Warum das der richtige erste Schritt ist

Bevor ein LLM irgendetwas "versteht", muss der Text erst in Zahlen
umgewandelt werden. Dieses Projekt zeigt genau diesen ersten,
fundamentalen Schritt - ganz ohne dass man ein riesiges Modell
braucht oder trainieren muss.
