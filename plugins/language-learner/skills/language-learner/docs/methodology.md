# Methodology

Why this tool exists and what it's optimizing for.

## The problem

Adult self-study of a foreign language gets stuck in two familiar ruts:

1. **Textbook/app fatigue.** Duolingo, Anki pre-made decks, HSK workbooks — the content is competent but generic. It has nothing to do with what the learner actually wants to listen to next weekend.
2. **"Just watch Netflix" without scaffolding.** Native content is the gold standard, but without segmented audio, vocab extraction, and a review schedule, most learners bounce off and go back to the textbook.

This skill closes the gap: any piece of content (YouTube, podcast, article) the learner is actually motivated to engage with becomes a graded lesson with audio, translations, highlighted vocab, and SRS review — in the time it takes to fetch the file.

## Design principles

### 1. The learner picks the content, not the product

The product contributes tokenization, translation, and SRS scheduling. It contributes zero editorial opinion on what to study. A business-Thai speaker learning industry jargon and a Japanese learner binging VTubers share the same pipeline with different configs.

### 2. Listening first, reading second

Flashcard "fronts" default to the audio clip, not the written form. The learner is forced to parse sound before they see spelling or gloss. For phonologically dense languages (Thai tones, Mandarin tones, Japanese pitch accent), this matters more than most apps acknowledge.

Reading-first modes exist but require a deliberate toggle.

### 3. Vocab is mined, not pre-selected

The pipeline tokenizes every ingested article, counts word frequency, and ranks candidates by:

- Frequency within the user's corpus (not some external frequency list)
- Exclusion of a language-specific stopword list (particles, pronouns, auxiliaries)
- Exclusion of already-learned words (carried in `data/vocab.json`)

A word the user has never seen but which appears three times in tonight's video is a better SRS card than the next item on an HSK textbook list. This is the core wager of the tool.

### 4. SRS is cheap; content is expensive

The scheduling algorithm (SM-2) is well-understood and fifty lines of code. What makes the tool useful is the upstream pipeline — Whisper transcription, sentence-level alignment, batched translation, vocab extraction — turning a 40-minute YouTube video into a review-ready deck in one command.

### 5. Own your data

Everything lives in flat JSON files in the user's own directory. No accounts, no cloud sync, no vendor lock-in. Export is a `tar czf`. The user can host it on GitHub Pages for free, or keep it entirely offline.

## Pipeline stages

```
input (URL / audio / text)
    │
    ▼
[whisper.cpp]  ──────▶  transcript (SRT) + per-sentence timestamps
    │
    ▼
[sentence assembly]  ──▶  sentences with start/end timestamps, audio slices
    │
    ▼
[deep-translator]  ────▶  sentence-level glosses (batched, 20 at a time)
    │
    ▼
[tokenizer adapter]  ──▶  vocab candidates (language-specific)
    │
    ▼
[filter + rank]  ──────▶  new vocab (freq ∈ [min, max], not stopword, not already known)
    │
    ▼
[annotation]  ─────────▶  sentences get char-range annotations linking to vocab
    │
    ▼
data/{articles,sentences,vocab}.json
```

The frontend (`index.html` / `reader.html` / `review.html` / `vocab.html`) reads these three JSON files directly — no backend.

## Why these specific tools

- **whisper.cpp + large-v3** — best open-weights multilingual ASR; runs locally on a Mac without GPU; handles Thai/Japanese/Chinese without a model-per-language juggle.
- **deep-translator** — wraps Google Translate without an API key. Good enough for gisting; not a terminal-quality translation, and that's fine — the learner is cross-checking against the audio.
- **pythainlp / janome / jieba** — community-maintained segmenters with sensible defaults. Adapter pattern means swapping is a 40-line file.
- **SM-2** — the Anki-default SRS algorithm. Not the newest, but well-understood, easy to debug, and preserves interval state across export/import.

## What this is not

- **Not a translator.** Translations are a scaffold for the listening task, not the output.
- **Not a classroom.** No lessons, no curriculum, no grammar drills. The user brings those.
- **Not a conversational partner.** No TTS, no dialogue generation. Input-only study.
- **Not a cloud service.** Everything runs locally. The only network calls are to YouTube (for downloads) and Google Translate (for glosses).

## Related ideas

- [Krashen's input hypothesis](https://en.wikipedia.org/wiki/Input_hypothesis) — the motivating framework for comprehensible-input study.
- [Refold](https://refold.la/) — a community guide to immersion-based learning. This tool is a DIY version of the "sentence mining" workflow they recommend.
- [Language Reactor](https://www.languagereactor.com/) — browser extension with a similar ethos for Netflix/YouTube; differs in that it's closed-source, cloud-based, and doesn't give you ownership of the mined cards.
