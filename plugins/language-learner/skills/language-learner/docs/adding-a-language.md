# Adding a new language

The pipeline is language-agnostic. To add a language the skill doesn't know yet, you write one small tokenizer adapter and point a `config.yaml` at it.

## When do you actually need a new tokenizer?

You **don't** need one if:

- The language separates words with whitespace (European languages, Vietnamese, etc.) — the `GenericTokenizer` fallback already handles it.
- Another language with the same script is already supported well enough (e.g. simplified & traditional Chinese share `jieba`).

You **do** need one if:

- The language runs words together without spaces (Thai, Japanese, Chinese, Khmer, Lao, …) and needs a segmenter.
- You want to filter tokens by part-of-speech (e.g. Japanese keeps only content words via janome), or normalize to lemmas.

## Anatomy of a tokenizer adapter

All adapters subclass `pipeline.tokenizers.base.Tokenizer`. The base class gives you:

- `self.stopwords: set[str]` — injected from `config.yaml`
- `self.token_regex: re.Pattern` — injected (or overridden in `__init__`)
- `is_valid_token(t)` — default: matches regex AND not in stopwords
- `extract_candidates(text)` → `list[str]` — default: `tokenize(text)` then filter
- `vocab_id(word)` — default: `{lang_code}_{md5[:6]}`

You implement:

- `lang_code: str` — short prefix used in vocab IDs (e.g. `"th"`, `"ja"`, `"vi"`)
- `tokenize(text: str) -> list[str]` — split text into raw tokens

If your language needs a non-default character range or minimum length, set `token_regex` in `__init__` before calling `super().__init__(cfg)`.

## Walkthrough: adding Vietnamese

Vietnamese uses whitespace between syllables but words are often multi-syllable (`xin chào`, `phát triển`). The community library `underthesea` does word segmentation.

### 1. Create `pipeline/tokenizers/vietnamese.py`

```python
from __future__ import annotations
from .base import Tokenizer


class VietnameseTokenizer(Tokenizer):
    lang_code = "vi"

    def __init__(self, config: dict | None = None):
        cfg = dict(config or {})
        # Vietnamese letters + diacritics, min 2 chars
        cfg.setdefault(
            "token_regex",
            r"^[a-zA-ZàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵÀ-Ỹ]{2,}$",
        )
        super().__init__(cfg)
        self._segmenter = None

    def tokenize(self, text: str) -> list[str]:
        if self._segmenter is None:
            try:
                from underthesea import word_tokenize
            except ImportError as e:
                raise RuntimeError(
                    "underthesea is required for Vietnamese — `pip install underthesea`"
                ) from e
            self._segmenter = word_tokenize
        return [t.replace(" ", "_") for t in self._segmenter(text, format="text").split()]
```

### 2. Register in the factory

Open [pipeline/tokenizers/base.py](../pipeline/tokenizers/base.py) and add a branch to `get_tokenizer()`:

```python
if key in ("vi", "vietnamese"):
    from .vietnamese import VietnameseTokenizer
    return VietnameseTokenizer(config)
```

### 3. Write a config

Copy `examples/chinese-general/` as a starting point, then edit `config.yaml`:

```yaml
target_language: vietnamese
translation_target: en
ui_language: en

whisper:
  model_path: models/ggml-large-v3.bin

vocab:
  min_freq: 2
  max_freq: 30
  stopwords:
    - và     # and
    - là     # to be
    - của    # of
    - trong  # in
    - những
    - một
    - có
    - không
    # …add high-frequency function words
```

### 4. Smoke-test

```bash
python3 -c "
from pipeline.config import load_config
from pipeline.tokenizers import get_tokenizer
cfg = load_config('config.yaml')
tok = get_tokenizer(cfg.target_language, cfg.tokenizer_config())
print(tok.extract_candidates('Tôi đang học tiếng Việt qua YouTube.'))
"
```

Expected: `['học', 'tiếng_Việt', 'YouTube']` (or similar — whatever segmentation your library produces after stopword filtering).

## Things to get right

- **Stable `lang_code`.** Vocab IDs are persisted in `data/vocab.json`. Changing the code later breaks every saved SRS card. Pick the ISO 639-1 code and don't rename.
- **Normalize before hashing.** If your tokenizer can return either surface form or lemma, pick one and stick to it (Japanese uses `base_form`). The vocab ID is `md5(word)` — inconsistent casing or normalization silently creates duplicates.
- **Keep `tokenize()` pure.** No I/O, no network. Lazy-load the heavy library in `__init__` or on first call.
- **Stopwords are a config concern, not a code concern.** Don't hardcode them in the tokenizer file — the user's `config.yaml` is the source of truth.

## Checklist for a new language PR

- [ ] New tokenizer file under `pipeline/tokenizers/`
- [ ] Factory branch in `base.py`
- [ ] ISO code mapping in `pipeline/add_article.py`: `_iso_code()` (Whisper short code) and `_translator_code()` (deep-translator code — e.g. `zh-CN`, not `zh`) if they differ from the language name
- [ ] `examples/<lang>-*/config.yaml` with a seed stopword list
- [ ] Smoke-test output in the PR description
