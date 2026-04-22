// Reader page logic

(async () => {
  await App.loadData();
  App.loadProgress();

  const params = new URLSearchParams(location.search);
  const articleId = params.get('v') || params.get('a');
  if (!articleId) {
    document.getElementById('transcript').innerHTML = '<p class="muted">缺少文章参数。<a href="index.html">返回首页</a></p>';
    return;
  }

  const article = App.data.articles.find(a => a.id === articleId);
  const sentences = App.data.sentences
    .filter(s => (s.article_id || s.video_id) === articleId)
    .sort((a, b) => a.start - b.start);

  document.getElementById('videoTitle').textContent = article ? article.title : articleId;

  const transcriptEl = document.getElementById('transcript');
  const audioEl = document.getElementById('audio');

  // Favorite button
  const favBtn = document.getElementById('favBtn');
  const updateFavBtn = () => {
    const fav = App.isFavoriteArticle(articleId);
    favBtn.textContent = fav ? '★' : '☆';
    favBtn.classList.toggle('active-fav', fav);
    favBtn.title = fav ? '已收藏' : '收藏文章';
  };
  updateFavBtn();
  favBtn.addEventListener('click', () => {
    App.toggleFavoriteArticle(articleId);
    updateFavBtn();
  });

  // Status button (studying / finished)
  const statusBtn = document.getElementById('statusBtn');
  const updateStatusBtn = () => {
    const s = App.getArticleStatus(articleId);
    const done = s === 'finished';
    statusBtn.textContent = done ? '✓' : '○';
    statusBtn.classList.toggle('active-done', done);
    statusBtn.title = done ? '已学完（点击取消）' : '标记学完';
  };
  updateStatusBtn();
  statusBtn.addEventListener('click', () => {
    const next = App.getArticleStatus(articleId) === 'finished' ? 'studying' : 'finished';
    App.setArticleStatus(articleId, next);
    updateStatusBtn();
  });

  // Toggle buttons
  document.getElementById('toggleRom').addEventListener('click', () => {
    document.body.classList.toggle('hide-rom');
  });
  document.getElementById('toggleTrans').addEventListener('click', () => {
    document.body.classList.toggle('hide-trans');
  });

  // Track which vocab IDs have been highlighted (only first occurrence is marked)
  const seenVocab = new Set();

  // Render all sentences
  transcriptEl.innerHTML = sentences.map(s => renderSentence(s)).join('');

  // Click delegation
  transcriptEl.addEventListener('click', (e) => {
    const playBtn = e.target.closest('.play-sm');
    if (playBtn) {
      playSentence(playBtn.dataset.id);
      return;
    }
    const starBtn = e.target.closest('.star-sm');
    if (starBtn) {
      const sid = starBtn.dataset.sentenceId;
      const nowSaved = App.toggleSavedSentence(sid);
      starBtn.classList.toggle('saved', nowSaved);
      starBtn.textContent = nowSaved ? '★' : '☆';
      return;
    }
    const vocabSpan = e.target.closest('.vocab-hit');
    if (vocabSpan) {
      showPopup(vocabSpan);
    }
  });

  // Popup handlers
  const popup = document.getElementById('vocabPopup');
  document.getElementById('popupClose').addEventListener('click', hidePopup);
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && !e.target.closest('.vocab-hit')) {
      hidePopup();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePopup();
  });

  let activeVocabId = null;

  function renderSentence(s) {
    const thaiHtml = highlightVocab(s.text || s.thai, s.annotations || []);
    const isHl = s.is_highlight ? 'is-highlight' : '';
    const saved = App.isSavedSentence(s.id);
    const starClass = saved ? 'star-sm saved' : 'star-sm';
    const starIcon = saved ? '★' : '☆';
    const playBtn = s.audio_url
      ? `<button class="play-sm" data-id="${s.id}">▶</button>`
      : '';
    const noAudioClass = s.audio_url ? '' : 'no-audio';
    return `
      <div class="sentence ${isHl} ${noAudioClass}" id="s-${s.id}" data-id="${s.id}">
        <div class="sentence-row">
          ${playBtn}
          <div class="sentence-body">
            <div class="sentence-thai">${thaiHtml}</div>
            ${s.romanization ? `<div class="sentence-rom">${escapeHtml(s.romanization)}</div>` : ''}
            ${(s.translation || s.english) ? `<div class="sentence-trans">${escapeHtml(s.translation || s.english)}</div>` : ''}
          </div>
          <button class="${starClass}" data-sentence-id="${s.id}" title="加入/移出复习">${starIcon}</button>
        </div>
      </div>
    `;
  }

  function highlightVocab(text, annotations) {
    if (!annotations.length) return escapeHtml(text);
    const sorted = [...annotations].sort((a, b) => a.start - b.start);
    let out = '';
    let cursor = 0;
    for (const a of sorted) {
      if (a.start < cursor) continue; // skip overlaps
      // Skip if this vocab has already been highlighted earlier in the document
      if (seenVocab.has(a.vocab_id)) continue;
      out += escapeHtml(text.slice(cursor, a.start));
      const word = text.slice(a.start, a.end);
      const saved = isCardSaved(a.vocab_id) ? 'saved' : '';
      out += `<span class="vocab-hit ${saved}" data-vocab-id="${a.vocab_id}">${escapeHtml(word)}</span>`;
      seenVocab.add(a.vocab_id);
      cursor = a.end;
    }
    out += escapeHtml(text.slice(cursor));
    return out;
  }

  function isCardSaved(vocabId) {
    const p = App.loadProgress();
    return !!(p.savedVocab && p.savedVocab[vocabId]);
  }

  function showPopup(spanEl) {
    const vocabId = spanEl.dataset.vocabId;
    const vocab = App.data.vocab.find(v => v.id === vocabId);
    if (!vocab) return;

    activeVocabId = vocabId;

    document.getElementById('popupThai').textContent = vocab.text || vocab.thai;
    document.getElementById('popupRom').textContent = vocab.romanization || '';
    document.getElementById('popupTrans').textContent = vocab.translation || vocab.english || '';
    const meta = [vocab.part_of_speech, vocab.frequency ? `本视频出现 ${vocab.frequency} 次` : '']
      .filter(Boolean).join(' · ');
    document.getElementById('popupMeta').textContent = meta;

    // Update button label based on saved status
    const addBtn = document.getElementById('addToReview');
    if (isCardSaved(vocabId)) {
      addBtn.textContent = '✓ 已在复习';
      addBtn.classList.remove('btn-primary');
      addBtn.classList.add('btn');
    } else {
      addBtn.textContent = '★ 加入复习';
      addBtn.classList.add('btn-primary');
      addBtn.classList.remove('btn');
    }

    // Position near the span
    const rect = spanEl.getBoundingClientRect();
    popup.hidden = false;
    const popRect = popup.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;
    if (left + popRect.width > window.innerWidth - 12) {
      left = window.innerWidth - popRect.width - 12;
    }
    if (top + popRect.height > window.innerHeight - 12) {
      top = rect.top - popRect.height - 8;
    }
    popup.style.top = `${Math.max(12, top)}px`;
    popup.style.left = `${Math.max(12, left)}px`;

    // Mark span active
    document.querySelectorAll('.vocab-hit.active').forEach(e => e.classList.remove('active'));
    spanEl.classList.add('active');
  }

  function hidePopup() {
    popup.hidden = true;
    activeVocabId = null;
    document.querySelectorAll('.vocab-hit.active').forEach(e => e.classList.remove('active'));
  }

  document.getElementById('addToReview').addEventListener('click', () => {
    if (!activeVocabId) return;
    toggleSavedVocab(activeVocabId);
    // Refresh UI
    document.querySelectorAll(`.vocab-hit[data-vocab-id="${activeVocabId}"]`).forEach(el => {
      el.classList.toggle('saved', isCardSaved(activeVocabId));
    });
    // Update button
    const addBtn = document.getElementById('addToReview');
    if (isCardSaved(activeVocabId)) {
      addBtn.textContent = '✓ 已在复习';
      addBtn.classList.remove('btn-primary');
      addBtn.classList.add('btn');
    } else {
      addBtn.textContent = '★ 加入复习';
      addBtn.classList.add('btn-primary');
      addBtn.classList.remove('btn');
    }
  });

  function toggleSavedVocab(vocabId) {
    const p = App.loadProgress();
    if (!p.savedVocab) p.savedVocab = {};
    if (p.savedVocab[vocabId]) {
      delete p.savedVocab[vocabId];
    } else {
      p.savedVocab[vocabId] = { addedAt: new Date().toISOString() };
    }
    App.saveProgress();
  }

  // Audio playback
  let currentPlayingId = null;
  function playSentence(sid) {
    const s = sentences.find(x => x.id === sid);
    if (!s || !s.audio_url) return;

    // Toggle if same
    if (currentPlayingId === sid && !audioEl.paused) {
      audioEl.pause();
      setPlayingUI(null);
      return;
    }

    audioEl.src = s.audio_url;
    audioEl.play().catch(err => console.warn('audio error:', err));
    setPlayingUI(sid);
    currentPlayingId = sid;
  }

  audioEl.addEventListener('ended', () => setPlayingUI(null));
  audioEl.addEventListener('pause', () => {
    if (audioEl.currentTime === 0 || audioEl.ended) setPlayingUI(null);
  });

  function setPlayingUI(sid) {
    document.querySelectorAll('.sentence.playing').forEach(e => e.classList.remove('playing'));
    document.querySelectorAll('.play-sm.playing').forEach(e => {
      e.classList.remove('playing');
      e.textContent = '▶';
    });
    if (sid) {
      const s = document.getElementById(`s-${sid}`);
      if (s) s.classList.add('playing');
      const btn = document.querySelector(`.play-sm[data-id="${sid}"]`);
      if (btn) { btn.classList.add('playing'); btn.textContent = '❙❙'; }
    }
  }
})();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
