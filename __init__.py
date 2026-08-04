"""
multi_spark_tokenizer_python_paket
========================
Ein eigenes, installierbares Python-Paket mit zwei Tokenizern:
- CharTokenizer: jedes Zeichen wird zu einer Zahl
- BPETokenizer: haeufige Zeichen-Kombinationen werden verschmolzen
  (das Prinzip, das echte LLM-Tokenizer wie bei GPT nutzen)

Nutzung nach der Installation:

    from eigener_tokenizer_paket import CharTokenizer, BPETokenizer

    tok = CharTokenizer()
    ids = tok.encode("Hallo Welt!")
    text = tok.decode(ids)
"""

from .char_tokenizer import CharTokenizer
from .bpe_tokenizer import BPETokenizer

__version__ = "0.1.0"
__all__ = ["CharTokenizer", "BPETokenizer"]
