"""
MINI-BPE-TOKENIZER
====================
BPE = Byte Pair Encoding. Genau dieses Prinzip nutzen echte LLMs
(GPT, Llama, etc.), nur in viel groesserem Massstab.

Grundidee:
1. Starte mit einzelnen Zeichen als Tokens
2. Finde das haeufigste Zeichen-PAAR im Text
3. Verschmelze dieses Paar zu einem neuen, EINEM Token
4. Wiederhole das viele Male

Ergebnis: haeufige Buchstaben-Kombinationen (wie "en", "der", "ing")
werden zu einzelnen Tokens - das Modell muss dann weniger Schritte
pro Wort "denken".
"""

from collections import Counter


class MiniBPE:
    def __init__(self, anzahl_merges: int = 20):
        self.anzahl_merges = anzahl_merges
        self.merge_regeln = []  # Liste von (paar) -> neues Token, in Reihenfolge

    def _wort_in_symbole(self, wort: str) -> list[str]:
        # Jedes Wort startet als Liste einzelner Zeichen + End-Marker
        return list(wort) + ["</w>"]

    def trainieren(self, text: str):
        woerter = text.split(" ")
        wort_symbole = [self._wort_in_symbole(w) for w in woerter if w]

        print(f"Training startet mit {len(wort_symbole)} Woertern...\n")

        for schritt in range(self.anzahl_merges):
            paar_haeufigkeit = Counter()
            for symbole in wort_symbole:
                for i in range(len(symbole) - 1):
                    paar_haeufigkeit[(symbole[i], symbole[i + 1])] += 1

            if not paar_haeufigkeit:
                break

            haeufigstes_paar, anzahl = paar_haeufigkeit.most_common(1)[0]
            if anzahl < 2:
                break  # kein sich wiederholendes Paar mehr -> fertig

            neues_token = "".join(haeufigstes_paar)
            self.merge_regeln.append(haeufigstes_paar)

            # Ersetze das Paar ueberall durch das neue, verschmolzene Token
            neue_wort_symbole = []
            for symbole in wort_symbole:
                neue_symbole = []
                i = 0
                while i < len(symbole):
                    if (
                        i < len(symbole) - 1
                        and (symbole[i], symbole[i + 1]) == haeufigstes_paar
                    ):
                        neue_symbole.append(neues_token)
                        i += 2
                    else:
                        neue_symbole.append(symbole[i])
                        i += 1
                neue_wort_symbole.append(neue_symbole)
            wort_symbole = neue_wort_symbole

            print(f"Schritt {schritt + 1:2d}: verschmelze {haeufigstes_paar} "
                  f"-> '{neues_token}'  (kam {anzahl}x vor)")

    def tokenisieren(self, wort: str) -> list[str]:
        symbole = self._wort_in_symbole(wort)
        for paar in self.merge_regeln:
            neue_symbole = []
            i = 0
            while i < len(symbole):
                if (
                    i < len(symbole) - 1
                    and (symbole[i], symbole[i + 1]) == paar
                ):
                    neue_symbole.append("".join(paar))
                    i += 2
                else:
                    neue_symbole.append(symbole[i])
                    i += 1
            symbole = neue_symbole
        return symbole


def demo():
    # Trainingstext: absichtlich mit Wiederholungen, damit man Muster sieht
    trainings_text = (
        "programmieren lernen macht spass "
        "ich lerne programmieren "
        "programmieren mit python "
        "python lernen ist gut "
        "ich lerne python programmieren "
    )

    bpe = MiniBPE(anzahl_merges=15)
    bpe.trainieren(trainings_text)

    print("\n" + "=" * 60)
    print("ERGEBNIS: Wie werden neue Woerter jetzt zerlegt?")
    print("=" * 60)

    test_woerter = ["programmieren", "python", "lernen", "unbekanntwort"]
    for wort in test_woerter:
        tokens = bpe.tokenisieren(wort)
        print(f"  '{wort}'  ->  {tokens}  ({len(tokens)} Tokens)")

    print("\nVergleich: ohne BPE waere jedes Wort in EINZELBUCHSTABEN")
    print("zerlegt gewesen. Mit BPE werden haeufige Teile zu einem")
    print("Token - genau wie bei echten LLM-Tokenizern (nur kleiner).")


if __name__ == "__main__":
    demo()
