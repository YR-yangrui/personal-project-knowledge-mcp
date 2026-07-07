import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tempRoot = path.join(os.tmpdir(), `ppkm-verify-${Date.now()}`);
process.env.PPKM_DATA_ROOT = tempRoot;

const { createApp } = await import('../app.js');

const { service, repo, db } = createApp();

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
if (candidates.length === 0) failures.push('Candidate extraction returned no candidates.');
if (commitResult.committed.length === 0) failures.push('Candidate commit returned no committed records.');
if (artifactResult.committed.length === 0) failures.push('Session artifact recording returned no committed records.');
if (!fs.existsSync(hookStart.context_path)) failures.push('hook-start did not write context.md.');
if (hookEnd.candidates === 0) failures.push('hook-end generated no candidates.');
if (hookCommit.committed === 0) failures.push('hook-commit committed no candidates.');

console.log(JSON.stringify({ tempRoot, context, memoryResults, docResults, candidates, commitResult, artifactResult, hookStart, hookEnd, hookCommit, failures }, null, 2));
db.close();
fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
if (failures.length > 0) process.exit(1);
