// Review page logic — reviews user-saved vocab as SRS flashcards

(async () => {
  await App.loadData();
  App.loadProgress();

  const showAll = new URLSearchParams(location.search).get('all') === '1';
  const queue = showAll ? App.getAllCards() : App.getReviewQueue(50);
  const total = queue.length;
  let idx = 0;
  let correct = 0, again = 0;

  const cardArea = document.getElementById('cardArea');
  const doneArea = document.getElementById('doneArea');
  const emptyArea = document.getElementById('emptyArea');
  const frontEl = document.getElementById('cardFront');
  const backEl = document.getElementById('cardBack');
  const audioEl = document.getElementById('audio');
  const playBtn = document.getElementById('playBtn');
  const playBtn2 = document.getElementById('playBtn2');
  const showBtn = document.getElementById('showAnswer');
  const progressTxt = document.getElementById('progressText');
  const thaiEl = document.getElementById('thaiText');
  const romEl = document.getElementById('romanText');
  const transEl = document.getElementById('transText');
  const vocabBlock = document.getElementById('vocabBlock');
  const frontHint = document.getElementById('frontHint');
  const modeLabel = document.getElementById('modeLabel');
  const audioBigEl = document.getElementById('audioBig');

  if (showAll) {
    document.getElementById('modeLabel').textContent = '全部卡片';
  }

  if (!total) {
    cardArea.hidden = true;
    emptyArea.hidden = false;
    const emptyHeading = emptyArea.querySelector('h2');
    const emptyText = emptyArea.querySelector('p');
    if (emptyHeading) emptyHeading.textContent = showAll ? '还没有保存任何卡片' : '没有待复习的内容';
    if (emptyText) emptyText.innerHTML = '去 <a href="index.html" style="color:var(--accent)">阅读器</a> 里点击单词或句子旁的 ☆，下次它们就会出现在这里。';
    return;
  }

  let mode = App.getMode();
  updateModeUI();

  document.getElementById('modeToggle').addEventListener('click', () => {
    mode = mode === 'listening' ? 'speaking' : 'listening';
    App.setMode(mode);
    updateModeUI();
    renderFront();
  });

  function updateModeUI() {
    modeLabel.textContent = mode === 'listening' ? '听力优先' : '口语优先';
  }

  function renderFront() {
    const card = queue[idx];
    backEl.hidden = true;
    frontEl.hidden = false;
    progressTxt.textContent = `${idx + 1} / ${total}`;

    if (card.audio_url) {
      audioEl.src = card.audio_url;
      audioEl.load();
    } else {
      audioEl.removeAttribute('src');
    }

    const isSentence = card.type === 'sentence';
    if (mode === 'speaking') {
      audioBigEl.style.display = 'none';
      frontHint.innerHTML = `
        <div style="color:var(--text);font-size:${isSentence ? 16 : 22}px;${isSentence ? '' : 'font-weight:600;'}margin-bottom:8px;line-height:1.6">
          ${escapeHtml(card.translation || card.english || '')}
        </div>
        <div style="color:var(--text-dim);font-size:14px">${isSentence ? '尝试用中文说出这段话' : '尝试用中文说出这个词'}</div>
      `;
    } else {
      if (!card.audio_url) {
        audioBigEl.style.display = 'none';
        frontHint.innerHTML = `
          <div style="color:var(--text);font-size:${isSentence ? 16 : 22}px;${isSentence ? '' : 'font-weight:600;'}margin-bottom:8px;line-height:1.6">
            ${escapeHtml(card.thai || '')}
          </div>
          <div style="color:var(--text-dim);font-size:13px">（此卡片没有音频）</div>
        `;
      } else {
        audioBigEl.style.display = '';
        if (isSentence) {
          frontHint.textContent = '听音频，理解整段话';
        } else {
          frontHint.textContent = '听音频里的例句，猜这个词的意思';
        }
      }
    }
  }

  function renderBack() {
    const card = queue[idx];
    frontEl.hidden = true;
    backEl.hidden = false;

    const isSentence = card.type === 'sentence';
    thaiEl.textContent = card.thai || '';
    thaiEl.style.fontSize = isSentence ? '18px' : '26px';
    thaiEl.style.textAlign = isSentence ? 'left' : 'center';
    romEl.textContent = card.romanization || '';
    transEl.textContent = card.translation || card.english || '';

    if (card.example_thai) {
      const highlighted = highlightWord(card.example_thai, card.thai);
      vocabBlock.innerHTML = `
        <div style="margin-top:8px;padding:10px 12px;background:var(--bg-3);border-radius:var(--radius-sm)">
          <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px">例句：</div>
          <div style="font-family:var(--thai-font);font-size:16px;line-height:1.6">${highlighted}</div>
          ${card.example_trans ? `<div style="font-size:13px;color:var(--text-dim);margin-top:6px">${escapeHtml(card.example_trans)}</div>` : ''}
        </div>
      `;
    } else {
      vocabBlock.innerHTML = '';
    }

    const prev = App.previewIntervals(card.id);
    document.getElementById('intAgain').textContent = prev.again;
    document.getElementById('intHard').textContent = prev.hard;
    document.getElementById('intGood').textContent = prev.good;
    document.getElementById('intEasy').textContent = prev.easy;
  }

  function highlightWord(text, word) {
    if (!word) return escapeHtml(text);
    const idx = text.indexOf(word);
    if (idx < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, idx))
      + `<span style="background:rgba(255,182,39,0.25);border-bottom:2px solid var(--accent);padding:0 2px;border-radius:3px">${escapeHtml(word)}</span>`
      + escapeHtml(text.slice(idx + word.length));
  }

  function next() {
    idx += 1;
    if (idx >= queue.length) {
      cardArea.hidden = true;
      doneArea.hidden = false;
      document.getElementById('doneStats').textContent =
        `复习了 ${total} 个词 · ${correct} 会 · ${again} 重来`;
      return;
    }
    renderFront();
    if (mode === 'listening') {
      setTimeout(() => tryPlay(), 150);
    }
  }

  function tryPlay() {
    if (audioEl.src) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
    }
  }

  playBtn.addEventListener('click', tryPlay);
  playBtn2.addEventListener('click', tryPlay);
  showBtn.addEventListener('click', renderBack);

  document.querySelectorAll('.rate').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = parseInt(btn.dataset.q, 10);
      const card = queue[idx];
      App.rateCard(card.id, q);
      if (q < 3) again++; else correct++;
      next();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (!frontEl.hidden) showBtn.click();
      else tryPlay();
    } else if (e.key === 'r' || e.key === 'R') {
      tryPlay();
    } else if (!backEl.hidden) {
      if (e.key === '1') document.querySelector('.rate-again').click();
      else if (e.key === '2') document.querySelector('.rate-hard').click();
      else if (e.key === '3') document.querySelector('.rate-good').click();
      else if (e.key === '4') document.querySelector('.rate-easy').click();
    }
  });

  renderFront();
})();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
