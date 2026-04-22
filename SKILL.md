---
name: language-learner
description: Scaffold a personal language-learning site that turns YouTube videos, audio files, or articles into SRS flashcards with synced sentence audio, vocab highlighting, and spaced review. Use when the user wants to self-study a foreign language by immersing in their own chosen content. Supports any language with a tokenizer adapter (Thai, Japanese, Chinese, Korean, Spanish, French, etc.).
allowed-tools: Bash, Read, Write, Edit
argument-hint: [target-language]
---

# Language Learner — Immersion SRS Site

Scaffold a complete self-hosted language learning web app + content pipeline into the user's current directory.

## 1. Gather requirements

Ask the user:
- **Target language** (e.g. "Thai", "Japanese") — determines tokenizer
- **Translation language** (e.g. "English", "Chinese") — deep-translator target
- **Domain focus** (optional: "business", "news", "daily conversation") — shapes the Whisper initial prompt
- **UI language** (e.g. "English", "Chinese") — UI copy

## 2. Check prerequisites

Run and report what's missing:
- `ffmpeg -version`
- `yt-dlp --version`
- `python3 --version` (needs 3.9+)
- Whisper model at `models/ggml-large-v3.bin` (offer to download via `curl` from huggingface if missing)

## 3. Scaffold project

Copy `${CLAUDE_SKILL_DIR}/templates/` into `./` and replace placeholders:
- `{{TARGET_LANG}}`, `{{TRANSLATION_LANG}}`, `{{UI_LANG}}`, `{{DOMAIN_PROMPT}}`
- `{{TOKENIZER_IMPORT}}` — the Python import line for the target language's tokenizer

Key files to write:
- `index.html`, `reader.html`, `review.html`, `vocab.html`
- `style.css`, `reader.css`, `app.js`, `home.js`, `reader.js`, `review.js`, `vocab.js`
- `scripts/add_article.py`
- `scripts/tokenizers/{base,thai,japanese,chinese,generic}.py`
- `config.yaml` — holds language config, stopwords, freq caps
- `data/{articles,sentences,vocab}.json` — empty arrays `[]`

## 4. Install Python deps

```
pip install deep-translator yt-dlp pyyaml
# Plus tokenizer per language:
# thai: pythainlp
# japanese: janome
# chinese: jieba
# generic: (no extra — falls back to regex)
```

## 5. First content item

Offer to process the user's first piece of content:
- `python3 scripts/add_article.py --url <YouTube URL>`
- `python3 scripts/add_article.py --audio <file> --title "..."`
- `python3 scripts/add_article.py --text <file> --title "..."`

## 6. Optional: GitHub Pages deploy

If user wants public access:
1. `gh repo create <name> --public --source=. --push`
2. Enable Pages in repo settings pointing to `main` branch root
3. Return URL `https://<user>.github.io/<repo>/`

## Reference

- [examples/thai-business/](examples/thai-business/) — working configuration for business-Thai learner
- [docs/methodology.md](docs/methodology.md) — why this approach (Whisper → SRS → listening-first)
- [docs/adding-a-language.md](docs/adding-a-language.md) — how to add a new tokenizer
