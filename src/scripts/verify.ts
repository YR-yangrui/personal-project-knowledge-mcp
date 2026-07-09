import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tempRoot = path.join(os.tmpdir(), `ppkm-verify-${Date.now()}`);
process.env.PPKM_DATA_ROOT = tempRoot;

const { createApp } = await import('../app.js');

const { service, repo, stats, db } = createApp();

repo.writeMemory({
  project: 'global',
  load_level: 'short',
  semantic_type: 'preference',
  title: '默认中文回复',
  content: '可见回复、过程同步、排查说明默认使用中文。',
  priority: 'critical',
  confidence: 'high'
});
repo.writeMemory({
  project: 'ProjectN',
  load_level: 'short',
  semantic_type: 'project_rule',
  title: 'ProjectN 默认路径',
  content: '未指名的需求文档、截图、临时输出默认使用 C:\\RequestFiles。',
  priority: 'high',
  confidence: 'high'
});
const doc = repo.writeDocument({
  project: 'ProjectN',
  path: 'docs/projects/ProjectN/module-notes/order-system.md',
  semantic_type: 'module_doc',
  title: 'ProjectN 订单系统',
  brief: '订单系统占位文档，用于验证 long_index 指向文档正文的流程。',
  tags: ['ProjectN', 'order'],
  content: '# ProjectN 订单系统\n\n这是首版验证文档。AI 需要正文时必须调用 read_doc。\n'
});
repo.createOrUpdateDocIndex(doc.path);

const context = service.buildContext('ProjectN', '订单系统', 4000);
const memoryResults = repo.searchMemory({ project: 'ProjectN', query: '订单系统', limit: 10 });
const docResults = repo.searchDocs({ project: 'ProjectN', query: '订单系统', limit: 10 });
const hyphenDoc = repo.writeDocument({
  project: 'ProjectN',
  path: 'docs/projects/ProjectN/skills/update-doc.md',
  semantic_type: 'module_doc',
  title: 'update-doc skill',
  brief: '用于验证带连字符的 FTS 查询不会被解析为减号语法。',
  tags: ['update-doc', 'verify'],
  content: '# update-doc skill\n\n搜索 update-doc 时不能报 no such column: doc。\n'
});
repo.createOrUpdateDocIndex(hyphenDoc.path);
const overwrittenDoc = repo.writeDocument({
  project: 'ProjectN',
  path: hyphenDoc.path,
  semantic_type: 'module_doc',
  title: 'update-doc skill updated',
  brief: '用于验证 write_doc 覆盖已有路径时更新索引记录而不是触发 UNIQUE 约束。',
  tags: ['update-doc', 'verify', 'overwrite'],
  content: '# update-doc skill updated\n\nwrite_doc 覆盖同一路径应保持数据库和正文一致。\n'
});
const overwrittenDocRead = repo.readDocument(hyphenDoc.path);
const hyphenDocResults = repo.searchDocs({ project: 'ProjectN', query: 'update-doc', limit: 10 });
const hyphenMemoryResults = repo.searchMemory({ project: 'ProjectN', query: 'update-doc', limit: 10 });
const storageInfo = repo.getStorageInfo('ProjectN');
const resolvedBeforeMove = repo.resolveDocumentPath(hyphenDoc.path);
const movedDoc = repo.moveDocument(hyphenDoc.path, 'docs/projects/ProjectN/module-notes/update-doc.md');
const resolvedAfterMove = repo.resolveDocumentPath(movedDoc.new_path);
const externalDir = path.join(tempRoot, 'external-docs');
fs.mkdirSync(externalDir, { recursive: true });
const externalFile = path.join(externalDir, 'legacy-note.md');
fs.writeFileSync(externalFile, '# Legacy Note\n\n迁移单个 Markdown 文件。\n', 'utf8');
const migratedFile = await stats.migrateMarkdownFile({
  sourcePath: externalFile,
  project: 'ProjectN',
  targetPath: 'docs/projects/ProjectN/imports/legacy-note.md',
  mode: 'copy',
  createIndex: true,
  overwrite: true
});
const bugReport = service.recordBugReport({
  project: 'personal-project-knowledge-mcp',
  title: 'FTS 查询带连字符时报错',
  description: 'AI 搜索 update-doc 时 SQLite FTS 把 -doc 当成语法导致 no such column: doc。',
  severity: 'high',
  component: 'search_docs',
  actual: 'no such column: doc',
  expected: '按普通文本搜索 update-doc。',
  tags: ['fts', 'hyphen']
});
const candidates = service.extractMemoryCandidates('以后默认用中文回复。这个项目决定采用 TypeScript 实现 MCP。PowerShell here-string 嵌套引号是坑。', 'ProjectN');
const commitResult = service.commitMemoryCandidates({
  candidates: candidates.filter((candidate) => candidate.semantic_type !== 'decision'),
  mode: 'auto'
});
const artifactResult = service.recordSessionArtifacts('ProjectN', [{
  path: 'docs/projects/ProjectN/archives/verify-session-artifact.md',
  title: '验证会话产物',
  brief: '用于验证 record_session_artifacts 会创建文档和 long_index。',
  content: '# 验证会话产物\n\n这是一份验证文档。\n',
  tags: ['verify']
}]);
const autoDemoted = repo.writeMemory({
  project: 'ProjectN',
  load_level: 'short',
  semantic_type: 'project_rule',
  title: '自动降级验证',
  content: '这是一条用于验证短记忆过长时会自动沉淀为文档并保留 long_index 的内容。'.repeat(40),
  tags: ['verify', 'auto-sizing']
});
const autoDemotedDoc = autoDemoted.related_doc ? repo.resolveDocumentPath(autoDemoted.related_doc) : undefined;
const autoPromoted = repo.writeMemory({
  project: 'ProjectN',
  load_level: 'long_index',
  semantic_type: 'gotcha',
  title: '自动升级短索引验证',
  brief: '足够短的无文档 long_index 应自动转为 short。',
  content: '足够短的无文档 long_index 应自动转为 short。',
  tags: ['verify', 'auto-sizing']
});

