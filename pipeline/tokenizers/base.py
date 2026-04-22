"""Tokenizer abstraction — one adapter per language.

A Tokenizer knows:
  • how to split text into word candidates (language-specific libraries)
  • what counts as a valid vocab candidate (token regex + stopwords)
  • how to generate a stable vocab ID (namespaced by lang_code)
"""
from __future__ import annotations

import hashlib
import re
from abc import ABC, abstractmethod


class Tokenizer(ABC):
    lang_code: str = ""

    def __init__(self, config: dict | None = None):
        cfg = config or {}
        self.stopwords: set[str] = set(cfg.get("stopwords", []))
        pattern = cfg.get("token_regex", r"^\S{3,}$")
        self.token_regex: re.Pattern = re.compile(pattern)

    @abstractmethod
    def tokenize(self, text: str) -> list[str]:
        """Split text into raw tokens. Subclass responsibility."""

    def is_valid_token(self, token: str) -> bool:
        t = token.strip()
        return bool(self.token_regex.match(t)) and t not in self.stopwords

    def extract_candidates(self, text: str) -> list[str]:
        """Tokenize + filter — the usual entry point for vocab mining."""
        return [t.strip() for t in self.tokenize(text) if self.is_valid_token(t.strip())]

    def vocab_id(self, word: str) -> str:
        h = hashlib.md5(word.encode()).hexdigest()[:6]
        return f"{self.lang_code}_{h}"


def get_tokenizer(lang: str, config: dict | None = None) -> Tokenizer:
    """Factory — return a Tokenizer for the given language code/name."""
    key = (lang or "").lower()
    if key in ("th", "thai"):
        from .thai import ThaiTokenizer
        return ThaiTokenizer(config)
    if key in ("ja", "jp", "japanese"):
        from .japanese import JapaneseTokenizer
        return JapaneseTokenizer(config)
    if key in ("zh", "chinese", "zh-cn", "zh-hans"):
        from .chinese import ChineseTokenizer
        return ChineseTokenizer(config)
    from .generic import GenericTokenizer
    return GenericTokenizer(key or "xx", config)
