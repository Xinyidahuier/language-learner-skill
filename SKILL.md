---
name: language-learner
description: Scaffold a personal language-learning site that turns YouTube videos, audio files, or articles into SRS flashcards with synced sentence audio, vocab highlighting, and spaced review. Use when the user wants to self-study a foreign language by immersing in their own chosen content. Built-in tokenizers: Thai, Japanese, Chinese, Korean; any other language falls back to a generic word-boundary tokenizer.
allowed-tools: Bash, Read, Write, Edit
argument-hint: [target-language]
---

# Language Learner — Immersion SRS Site

Scaffold a complete self-hosted language-learning web app + content pipeline into the user's current directory.

`$SKILL_DIR` below refers to the directory this SKILL.md lives in.

## 1. Gather requirements

Ask concisely, in one message:

- **Target language** (e.g. "Thai", "Japanese", "Chinese", "Korean", "Spanish")
- **Translation language** for glosses (default: English)
- **Domain focus** (optional — e.g. "business", "news", "daily conversation"). Used as the Whisper initial-prompt to bias transcription toward proper nouns / jargon.
- **UI language** for labels (default: English)

## 2. Pick a starting example

Map the target language to the closest existing example:

| Target | Starting example       |
|--------|------------------------|
| Thai   | `examples/thai-business/`     |
| Chinese| `examples/chinese-general/`   |
| Japanese/Korean/other | `examples/chinese-general/` (closest CJK / generic frontend) |

## 3. Scaffold into user's cwd

```bash
PROJECT_DIR="$(pwd)"
# Copy the chosen example (HTML/CSS/JS + empty data/)
cp -r "$SKILL_DIR/examples/<chosen>/." "$PROJECT_DIR/"
# Copy the language-agnostic pipeline
cp -r "$SKILL_DIR/pipeline" "$PROJECT_DIR/"
# Reset data to empty
mkdir -p "$PROJECT_DIR/data"
for f in articles sentences vocab; do echo '[]' > "$PROJECT_DIR/data/$f.json"; done
```

## 4. Update `config.yaml`

Edit the copied `config.yaml`:

- `target_language:` → user's answer (lowercase name: `thai`, `japanese`, `chinese`, `korean`, or an ISO code like `es`/`fr`)
- `translation_target:` → `en` / `zh` / etc.
- `ui_language:` → `en` / `zh`
- `whisper.initial_prompt:` → a line of domain-relevant terms (ask user for proper nouns they expect to hear)
- `vocab.stopwords:` → if a language-specific stopword list isn't obvious, leave as `[]` and tell user to add function words later
- `vocab.min_freq` / `max_freq:` → defaults `2` and `30` are fine

## 5. Update branding

Edit `index.html`, `reader.html`, `review.html`, `vocab.html`:

- `<title>` → `Learn <Language> — <Domain>`
- `<h1>Learn <Language>` + subtitle in the header

Regenerate `logo.svg`: keep the green tile + white speech bubble + centered native character. Swap:

- The character inside the bubble (e.g. `ก` Thai, `中` Chinese, `あ` Japanese, `한` Korean)
- The small corner flag badge (bottom-right, ~20×14, same shape as in `examples/chinese-general/logo.svg`)

## 6. Install Python deps

```bash
python3 -m pip install deep-translator yt-dlp pyyaml
# Plus tokenizer for the chosen language:
#   thai      → pythainlp
#   japanese  → janome
#   chinese   → jieba
#   (generic: regex fallback — no extra dep)
```

## 7. Check prerequisites

Run and report what's missing; install if user agrees:

- `ffmpeg -version` (audio pipeline)
- `yt-dlp --version` (YouTube ingest)
- Whisper binary — `whisper-cli` or `main` in `$PATH`
- Whisper model at `models/ggml-large-v3.bin` — if missing, offer:
  ```bash
  mkdir -p models && curl -L -o models/ggml-large-v3.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
  ```

## 8. First content item

Offer to process the user's first piece of content:

- `python3 pipeline/add_article.py --config config.yaml --project-root . --url <YouTube URL>`
- `python3 pipeline/add_article.py --config config.yaml --project-root . --audio <file> --title "..."`
- `python3 pipeline/add_article.py --config config.yaml --project-root . --text <file> --title "..."`

Then open `index.html` in a browser (or run `python3 -m http.server 8000` and visit `http://localhost:8000`).

## 9. Optional: GitHub Pages deploy

If the user wants a public URL:

1. `gh repo create <name> --public --source=. --push`
2. Enable Pages in repo settings pointing to `main` branch root
3. Return URL `https://<user>.github.io/<repo>/`

## Reference

- [examples/thai-business/](examples/thai-business/) — working setup for business-Thai learner
- [examples/chinese-general/](examples/chinese-general/) — working setup for general Chinese
- [docs/adding-a-language.md](docs/adding-a-language.md) — write a new tokenizer adapter
- [docs/methodology.md](docs/methodology.md) — why this approach (Whisper → SRS → listening-first)
