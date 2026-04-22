"""Generic regex tokenizer — fallback for European/space-delimited languages."""
from __future__ import annotations

import re

from .base import Tokenizer

_WORD_RE = re.compile(r"[A-Za-z\u00C0-\u024F]+(?:['-][A-Za-z\u00C0-\u024F]+)*")


class GenericTokenizer(Tokenizer):
    def __init__(self, lang_code: str, config: dict | None = None):
        cfg = dict(config or {})
        cfg.setdefault("token_regex", r"^[A-Za-z\u00C0-\u024F'\-]{3,}$")
        super().__init__(cfg)
        self.lang_code = lang_code

    def tokenize(self, text: str) -> list[str]:
        return [m.group(0).lower() for m in _WORD_RE.finditer(text)]
