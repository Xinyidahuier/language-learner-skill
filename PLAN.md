# Refactor Plan — from learn-thai to shareable skill

## Phase 1: Abstract tokenizer (language-agnostic pipeline)
- [ ] Create `pipeline/tokenizers/base.py` — `Tokenizer` protocol with `tokenize(text) -> list[str]`
- [ ] Implement `thai.py` wrapping pythainlp
- [ ] Implement `japanese.py` wrapping janome
- [ ] Implement `chinese.py` wrapping jieba
- [ ] Implement `generic.py` — regex word-boundary fallback for European languages
- [ ] Update `add_article.py` to import tokenizer by language code

## Phase 2: Config-driven pipeline
- [ ] Extract `WHISPER_PROMPT` → `config.yaml` `whisper_prompt`
- [ ] Extract `STOPWORDS` → `config.yaml` per language
- [ ] Extract `min_freq` / `max_freq` → `config.yaml`
- [ ] Extract translation target language → `config.yaml` `translation_target`

## Phase 3: UI i18n
- [ ] Extract Chinese UI strings from HTML/JS into `i18n/zh.json` + `i18n/en.json`
- [ ] Load i18n dict at app startup, render via `i18n(key)` helper
- [ ] Add `ui_language` to `config.yaml`

## Phase 4: Templatize
- [ ] Turn HTML/JS files into templates with `{{PLACEHOLDERS}}`
- [ ] Copy learn-thai code into `examples/thai-business/` as a working reference
- [ ] SKILL.md handler: copy templates + substitute placeholders

## Phase 5: Validate on a second language
- [ ] Run the skill for Japanese on a sample article
- [ ] Confirm tokenization + highlighting + SRS all work

## Phase 6: Polish & publish
- [ ] Write `docs/methodology.md`
- [ ] Write `docs/adding-a-language.md`
- [ ] Record 60s demo gif
- [ ] Push to GitHub, post on X + HN + r/ClaudeAI + 小红书
