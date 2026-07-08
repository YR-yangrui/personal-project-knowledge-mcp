const $ = (id) => document.getElementById(id);
let semanticTypes = [];
let selectedCategory = '';

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

function loadPolicy(item) {
  return item.show_in_context && item.auto_load_index ? '默认加载' : '仅搜索';
}

function renderList(target, items, actions = () => '') {
  if (!items.length) {
    target.innerHTML = '<article class="card empty">暂无结果</article>';
    return;
  }
  target.innerHTML = items.map((item) => `
    <article class="card">
      <b>${escapeHtml(item.title || item.term || item.id)}</b>
      <div class="meta">${escapeHtml([item.project, item.semantic_type, item.load_level, item.path].filter(Boolean).join(' / '))}</div>
      <div class="content">${escapeHtml(item.snippet || item.brief || item.content || `count: ${item.count ?? ''}`)}</div>
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

$('storageBtn').onclick = async () => {
  const data = await api(`/api/storage?project=${encodeURIComponent(project())}`);
  $('storageOut').textContent = JSON.stringify(data, null, 2);
};

$('loadContextBtn').onclick = async () => {
  const data = await api(`/api/context?project=${encodeURIComponent(project())}&query=${encodeURIComponent($('queryInput').value)}`);
  $('contextOut').textContent = JSON.stringify(data, null, 2);
};

async function refreshCategories() {
  const data = await api(`/api/semantic-types?project=${encodeURIComponent(project())}`);
  semanticTypes = data.results.filter((item) => item.show_in_webui !== false);
  const options = semanticTypes.map((item) => `<option value="${escapeHtml(item.semantic_type)}">${escapeHtml(item.semantic_type)}</option>`).join('');
  $('memType').innerHTML = options;
  $('docType').innerHTML = options;
  renderCategories();
  await loadCategory(selectedCategory);
}

function renderCategories() {
  if (!semanticTypes.length) {
    $('categoryList').innerHTML = '<article class="card empty">暂无分类</article>';
    return;
  }
  $('categoryList').innerHTML = semanticTypes.map((item) => {
    const active = item.semantic_type === selectedCategory ? ' active' : '';
    const policy = loadPolicy(item);
    const total = (item.memories ?? 0) + (item.documents ?? 0);
    return `
      <button class="category-item${active}" onclick="selectCategory('${escapeHtml(item.semantic_type)}')">
        <span>${escapeHtml(item.semantic_type)}</span>
        <small>${escapeHtml(policy)} · 记忆${item.memories ?? 0} / 文档${item.documents ?? 0}</small>
      </button>
    `;
  }).join('');
}

window.selectCategory = async (semanticType) => {
  selectedCategory = semanticType;
  renderCategories();
  await loadCategory(semanticType);
};

async function loadCategory(semanticType = '') {
  const category = semanticTypes.find((item) => item.semantic_type === semanticType);
  $('categoryHeader').innerHTML = category ? `
    <b>${escapeHtml(category.semantic_type)}</b>
    <span class="chip">${escapeHtml(loadPolicy(category))}</span>
    <span class="chip">${escapeHtml(category.default_load_level)} / ${escapeHtml(category.default_scope)}</span>
    <span class="chip">记忆 ${category.memories ?? 0}</span>
    <span class="chip">文档 ${category.documents ?? 0}</span>
    <p>${escapeHtml(category.description || '无说明')}</p>
    <p class="meta">searchable=${category.searchable} · auto_load_index=${category.auto_load_index} · show_in_context=${category.show_in_context}</p>
  ` : `
    <b>全部分类</b>
    <span class="chip">全局搜索</span>
    <p class="meta">不限定 semantic_type，返回当前项目可搜索的记忆和文档。</p>
  `;
  await searchCategory();
}

async function searchCategory() {
  const params = new URLSearchParams({
    project: project(),
    query: $('categoryQuery').value,
    limit: '50'
  });
  if (selectedCategory) params.set('semantic_type', selectedCategory);
  const memories = await api(`/api/memories?${params.toString()}`);
  const docParams = new URLSearchParams(params);
  docParams.set('mode', $('categoryMode').value);
  const docs = await api(`/api/docs?${docParams.toString()}`);
  renderList($('categoryMemoryList'), memories, (item) => item.related_doc ? `<button onclick="readDoc('${item.related_doc}')">读正文</button>` : '');
  renderList($('categoryDocList'), docs, (item) => `<button onclick="readDoc('${item.path}')">读取</button> <button onclick="indexDoc('${item.path}')">建索引</button>`);
}

$('refreshCategoriesBtn').onclick = refreshCategories;
$('allCategoryBtn').onclick = async () => {
  selectedCategory = '';
  renderCategories();
  await loadCategory('');
};
$('categorySearchBtn').onclick = searchCategory;

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
      semantic_type: $('docType').value || 'module_doc',
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

$('migrateBtn').onclick = async () => {
  const data = await api('/api/migrate/markdown-file', {
    method: 'POST',
    body: {
      project: project(),
      sourcePath: $('migrateSource').value,
      targetPath: $('migrateTarget').value || undefined,
      mode: $('migrateMode').value,
      overwrite: $('migrateOverwrite').checked,
      createIndex: true
    }
  });
  $('migrateOut').textContent = JSON.stringify(data, null, 2);
  $('searchDocsBtn').click();
};

$('moveDocBtn').onclick = async () => {
  const data = await api('/api/docs/move', {
    method: 'POST',
    body: {
      oldPath: $('moveOldPath').value,
      newPath: $('moveNewPath').value,
      overwrite: $('moveOverwrite').checked
    }
  });
  $('moveOut').textContent = JSON.stringify(data, null, 2);
  $('searchDocsBtn').click();
};

$('bugReportBtn').onclick = async () => {
  const data = await api('/api/bug-reports', {
    method: 'POST',
    body: {
      project: 'personal-project-knowledge-mcp',
      title: $('bugTitle').value,
      component: $('bugComponent').value || undefined,
      description: $('bugDescription').value,
      severity: 'normal',
      source: 'web-ui'
    }
  });
  $('bugOut').textContent = JSON.stringify(data, null, 2);
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
  $('storageBtn').click();
  refreshCategories();
  $('loadContextBtn').click();
  $('searchMemoryBtn').click();
  $('searchDocsBtn').click();
  $('statsBtn').click();
}).catch((error) => {
  $('health').textContent = error.message;
});
