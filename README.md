# rfof-network.github.ton
PRAIAI[Copilot(PRAI[Gemini/GoogleAI{Deepseek}]GPT) #BlueDeepGold macht alles nutzbar in GitHub von RFOF-NETWORK.
Mit eigener Python Paket Reihe v0.1.0 **multi_spark_tokenizer_python_paket**

[![Python Package](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/python-publish.yml/badge.svg)](https://github.com/RFOF-NETWORK/rfof-network.github.ton/actions/workflows/python-publish.yml)

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
```

## Als Python-Paket nutzen

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

