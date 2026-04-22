"""Chinese tokenizer — wraps jieba."""
from __future__ import annotations

from .base import Tokenizer


class ChineseTokenizer(Tokenizer):
    lang_code = "zh"

    def __init__(self, config: dict | None = None):
        cfg = dict(config or {})
        cfg.setdefault("token_regex", r"^[\u4E00-\u9FFF]{2,}$")
        super().__init__(cfg)

    def tokenize(self, text: str) -> list[str]:
        try:
            import jieba
        except ImportError as e:
            raise RuntimeError(
                "jieba is required for Chinese — `pip install jieba`"
            ) from e
        return list(jieba.cut(text))
