"""Vereinfachter Byte-Pair-Encoding-Tokenizer (Prinzip echter LLM-Tokenizer)."""

from collections import Counter


class BPETokenizer:
    """Lernt haeufige Zeichen-Kombinationen aus einem Trainingstext
    und fasst sie zu einzelnen Tokens zusammen.

    Beispiel:
        >>> tok = BPETokenizer(anzahl_merges=10)
        >>> tok.trainieren("python python python lernen lernen")
        >>> tok.tokenisieren("python")
    """

    def __init__(self, anzahl_merges: int = 20):
        self.anzahl_merges = anzahl_merges
        self.merge_regeln: list[tuple[str, str]] = []

    @staticmethod
    def _wort_in_symbole(wort: str) -> list[str]:
        return list(wort) + ["</w>"]

    def trainieren(self, text: str, verbose: bool = False) -> None:
        """Lernt Merge-Regeln aus einem Trainingstext."""
        woerter = [w for w in text.split(" ") if w]
        wort_symbole = [self._wort_in_symbole(w) for w in woerter]

        for schritt in range(self.anzahl_merges):
            paar_haeufigkeit = Counter()
            for symbole in wort_symbole:
                for i in range(len(symbole) - 1):
                    paar_haeufigkeit[(symbole[i], symbole[i + 1])] += 1

            if not paar_haeufigkeit:
                break

            haeufigstes_paar, anzahl = paar_haeufigkeit.most_common(1)[0]
            if anzahl < 2:
                break

            neues_token = "".join(haeufigstes_paar)
            self.merge_regeln.append(haeufigstes_paar)

            if verbose:
                print(f"Schritt {schritt + 1}: {haeufigstes_paar} -> '{neues_token}'")

            wort_symbole = [
                self._merge_in_symbolen(symbole, haeufigstes_paar, neues_token)
                for symbole in wort_symbole
            ]

    @staticmethod
    def _merge_in_symbolen(
        symbole: list[str], paar: tuple[str, str], neues_token: str
    ) -> list[str]:
        neue_symbole = []
        i = 0
        while i < len(symbole):
            if i < len(symbole) - 1 and (symbole[i], symbole[i + 1]) == paar:
                neue_symbole.append(neues_token)
                i += 2
            else:
                neue_symbole.append(symbole[i])
                i += 1
        return neue_symbole

    def tokenisieren(self, wort: str) -> list[str]:
        """Zerlegt ein einzelnes Wort anhand der gelernten Merge-Regeln."""
        symbole = self._wort_in_symbole(wort)
        for paar in self.merge_regeln:
            symbole = self._merge_in_symbolen(symbole, paar, "".join(paar))
        return symbole


def demo():
    """Demo des BPETokenizers mit Beispieltexten."""
    trainingstext = (
        "python python python lernen lernen lernen lernen "
        "netzwerk netzwerk netzwerk token token token token token "
        "rfof rfof rfof rfof rfof network network network"
    )

    tok = BPETokenizer(anzahl_merges=15)
    tok.trainieren(trainingstext, verbose=True)

    print("\n" + "=" * 60)
    print("BPE-Tokenizer Demo")
    print("=" * 60)
    print(f"Gelernte Merge-Regeln: {len(tok.merge_regeln)}")

    test_woerter = ["python", "lernen", "netzwerk", "token", "rfof", "network"]
    for wort in test_woerter:
        tokens = tok.tokenisieren(wort)
        print(f"  '{wort}' -> {tokens}")


if __name__ == "__main__":
    demo()
