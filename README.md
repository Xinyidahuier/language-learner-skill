# Language Learner

A Claude Code skill that turns any YouTube video, audio file, or article into a personal language-learning site — with sentence-level audio, frequency-mined vocab, and spaced repetition review.

<!-- TODO: embed a 30-second demo GIF here:
  URL → "processing…" → open reader.html → click a vocab word → review.html → rate card
-->

## What This Does

If you've ever opened Duolingo and thought *"this is teaching me nothing I want to say in real life"* — this skill is for you.

You give Claude a piece of content you *actually* want to understand: a YouTube video of your favorite podcast, a news article, an audio file from a friend. The skill:

1. Transcribes it sentence-by-sentence (local Whisper, no API)
2. Translates each sentence
3. Mines vocabulary by frequency inside **your own content** — not a textbook list
4. Builds a static HTML site: reader, vocab browser, SM-2 flashcards
5. Leaves everything in flat JSON files you own and can host anywhere

The theory of change: the vocab you see three times tonight in a video you wanted to watch beats the vocab on page 47 of a book you didn't.

## Key Features

- **Own Your Content** — The learner picks what to study. The skill stays opinionated about *method*, agnostic about *material*.
- **Listening First** — Card fronts default to audio, not text. Reading mode exists but requires a deliberate toggle.
- **Mine, Don't Memorize** — Vocab is ranked by frequency inside your corpus, filtered by a per-language stopword list. No pre-made HSK / JLPT decks.
- **Zero Backend** — Three JSON files + static HTML. Host on GitHub Pages for free, or keep it entirely offline.
- **One Pipeline, Many Languages** — Tokenizer adapter pattern. 40 lines of code adds a new language.
- **Resumable, Forkable, Yours** — Export is `tar czf`. No cloud lock-in, no account, no subscription.

## Installation

Clone the repo into your Claude Code skills directory:

```bash
git clone https://github.com/Xinyidahuier/language-learner-skill ~/.claude/skills/language-learner
```

Then in Claude Code:

```
/language-learner
```

Or just ask naturally — Claude will match the skill by description:

```
> 帮我搭一个日语学习网站
> I want to self-study Spanish from podcast episodes
```

## Usage

```
/language-learner

> "I want to learn Japanese from YouTube interviews with CEOs"
```

The skill will:

1. Ask target language, translation language, and a domain prompt (proper nouns / jargon Whisper should expect)
2. Scaffold the project into your current directory (HTML/CSS/JS + Python pipeline + empty data)
3. Install Python deps (`deep-translator`, `yt-dlp`, `pyyaml`, plus the per-language tokenizer)
4. Offer to process your first piece of content

### Add a YouTube video

```bash
python3 pipeline/add_article.py --config config.yaml --project-root . \
  --url https://www.youtube.com/watch?v=...
```

### Add an audio file

```bash
python3 pipeline/add_article.py --config config.yaml --project-root . \
  --audio interview.mp3 --title "CEO interview — March 2026"
```

### Add a text article (no audio)

```bash
python3 pipeline/add_article.py --config config.yaml --project-root . \
  --text article.txt --title "Nikkei — semiconductor policy"
```

Then open `index.html` in a browser (or `python3 -m http.server 8000`).

## Supported Languages

| Language | Tokenizer | Status |
|---|---|---|
| Thai | pythainlp | ✅ reference example ([`examples/thai-business/`](examples/thai-business/)) |
| Chinese | jieba | ✅ validated end-to-end ([`examples/chinese-general/`](examples/chinese-general/)) |
| Japanese | janome | ✅ validated end-to-end (POS filter + lemma normalization working) |
| Korean | — | planned (would use konlpy or mecab-ko) |
| Any other | regex fallback | ✅ basic (whitespace-separated languages) |

Adding a language is ~40 lines — see [`docs/adding-a-language.md`](docs/adding-a-language.md) for a Vietnamese walkthrough.

## Architecture

The skill follows **progressive disclosure** — `SKILL.md` is a ~100-line map; the heavy lifting lives in files that only get copied into the user's project when they actually scaffold.

| File                              | Purpose                                | Loaded / Copied When      |
| --------------------------------- | -------------------------------------- | ------------------------- |
| `SKILL.md`                        | 9-step scaffold workflow for Claude    | Always (skill invocation) |
| `examples/<lang>/`                | Working reference project              | Step 3 (cloned into cwd)  |
| `pipeline/add_article.py`         | YouTube/audio/text → JSON pipeline     | Step 3 (copied into cwd)  |
| `pipeline/config.py`              | YAML config schema + loader            | Step 3 (copied into cwd)  |
| `pipeline/tokenizers/base.py`     | Abstract tokenizer + factory           | Step 3 (copied into cwd)  |
| `pipeline/tokenizers/<lang>.py`   | One adapter per language               | Step 3 (copied into cwd)  |
| `docs/methodology.md`             | Why this approach works                | Reference only            |
| `docs/adding-a-language.md`       | How to contribute a new tokenizer      | Reference only            |

This keeps `SKILL.md` scannable for Claude and keeps the user's scaffolded project self-contained — they can delete `~/.claude/skills/language-learner/` after scaffolding and their project still works.

## Philosophy

1. **The learner picks the content; the tool picks the method.** A business-Thai speaker learning industry jargon and a Japanese learner binging VTubers share the same pipeline with different configs.

2. **Audio is the ground truth. Text is a scaffold.** For Thai tones, Mandarin tones, Japanese pitch accent, forcing the ear first matters more than most apps acknowledge.

3. **Vocab you encountered beats vocab a textbook suggested.** Frequency inside *your* corpus is a better signal than someone else's word list.

4. **Dependencies rot. Flat JSON and static HTML do not.** No npm, no accounts, no cloud sync. A project built today will still work in 2035.

5. **The tool should disappear.** Once scaffolded, the user owns a plain folder. They can edit it, fork it, host it, abandon it. The skill is not a platform.

## Related Work

- [Refold](https://refold.la/) — the community guide to immersion learning whose workflow this tool automates.
- [Language Reactor](https://www.languagereactor.com/) — browser extension with a similar ethos for Netflix/YouTube; this skill differs in being open-source, local-first, and giving you ownership of the mined cards.
- Krashen's [input hypothesis](https://en.wikipedia.org/wiki/Input_hypothesis) — the pedagogical motivation.

## Example Projects

- [learn-thai](https://github.com/Xinyidahuier/learn-thai) — business Thai immersion site (the original project this skill was extracted from)

## Credits

Built by [@Xinyidahuier](https://github.com/Xinyidahuier) with Claude Code, while procrastinating on Thai business vocabulary.

Inspired by the Refold community, Language Reactor, and the general feeling that Duolingo's green owl had nothing left to teach me.

## License

MIT — use it, fork it, share it.
