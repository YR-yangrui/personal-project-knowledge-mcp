const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || 'request failed');
  return json.data;
}

function project() {
  return $('projectInput').value.trim() || 'ProjectN';
}

function renderList(target, items, actions = () => '') {
  target.innerHTML = items.map((item) => `
    <article class="card">
      <b>${escapeHtml(item.title || item.term || item.id)}</b>
      <div class="meta">${escapeHtml([item.project, item.semantic_type, item.load_level, item.path].filter(Boolean).join(' / '))}</div>
      <div class="content">${escapeHtml(item.brief || item.content || `count: ${item.count ?? ''}`)}</div>
      ${actions(item)}
    </article>
  `).join('');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function refreshHealth() {
  const health = await api('/api/health');
  $('health').textContent = `dataRoot: ${health.dataRoot}`;
}

$('loadContextBtn').onclick = async () => {
  const data = await api(`/api/context?project=${encodeURIComponent(project())}&query=${encodeURIComponent($('queryInput').value)}`);
  $('contextOut').textContent = JSON.stringify(data, null, 2);
};

$('searchMemoryBtn').onclick = async () => {
  const data = await api(`/api/memories?project=${encodeURIComponent(project())}&query=${encodeURIComponent($('memoryQuery').value)}&limit=50`);
  renderList($('memoryList'), data, (item) => `<button onclick="deprecateMemory('${item.id}')">废弃</button>`);
};

window.deprecateMemory = async (id) => {
  await api(`/api/memories/${id}/deprecate`, { method: 'POST', body: { reason: 'web ui deprecated' } });
  $('searchMemoryBtn').click();
};

$('writeMemoryBtn').onclick = async () => {
  const load = $('memLoad').value;
  const body = {
    project: project(),
    load_level: load,
    semantic_type: $('memType').value,
    title: $('memTitle').value,
    content: load === 'short' ? $('memContent').value : undefined,
    brief: load === 'long_index' ? $('memContent').value : undefined,
    confidence: 'medium',
    priority: 'normal'
  };
  await api('/api/memories', { method: 'POST', body });
  $('memTitle').value = '';
  $('memContent').value = '';
  $('searchMemoryBtn').click();
};

$('searchDocsBtn').onclick = async () => {
  const data = await api(`/api/docs?project=${encodeURIComponent(project())}&query=${encodeURIComponent($('docQuery').value)}&limit=50`);
  renderList($('docList'), data, (item) => `<button onclick="readDoc('${item.path}')">读取</button> <button onclick="indexDoc('${item.path}')">建索引</button>`);
};

window.readDoc = async (path) => {
  const data = await api(`/api/docs/read?path=${encodeURIComponent(path)}`);
  $('contextOut').textContent = data.content;
};

window.indexDoc = async (path) => {
  await api('/api/docs/index', { method: 'POST', body: { path } });
  $('searchDocsBtn').click();
};

$('writeDocBtn').onclick = async () => {
  const doc = await api('/api/docs', {
    method: 'POST',
    body: {
      project: project(),
      path: $('docPath').value,
      title: $('docTitle').value,
      brief: $('docContent').value.slice(0, 120),
      content: $('docContent').value,
      semantic_type: 'module_doc',
      tags: ['web']
    }
  });
  await api('/api/docs/index', { method: 'POST', body: { path: doc.path } });
  $('searchDocsBtn').click();
};

$('statsBtn').onclick = async () => {
  const terms = await api(`/api/stats/terms?project=${encodeURIComponent(project())}`);
  $('statsList').innerHTML = terms.map((item) => `<span class="chip">${escapeHtml(item.term)} · ${item.count}</span>`).join('');
  const candidates = await api(`/api/stats/candidates?project=${encodeURIComponent(project())}`);
  renderList($('freqCandidates'), candidates);
};

$('importBtn').onclick = async () => {
  const data = await api('/api/import/markdown', {
    method: 'POST',
    body: {
      project: project(),
      sourceDir: $('importDir').value,
      pattern: $('importPattern').value || '**/*.md',
      overwrite: $('importOverwrite').checked,
      createIndex: $('importIndex').checked
    }
  });
  $('importOut').textContent = JSON.stringify(data, null, 2);
};

$('extractBtn').onclick = async () => {
  const data = await api('/api/candidates/extract', {
    method: 'POST',
    body: { project: project(), conversation: $('conversationText').value }
  });
  renderList($('candidateList'), data.candidates, (item) => item.requires_confirmation ? '<span class="meta">需要确认</span>' : '<span class="meta">可自动提交</span>');
};

$('backupBtn').onclick = async () => {
  const data = await api('/api/backup', { method: 'POST' });
  alert(`备份完成：${data.backupDir}`);
};

refreshHealth().then(() => {
  $('loadContextBtn').click();
  $('searchMemoryBtn').click();
  $('searchDocsBtn').click();
  $('statsBtn').click();
}).catch((error) => {
  $('health').textContent = error.message;
});
