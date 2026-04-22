# language-learner

A Claude Code skill that scaffolds a self-hosted immersion-learning site for any language.

Paste a YouTube URL, audio file, or article → get back an interactive page with:
- Sentence-level audio playback
- Vocab highlighting with click-to-see meaning
- SM-2 spaced repetition review (listening & speaking modes)
- Frequency-filtered vocab (no highlighting every common word)

## Install

```bash
git clone https://github.com/<you>/language-learner-skill ~/.claude/skills/language-learner
```

Then in Claude Code:

```
/language-learner
```

Claude will ask about your target language and scaffold the project into the current directory.

## Supported languages

| Language | Tokenizer | Status |
|---|---|---|
| Thai | pythainlp | ✅ reference example |
| Japanese | janome | planned |
| Chinese | jieba | planned |
| Korean | konlpy | planned |
| Any other | regex fallback | ✅ basic |

## Example projects built with this skill

- [learn-thai](https://github.com/Xinyidahuier/learn-thai) — business Thai immersion site

## License

MIT
