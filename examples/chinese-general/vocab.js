// Vocab page logic

(async () => {
  await App.loadData();
  App.loadProgress();

  const searchInput = document.getElementById('searchInput');
  const tagFilter = document.getElementById('tagFilter');
  const sortBy = document.getElementById('sortBy');
  const listEl = document.getElementById('vocabList');
  const countEl = document.getElementById('vocabCount');

  // Build tag filter from data
  const tags = new Set();
  App.data.vocab.forEach(v => (v.tags || []).forEach(t => tags.add(t)));
  [...tags].sort().forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    tagFilter.appendChild(opt);
  });

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const tag = tagFilter.value;
    let items = App.data.vocab.slice();

    if (q) {
      items = items.filter(v =>
        (v.text || v.thai || '').toLowerCase().includes(q) ||
        (v.romanization || '').toLowerCase().includes(q) ||
        (v.translation || v.english || '').toLowerCase().includes(q)
      );
    }
    if (tag) items = items.filter(v => (v.tags || []).includes(tag));

    // Sort
    const mode = sortBy.value;
    if (mode === 'freq') {
      items.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
    } else if (mode === 'alpha') {
      items.sort((a, b) => (a.text || a.thai || '').localeCompare(b.text || b.thai || ''));
    } else if (mode === 'recent') {
      items.sort((a, b) => (b.first_seen || '').localeCompare(a.first_seen || ''));
    }

    countEl.textContent = `共 ${items.length} 个词`;

    if (!items.length) {
      listEl.innerHTML = '<p class="muted" style="padding:40px 0;text-align:center">还没有词汇。处理一个视频后会自动生成。</p>';
      return;
    }

    listEl.innerHTML = items.map(v => `
      <div class="vocab-row">
        <div class="thai">${escapeHtml(v.text || v.thai || '')}</div>
        <div class="rom">${escapeHtml(v.romanization || '')}</div>
        <div class="trans">${escapeHtml(v.translation || v.english || '')}</div>
        ${v.frequency ? `<div class="freq">${v.frequency}×</div>` : '<div></div>'}
      </div>
    `).join('');
  }

  searchInput.addEventListener('input', render);
  tagFilter.addEventListener('change', render);
  sortBy.addEventListener('change', render);

  render();
})();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