const hookStartRaw = execFileSync(process.execPath, [
  '--import',
  'tsx',
  'src/scripts/hook-start.ts',
  '--project=ProjectN',
  '--cwd=C:\\ProjectN',
  '--query=订单系统'
], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PPKM_DATA_ROOT: tempRoot } });
const hookStart = JSON.parse(hookStartRaw) as { session_id: string; context_path: string };
const conversationPath = path.join(tempRoot, 'verify-conversation.txt');
fs.writeFileSync(conversationPath, '以后默认用中文回复。这个项目决定采用 TypeScript 实现 MCP。PowerShell here-string 嵌套引号是坑。', 'utf8');
const hookEndRaw = execFileSync(process.execPath, [
  '--import',
  'tsx',
  'src/scripts/hook-end.ts',
  `--session=${hookStart.session_id}`,
  `--file=${conversationPath}`
], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PPKM_DATA_ROOT: tempRoot } });
const hookEnd = JSON.parse(hookEndRaw) as { candidates: number; confirm_path: string };
const hookCommitRaw = execFileSync(process.execPath, [
  '--import',
  'tsx',
  'src/scripts/hook-commit.ts',
  `--session=${hookStart.session_id}`
], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PPKM_DATA_ROOT: tempRoot } });
const hookCommit = JSON.parse(hookCommitRaw) as { committed: number; skipped: number };

const failures: string[] = [];
if ((context as any).loaded_short_memories.length === 0) failures.push('No short memories loaded.');
if ((context as any).loaded_long_memory_index.length === 0) failures.push('No long memory indexes loaded.');
if (memoryResults.length === 0) failures.push('Memory search returned no results.');
if (docResults.length === 0) failures.push('Doc search returned no results.');
if (hyphenDocResults.length === 0) failures.push('Hyphen doc search returned no results.');
if (hyphenMemoryResults.length === 0) failures.push('Hyphen memory search returned no results.');
if (overwrittenDoc.id !== hyphenDoc.id) failures.push('writeDocument overwrite created a new document id.');
if (!overwrittenDocRead.content.includes('write_doc 覆盖同一路径应保持数据库和正文一致。')) failures.push('writeDocument overwrite did not update Markdown content.');
if (!storageInfo.project_documents_root?.includes('ProjectN')) failures.push('Storage info did not include project document root.');
if (!resolvedBeforeMove.absolute_path.endsWith('update-doc.md')) failures.push('resolveDocumentPath did not return absolute doc path.');
if (!fs.existsSync(resolvedAfterMove.absolute_path)) failures.push('moveDocument did not move the Markdown file.');
if (movedDoc.updated_memory_ids.length === 0) failures.push('moveDocument did not update related long_index memory.');
if (!fs.existsSync(externalFile)) failures.push('migrateMarkdownFile copy mode removed the source file.');
if (!fs.existsSync(migratedFile.absolute_path)) failures.push('migrateMarkdownFile did not create target document.');
if (bugReport.document.semantic_type !== 'bug_report') failures.push('recordBugReport did not create a bug_report document.');
if (candidates.length === 0) failures.push('Candidate extraction returned no candidates.');
if (commitResult.committed.length === 0) failures.push('Candidate commit returned no committed records.');
if (artifactResult.committed.length === 0) failures.push('Session artifact recording returned no committed records.');
if (autoDemoted.load_level !== 'long_index') failures.push('Overlong short memory was not auto-demoted to long_index.');
if (!autoDemoted.related_doc || !autoDemotedDoc?.exists) failures.push('Auto-demoted memory did not create a related document.');
if (autoPromoted.load_level !== 'short') failures.push('Short doc-less long_index was not auto-promoted to short.');
if (!fs.existsSync(hookStart.context_path)) failures.push('hook-start did not write context.md.');
if (hookEnd.candidates === 0) failures.push('hook-end generated no candidates.');
if (hookCommit.committed === 0) failures.push('hook-commit committed no candidates.');

console.log(JSON.stringify({ tempRoot, context, memoryResults, docResults, hyphenDocResults, hyphenMemoryResults, storageInfo, movedDoc, migratedFile, bugReport, candidates, commitResult, artifactResult, hookStart, hookEnd, hookCommit, failures }, null, 2));
db.close();
fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
if (failures.length > 0) process.exit(1);
