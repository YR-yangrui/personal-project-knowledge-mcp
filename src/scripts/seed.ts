import { createApp } from '../app.js';

const { config, repo } = createApp();

const seeds = [
  { project: 'global', load_level: 'short', semantic_type: 'preference', title: '默认中文回复', content: '可见回复、过程同步、排查说明默认使用中文。', priority: 'critical', confidence: 'high' },
  { project: 'global', load_level: 'short', semantic_type: 'preference', title: '输出 Markdown 写入文件', content: '用户要求输出 Markdown/md 时，应写入指定路径；未指定时默认 C:\\RequestFiles。', priority: 'high', confidence: 'high' },
  { project: 'global', load_level: 'short', semantic_type: 'gotcha', title: 'PowerShell 复杂引号坑', content: 'PowerShell here-string、嵌套引号和 Start-Process -ArgumentList 容易出错；复杂脚本优先写临时脚本或拆小验证。', priority: 'normal', confidence: 'high' },
  { project: 'ProjectN', load_level: 'short', semantic_type: 'project_rule', title: 'ProjectN 默认路径', content: '未指名的需求文档、截图、临时输出默认使用 C:\\RequestFiles。', priority: 'high', confidence: 'high' }
] as const;

for (const seed of seeds) {
  const existing = repo.searchMemory({ project: seed.project, query: seed.title, limit: 1 });
  if (existing.length === 0) repo.writeMemory(seed as any);
}

const docs = repo.searchDocs({ project: 'ProjectN', query: '订单系统', limit: 1 });
if (docs.length === 0) {
  const doc = repo.writeDocument({
    project: 'ProjectN',
    path: 'docs/projects/ProjectN/module-notes/order-system.md',
    semantic_type: 'module_doc',
    title: 'ProjectN 订单系统',
    brief: '订单系统占位文档，用于验证 long_index 指向文档正文的流程。',
    tags: ['ProjectN', 'order'],
    content: '# ProjectN 订单系统\n\n最后更新：自动生成\n状态：active\n\n---\n\n这是首版验证文档。长记忆索引只能说明存在这份文档，AI 需要正文时必须调用 read_doc。\n'
  });
  repo.createOrUpdateDocIndex(doc.path);
}

console.log(JSON.stringify({ ok: true, dataRoot: config.dataRoot, projects: repo.listProjects() }, null, 2));
