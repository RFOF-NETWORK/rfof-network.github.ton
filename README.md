# rfof-network.github.ton
PRAIAI[Copilot(PRAI[Gemini/GoogleAI{Deepseak}]GPT) #BlueDeepGold.
# Mein Tokenizer-Projekt

Ein Lernprojekt, um zu verstehen, wie LLMs Text (Buchstaben, Zahlen,
Sonderzeichen) in etwas umwandeln, mit dem sie rechnen können.

## Was ist hier drin?

| Datei | Was sie zeigt |
|---|---|
| `tokenizer.py` | Zeichen-Tokenizer: jedes Zeichen = eine Zahl (ID) |
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
python3 eigener_tokenizer.py
python3 bpe_tokenizer.py
```

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
