"""
EIGENER TOKENIZER - von Grund auf gebaut
==========================================
Ziel: verstehen, wie ein LLM Text (Buchstaben, Zahlen, Sonderzeichen)
in etwas umwandelt, mit dem es rechnen kann (Zahlen/Vektoren).

Das ist der allererste Schritt, bevor ein Modell überhaupt "denkt".
"""


class EigenerTokenizer:
    def __init__(self):
        # Alle Zeichen, die unser Tokenizer kennen soll:
        # Grossbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen, Leerzeichen
        buchstaben_gross = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"
        buchstaben_klein = "abcdefghijklmnopqrstuvwxyzäöüß"
        zahlen = "0123456789"
        sonderzeichen = " .,!?-_:;()[]{}'\"/\\@#$%&*+=<>\n"

        alle_zeichen = buchstaben_gross + buchstaben_klein + zahlen + sonderzeichen

        # Vokabular bauen: jedes Zeichen bekommt eine eindeutige Zahl (ID)
        # 0 reservieren wir fuer "unbekanntes Zeichen"
        self.zeichen_zu_id = {"<UNK>": 0}
        self.id_zu_zeichen = {0: "<UNK>"}

        for i, zeichen in enumerate(sorted(set(alle_zeichen)), start=1):
            self.zeichen_zu_id[zeichen] = i
            self.id_zu_zeichen[i] = zeichen

        self.vokabular_groesse = len(self.zeichen_zu_id)

    def encode(self, text: str) -> list[int]:
        """Text -> Liste von Zahlen (das, was das Modell tatsaechlich sieht)"""
        return [
            self.zeichen_zu_id.get(zeichen, 0)  # 0 = <UNK> falls unbekannt
            for zeichen in text
        ]

    def decode(self, ids: list[int]) -> str:
        """Zahlen -> zurueck in Text (das, was am Ende ausgegeben wird)"""
        return "".join(self.id_zu_zeichen.get(i, "<UNK>") for i in ids)


def demo():
    tok = EigenerTokenizer()

    print("=" * 60)
    print(f"Vokabular-Groesse: {tok.vokabular_groesse} verschiedene Zeichen")
    print("=" * 60)

    beispiel_texte = [
        "Hallo Welt!",
        "RFOF-NETWORK 2026",
        "Ich baue mein eigenes LLM.",
    ]

    for text in beispiel_texte:
        ids = tok.encode(text)
        zurueck = tok.decode(ids)

        print(f"\nOriginal-Text : {text!r}")
        print(f"Als Zahlen    : {ids}")
        print(f"Wieder Text   : {zurueck!r}")
        print(f"Stimmt ueberein: {text == zurueck}")

    # Zeigen, wie EIN Zeichen konkret abgebildet wird
    print("\n" + "=" * 60)
    print("Einzelne Zeichen-Zuordnung (Beispiel):")
    print("=" * 60)
    for zeichen in ["A", "a", "5", "!", " "]:
        zid = tok.zeichen_zu_id.get(zeichen)
        print(f"  '{zeichen}'  ->  ID {zid}")


if __name__ == "__main__":
    demo()
