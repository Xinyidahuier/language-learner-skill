"""Thai tokenizer — wraps pythainlp's newmm engine."""
from __future__ import annotations

from .base import Tokenizer


class ThaiTokenizer(Tokenizer):
    lang_code = "th"

    def __init__(self, config: dict | None = None):
        cfg = dict(config or {})
        cfg.setdefault("token_regex", r"^[\u0E00-\u0E7F]{3,}$")
        super().__init__(cfg)

    def tokenize(self, text: str) -> list[str]:
        try:
            from pythainlp import word_tokenize
        except ImportError as e:
            raise RuntimeError(
                "pythainlp is required for Thai tokenization — `pip install pythainlp`"
            ) from e
        return list(word_tokenize(text, engine="newmm"))
