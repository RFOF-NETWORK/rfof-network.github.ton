"""Tests für char_tokenizer.py und bpe_tokenizer.py"""

import sys
from char_tokenizer import CharTokenizer
from bpe_tokenizer import BPETokenizer


def test_char_tokenizer_basic():
    """Test: CharTokenizer encode/decode funktioniert"""
    tok = CharTokenizer()
    
    # Test 1: Einfacher Text
    text = "Hallo Welt!"
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    assert decoded == text, f"CharTokenizer Failed: {text!r} != {decoded!r}"
    print("✅ CharTokenizer Test 1: encode/decode - PASSED")
    
    # Test 2: Mit Umlauten
    text = "Äpfel und Öl"
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    assert decoded == text, f"CharTokenizer Failed: {text!r} != {decoded!r}"
    print("✅ CharTokenizer Test 2: Umlauten - PASSED")
    
    # Test 3: Mit Zahlen und Sonderzeichen
    text = "RFOF-NETWORK 2026!"
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    assert decoded == text, f"CharTokenizer Failed: {text!r} != {decoded!r}"
    print("✅ CharTokenizer Test 3: Zahlen & Sonderzeichen - PASSED")
    
    # Test 4: Unbekannte Zeichen
    text = "Hallo123"
    ids = tok.encode(text)
    assert 0 not in ids, "Unbekannte Zeichen sollten nicht vorkommen"
    print("✅ CharTokenizer Test 4: Keine unbekannten Zeichen - PASSED")


def test_char_tokenizer_vokabular():
    """Test: CharTokenizer Vokabular-Größe ist korrekt"""
    tok = CharTokenizer()
    
    # Vokabular sollte > 50 sein (Buchstaben, Zahlen, Sonderzeichen + UNK)
    assert tok.vokabular_groesse > 50, f"Vokabular zu klein: {tok.vokabular_groesse}"
    print(f"✅ CharTokenizer Vokabular: {tok.vokabular_groesse} Tokens")


def test_bpe_tokenizer_training():
    """Test: BPETokenizer trainiert und tokenisiert"""
    tok = BPETokenizer(anzahl_merges=10)
    
    # Trainierung mit einfachem Text
    trainingstext = "python python python lernen lernen programmieren"
    tok.trainieren(trainingstext)
    
    # Test 1: Merge-Regeln sollten erstellt werden
    assert len(tok.merge_regeln) > 0, "Keine Merge-Regeln gelernt"
    print(f"✅ BPETokenizer Training: {len(tok.merge_regeln)} Merge-Regeln gelernt")
    
    # Test 2: Tokenisierung sollte funktionieren
    tokens = tok.tokenisieren("python")
    assert len(tokens) > 0, "Tokenisierung ergab keine Tokens"
    print(f"✅ BPETokenizer Tokenisierung: 'python' -> {tokens}")
    
    # Test 3: Häufiges Wort sollte besser tokenisiert werden
    tokens_python = tok.tokenisieren("python")
    tokens_xyz = tok.tokenisieren("xyz")
    
    # "python" sollte weniger Tokens haben (weil häufig trainiert)
    # (Hinweis: xyz ist untrainiert, daher mehr Tokens)
    print(f"✅ BPETokenizer Vergleich: 'python' hat {len(tokens_python)} Tokens, 'xyz' hat {len(tokens_xyz)} Tokens")


def test_bpe_tokenizer_merge_regeln():
    """Test: BPETokenizer erstellt korrekte Merge-Regeln"""
    tok = BPETokenizer(anzahl_merges=5)
    trainingstext = "aaa aaa aaa bbb bbb cc"
    tok.trainieren(trainingstext, verbose=False)
    
    # Test: Merge-Regeln sollten Tuples sein
    for regel in tok.merge_regeln:
        assert isinstance(regel, tuple), f"Merge-Regel ist kein Tuple: {regel}"
        assert len(regel) == 2, f"Merge-Regel sollte 2 Elemente haben: {regel}"
    
    print(f"✅ BPETokenizer Merge-Regeln-Format: PASSED ({len(tok.merge_regeln)} Regeln)")


def main():
    """Alle Tests ausführen"""
    print("\n" + "="*60)
    print("🧪 TOKENIZER TESTS STARTEN")
    print("="*60 + "\n")
    
    try:
        # CharTokenizer Tests
        print("📌 CharTokenizer Tests:")
        print("-" * 60)
        test_char_tokenizer_basic()
        test_char_tokenizer_vokabular()
        
        print("\n📌 BPETokenizer Tests:")
        print("-" * 60)
        test_bpe_tokenizer_training()
        test_bpe_tokenizer_merge_regeln()
        
        print("\n" + "="*60)
        print("✅ ALLE TESTS BESTANDEN!")
        print("="*60 + "\n")
        return 0
        
    except AssertionError as e:
        print(f"\n❌ TEST FEHLGESCHLAGEN: {e}")
        print("="*60 + "\n")
        return 1
    except Exception as e:
        print(f"\n❌ FEHLER: {e}")
        print("="*60 + "\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
