import { createApp } from '../app.js';
import { detectProject } from '../project.js';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : process.env[`npm_config_${name}`];
}

const { service } = createApp();
const cwd = arg('cwd') ?? process.cwd();
const query = arg('query') ?? '';
const project = arg('project') ?? detectProject(cwd);
const format = arg('format') ?? 'markdown';
const context = service.buildContext(project, query, 4000) as any;

if (format === 'json') {
  console.log(JSON.stringify({ project, context }, null, 2));
  process.exit(0);
}

console.log(`# 自动载入记忆：${project}\n`);
console.log('## 短记忆');
for (const memory of context.loaded_short_memories ?? []) {
  console.log(`- [${memory.project}/${memory.semantic_type}] ${memory.title}：${memory.content}`);
}
console.log('\n## 长记忆索引');
for (const memory of context.loaded_long_memory_index ?? []) {
  const doc = memory.related_doc ? `；需要正文时读取 ${memory.related_doc}` : '';
  console.log(`- [${memory.project}/${memory.semantic_type}] ${memory.title}：${memory.brief ?? ''}${doc}`);
}
console.log('\n> 长记忆索引只说明存在相关知识，不代表正文已读取。');
