// Home page logic

(async () => {
  await App.loadData();
  App.loadProgress();
  const counts = App.getCounts();
  document.getElementById('dueCount').textContent = counts.due;
  document.getElementById('newCount').textContent = counts.new;
  document.getElementById('totalCount').textContent = counts.total;
  document.getElementById('streak').textContent = counts.streak;

  const articles = App.data.articles || [];
  const p = App.loadProgress();
  const favoriteIds = new Set(Object.keys(p.favoriteArticles || {}));

  const favorites = articles.filter(a => favoriteIds.has(a.id));
  const studying = articles.filter(a => a.status !== 'finished' && !favoriteIds.has(a.id));
  const finished = articles.filter(a => a.status === 'finished' && !favoriteIds.has(a.id));

  if (favorites.length) {
    document.getElementById('favoritesSection').hidden = false;
    document.getElementById('favoritesList').innerHTML = favorites.map(renderArticleCard).join('');
  }

  const studyingEl = document.getElementById('studyingList');
  studyingEl.innerHTML = studying.length
    ? studying.map(renderArticleCard).join('')
    : '<p class="muted">还没有文章。发给 Claude 添加第一篇。</p>';

  if (finished.length) {
    document.getElementById('finishedSection').hidden = false;
    document.getElementById('finishedList').innerHTML = finished.map(renderArticleCard).join('');
  }

  function renderArticleCard(a) {
    const sents = App.data.sentences.filter(s => (s.article_id || s.video_id) === a.id).length;
    const highlights = App.data.sentences.filter(s => (s.article_id || s.video_id) === a.id && s.is_highlight).length;
    const typeIcon = { youtube: '▶', audio: '🎵', text: '📄' }[a.type] || '📖';
    const statusBadge = a.status === 'finished' ? '<span class="badge-finished">已学完</span>' : '';
    return `
      <a class="video-card video-card-link" href="reader.html?a=${encodeURIComponent(a.id)}">
        <div>
          <div class="title">${typeIcon} ${escapeHtml(a.title || a.id)} ${statusBadge}</div>
          <div class="meta">${sents} 句 · ${highlights} 重点 · ${a.duration_str || ''}</div>
        </div>
        <div class="video-card-arrow">→</div>
      </a>
    `;
  }

  // Data buttons
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([App.exportProgress()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learn-thai-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    try {
      App.importProgress(text);
      location.reload();
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('确定清除所有复习进度？（文章和词汇不会删除）')) {
      App.resetProgress();
      location.reload();
    }
  });
})();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
