"""Zeichen-basierter Tokenizer: jedes Zeichen bekommt eine eigene ID."""


class CharTokenizer:
    """Wandelt Text in eine Liste von Zahlen um und wieder zurueck.

    Beispiel:
        >>> tok = CharTokenizer()
        >>> ids = tok.encode("Hi!")
        >>> tok.decode(ids)
        'Hi!'
    """

    def __init__(self):
        buchstaben_gross = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"
        buchstaben_klein = "abcdefghijklmnopqrstuvwxyzäöüß"
        zahlen = "0123456789"
        sonderzeichen = " .,!?-_:;()[]{}'\"/\\@#$%&*+=<>\n"

        alle_zeichen = buchstaben_gross + buchstaben_klein + zahlen + sonderzeichen

        self.token_zu_id = {"<UNK>": 0}
        self.id_zu_token = {0: "<UNK>"}

        for i, zeichen in enumerate(sorted(set(alle_zeichen)), start=1):
            self.token_zu_id[zeichen] = i
            self.id_zu_token[i] = zeichen

        self.vokabular_groesse = len(self.token_zu_id)

    def encode(self, text: str) -> list[int]:
        """Text -> Liste von Zahlen."""
        return [self.token_zu_id.get(z, 0) for z in text]

    def decode(self, ids: list[int]) -> str:
        """Zahlen -> Text."""
        return "".join(self.id_zu_token.get(i, "<UNK>") for i in ids)
