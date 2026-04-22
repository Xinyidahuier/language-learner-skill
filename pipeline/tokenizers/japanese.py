"""Japanese tokenizer — wraps janome.

Keeps content words (noun, verb, adj, adv). Drops particles and punctuation.
"""
from __future__ import annotations

from .base import Tokenizer

CONTENT_POS = {"名詞", "動詞", "形容詞", "副詞"}


class JapaneseTokenizer(Tokenizer):
    lang_code = "ja"

    def __init__(self, config: dict | None = None):
        cfg = dict(config or {})
        # Match any sequence of CJK / kana, min 2 chars
        cfg.setdefault(
            "token_regex",
            r"^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF々ー]{2,}$",
        )
        super().__init__(cfg)
        self._tagger = None

    def _get_tagger(self):
        if self._tagger is None:
            try:
                from janome.tokenizer import Tokenizer as Janome
            except ImportError as e:
                raise RuntimeError(
                    "janome is required for Japanese — `pip install janome`"
                ) from e
            self._tagger = Janome()
        return self._tagger

    def tokenize(self, text: str) -> list[str]:
        tagger = self._get_tagger()
        out = []
        for tok in tagger.tokenize(text):
            pos = tok.part_of_speech.split(",")[0]
            if pos in CONTENT_POS:
                # Prefer lemma (base form) when available
                surface = tok.base_form if tok.base_form and tok.base_form != "*" else tok.surface
                out.append(surface)
        return out
