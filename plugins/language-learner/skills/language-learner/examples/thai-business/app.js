// Core shared logic: data loading, storage, SRS algorithm

const STORAGE_KEY = 'learn-thai-progress-v1';
const DATA_URLS = {
  articles: 'data/articles.json',
  sentences: 'data/sentences.json',
  vocab: 'data/vocab.json',
};

const App = {
  data: { articles: [], sentences: [], vocab: [] },
  progress: null,

  async loadData() {
    const [articles, sentences, vocab] = await Promise.all([
      this._fetchJson(DATA_URLS.articles, []),
      this._fetchJson(DATA_URLS.sentences, []),
      this._fetchJson(DATA_URLS.vocab, []),
    ]);
    this.data = { articles, sentences, vocab };
    // Apply local status overrides
    const p = this.loadProgress();
    const overrides = p.articleStatus || {};
    for (const a of articles) {
      if (overrides[a.id]) a.status = overrides[a.id];
    }
    return this.data;
  },

  async _fetchJson(url, fallback) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) return fallback;
      return await r.json();
    } catch (e) {
      return fallback;
    }
  },

  loadProgress() {
    if (this.progress) return this.progress;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.progress = raw ? JSON.parse(raw) : this._freshProgress();
    } catch {
      this.progress = this._freshProgress();
    }
    return this.progress;
  },

  _freshProgress() {
    return {
      cards: {},              // cardId -> {ease, interval, reps, due, lastReviewed, lapses}
      savedVocab: {},         // vocab_id -> {addedAt}
      savedSentences: {},     // sentence_id -> {addedAt}
      favoriteArticles: {},   // article_id -> {addedAt}
      articleStatus: {},      // article_id -> 'finished' (overrides articles.json)
      stats: { totalReviews: 0, lastReviewDate: null, streakDays: 0 },
      settings: { mode: 'listening' },
    };
  },

  saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
  },

  // Get card state (creates fresh if unseen)
  getCardState(cardId) {
    const p = this.loadProgress();
    if (!p.cards[cardId]) {
      p.cards[cardId] = {
        ease: 2.5,
        interval: 0,
        reps: 0,
        due: new Date().toISOString(),
        lastReviewed: null,
        lapses: 0,
      };
    }
    return p.cards[cardId];
  },

  // SM-2 algorithm with Anki-style buttons
  // quality: 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
  // Returns new state with next interval
  rateCard(cardId, quality) {
    const p = this.loadProgress();
    const c = this.getCardState(cardId);
    const now = new Date();

    if (quality < 3) {
      // Again
      c.reps = 0;
      c.interval = 0;
      c.lapses = (c.lapses || 0) + 1;
      c.ease = Math.max(1.3, c.ease - 0.2);
      // Due in ~10 min
      c.due = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    } else {
      c.reps += 1;
      if (c.reps === 1) {
        c.interval = quality === 5 ? 4 : 1;
      } else if (c.reps === 2) {
        c.interval = quality === 5 ? 7 : 3;
      } else {
        let mult = quality === 5 ? c.ease * 1.3 : (quality === 3 ? 1.2 : c.ease);
        c.interval = Math.round(c.interval * mult);
      }
      // Adjust ease
      if (quality === 3) c.ease = Math.max(1.3, c.ease - 0.15);
      else if (quality === 5) c.ease = c.ease + 0.15;
      // quality 4 (Good) → ease unchanged
      c.due = new Date(now.getTime() + c.interval * 86400000).toISOString();
    }

    c.lastReviewed = now.toISOString();

    // Stats
    p.stats.totalReviews += 1;
    const today = now.toISOString().slice(0, 10);
    if (p.stats.lastReviewDate !== today) {
      const last = p.stats.lastReviewDate;
      if (last) {
        const diff = (new Date(today) - new Date(last)) / 86400000;
        p.stats.streakDays = diff === 1 ? (p.stats.streakDays + 1) : 1;
      } else {
        p.stats.streakDays = 1;
      }
      p.stats.lastReviewDate = today;
    }

    this.saveProgress();
    return c;
  },

  // Preview intervals for UI buttons (without committing)
  previewIntervals(cardId) {
    const c = this.getCardState(cardId);
    const fmt = (days) => {
      if (days < 1/24/6) return '<10m';
      if (days < 1) return Math.round(days * 24) + 'h';
      if (days < 30) return Math.round(days) + 'd';
      if (days < 365) return Math.round(days / 30) + 'mo';
      return Math.round(days / 365) + 'y';
    };
    let again = 10 / 60 / 24;
    let hard, good, easy;
    if (c.reps === 0) {
      hard = 1; good = 1; easy = 4;
    } else if (c.reps === 1) {
      hard = 3; good = 3; easy = 7;
    } else {
      hard = Math.round(c.interval * 1.2);
      good = Math.round(c.interval * c.ease);
      easy = Math.round(c.interval * c.ease * 1.3);
    }
    return {
      again: fmt(again),
      hard: fmt(hard),
      good: fmt(good),
      easy: fmt(easy),
    };
  },

  // Build a vocab flashcard with example sentence
  _buildVocabCard(vocabId) {
    const vocab = this.data.vocab.find(v => v.id === vocabId);
    if (!vocab) return null;
    let example = null;
    for (const s of this.data.sentences) {
      if (s.audio_url && (s.annotations || []).some(a => a.vocab_id === vocabId)) {
        example = s;
        break;
      }
    }
    return {
      id: `v:${vocabId}`,
      type: 'vocab',
      vocab,
      thai: vocab.text || vocab.thai,
      romanization: vocab.romanization,
      translation: vocab.translation || vocab.english || '',
      audio_url: example ? example.audio_url : null,
      example_thai: example ? (example.text || example.thai) : null,
      example_trans: example ? (example.translation || example.english || '') : null,
    };
  },

  // Build a sentence flashcard
  _buildSentenceCard(sentenceId) {
    const s = this.data.sentences.find(x => x.id === sentenceId);
    if (!s) return null;
    return {
      id: `s:${sentenceId}`,
      type: 'sentence',
      thai: s.text || s.thai,
      romanization: s.romanization || '',
      translation: s.translation || s.english || '',
      audio_url: s.audio_url,
      annotations: s.annotations || [],
      sentence: s,
    };
  },

  // All saved cards (for browsing total collection)
  getAllCards() {
    const p = this.loadProgress();
    const cards = [];
    for (const vid of Object.keys(p.savedVocab || {})) {
      const c = this._buildVocabCard(vid);
      if (c) cards.push(c);
    }
    for (const sid of Object.keys(p.savedSentences || {})) {
      const c = this._buildSentenceCard(sid);
      if (c) cards.push(c);
    }
    return cards;
  },

  // Review queue combines saved vocab + saved sentences
  getReviewQueue(limit = 50) {
    const p = this.loadProgress();
    const now = new Date();
    const due = [];
    const newCards = [];
    const all = [];

    for (const vid of Object.keys(p.savedVocab || {})) {
      const c = this._buildVocabCard(vid);
      if (c) all.push(c);
    }
    for (const sid of Object.keys(p.savedSentences || {})) {
      const c = this._buildSentenceCard(sid);
      if (c) all.push(c);
    }

    for (const card of all) {
      const state = p.cards[card.id];
      if (!state) newCards.push(card);
      else if (new Date(state.due) <= now) due.push(card);
    }
    due.sort((a, b) => new Date(p.cards[a.id].due) - new Date(p.cards[b.id].due));
    const maxNew = 10;
    return [...due, ...newCards.slice(0, maxNew)].slice(0, limit);
  },

  getCounts() {
    const p = this.loadProgress();
    const savedV = Object.keys(p.savedVocab || {});
    const savedS = Object.keys(p.savedSentences || {});
    const allIds = [...savedV.map(id => `v:${id}`), ...savedS.map(id => `s:${id}`)];
    const now = new Date();
    let due = 0, newC = 0;
    for (const cardId of allIds) {
      const state = p.cards[cardId];
      if (!state) newC += 1;
      else if (new Date(state.due) <= now) due += 1;
    }
    return {
      due,
      new: newC,
      total: allIds.length,
      streak: p.stats.streakDays || 0,
    };
  },

  // Toggle helpers
  toggleSavedSentence(sentenceId) {
    const p = this.loadProgress();
    if (!p.savedSentences) p.savedSentences = {};
    if (p.savedSentences[sentenceId]) {
      delete p.savedSentences[sentenceId];
    } else {
      p.savedSentences[sentenceId] = { addedAt: new Date().toISOString() };
    }
    this.saveProgress();
    return !!p.savedSentences[sentenceId];
  },

  isSavedSentence(sentenceId) {
    const p = this.loadProgress();
    return !!(p.savedSentences && p.savedSentences[sentenceId]);
  },

  // Favorite articles
  toggleFavoriteArticle(articleId) {
    const p = this.loadProgress();
    if (!p.favoriteArticles) p.favoriteArticles = {};
    if (p.favoriteArticles[articleId]) {
      delete p.favoriteArticles[articleId];
    } else {
      p.favoriteArticles[articleId] = { addedAt: new Date().toISOString() };
    }
    this.saveProgress();
    return !!p.favoriteArticles[articleId];
  },

  isFavoriteArticle(articleId) {
    const p = this.loadProgress();
    return !!(p.favoriteArticles && p.favoriteArticles[articleId]);
  },

  // Article status (finished/studying) — stored in localStorage, not articles.json
  setArticleStatus(articleId, status) {
    const p = this.loadProgress();
    if (!p.articleStatus) p.articleStatus = {};
    if (status === 'finished') {
      p.articleStatus[articleId] = 'finished';
    } else {
      delete p.articleStatus[articleId];
    }
    this.saveProgress();
    // Also reflect on in-memory article object for rendering
    const a = this.data.articles.find(x => x.id === articleId);
    if (a) a.status = status;
  },

  getArticleStatus(articleId) {
    const p = this.loadProgress();
    const override = p.articleStatus && p.articleStatus[articleId];
    if (override) return override;
    const a = this.data.articles.find(x => x.id === articleId);
    return (a && a.status) || 'studying';
  },

  exportProgress() {
    return JSON.stringify(this.loadProgress(), null, 2);
  },

  importProgress(jsonText) {
    const parsed = JSON.parse(jsonText);
    this.progress = parsed;
    this.saveProgress();
  },

  resetProgress() {
    this.progress = this._freshProgress();
    this.saveProgress();
  },

  // Mode
  getMode() { return this.loadProgress().settings.mode || 'listening'; },
  setMode(mode) {
    const p = this.loadProgress();
    p.settings.mode = mode;
    this.saveProgress();
  },
};
