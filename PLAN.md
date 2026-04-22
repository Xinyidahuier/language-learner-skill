# Refactor Plan — from learn-thai to shareable skill

## Phase 1: Abstract tokenizer (language-agnostic pipeline) ✅
- [x] Create `pipeline/tokenizers/base.py` — `Tokenizer` abstract class with `tokenize`/`extract_candidates`/`vocab_id`
- [x] Implement `thai.py` wrapping pythainlp newmm
- [x] Implement `japanese.py` wrapping janome (content-POS filter)
- [x] Implement `chinese.py` wrapping jieba
- [x] Implement `generic.py` — regex word-boundary fallback for European languages
- [ ] Update `add_article.py` to import tokenizer by language code (Phase 2/4)

## Phase 2: Config-driven pipeline ✅
- [x] `pipeline/config.py` — dataclass schema + yaml loader
- [x] `examples/thai-business/config.yaml` — reproduces learn-thai's current setup (144 stopwords, 25 fillers, whisper prompt, freq 2-30)
- [x] Smoke-tested: `load_config` → tokenizer factory → extract_candidates, all pass

## Phase 3: UI i18n
- [ ] Extract Chinese UI strings from HTML/JS into `i18n/zh.json` + `i18n/en.json`
- [ ] Load i18n dict at app startup, render via `i18n(key)` helper
- [ ] Add `ui_language` to `config.yaml`

## Phase 4: Templatize / generalize pipeline ✅ (core)
- [x] Copy learn-thai HTML/CSS/JS into `examples/thai-business/` (with empty data arrays, no audio)
- [x] `pipeline/add_article.py` — generic pipeline driven by config + tokenizer factory
  - text/audio/youtube input, Whisper lang code from config, translation batching, vocab mining with configurable freq caps, annotation
  - uses unified `text` field (pipeline-agnostic of target language)
- [x] End-to-end smoke test on Thai config — pipeline produced correct sentences + translations
- [ ] Update `examples/thai-business/` JS to read `s.text` (deferred — part of Phase 3 i18n)
- [ ] SKILL.md scaffold handler: "clone example + swap config" (Phase 6)

## Phase 5: Validate on a second language
- [ ] Run the skill for Japanese on a sample article
- [ ] Confirm tokenization + highlighting + SRS all work

## Phase 6: Polish & publish
- [ ] Write `docs/methodology.md`
- [ ] Write `docs/adding-a-language.md`
- [ ] Record 60s demo gif
- [ ] Push to GitHub, post on X + HN + r/ClaudeAI + 小红书
