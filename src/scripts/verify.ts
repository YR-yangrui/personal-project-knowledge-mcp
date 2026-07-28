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
const topicDoc = repo.writeDocument({
  project: 'ProjectN',
  path: 'docs/projects/ProjectN/module-notes/pick-box-system.md',
  semantic_type: 'module_doc',
  title: '自选宝箱系统',
  brief: '订单变化后在点开界面时惰性刷新可选奖励。',
  tags: ['自选宝箱', '订单'],
  content: '# 自选宝箱系统\n\n订单发生变化后，点开界面时刷新候选奖励。\n'
});
repo.createOrUpdateDocIndex(topicDoc.path);
const topicResults = repo.searchDocs({ project: 'ProjectN', query: '自选宝箱 订单 重新抽取 策划案 需求 文档', limit: 10 });
const targetedContext = service.buildContext('ProjectN', '自选宝箱 订单 重新抽取 策划案 需求 文档', 5000);
const broadMatchMemory = repo.writeMemory({
  project: 'ProjectN',
  load_level: 'short',
  semantic_type: 'module_note',
  title: 'Smile 活动说明',
  content: '仅包含 Smile 关键词的记录。'
});
const focusedMatchMemory = repo.writeMemory({
  project: 'ProjectN',
  load_level: 'short',
  semantic_type: 'module_note',
  title: 'ActivityManager PopupRequest ListQuest 生命周期',
  content: '结算期间需要由 ActivityManager 安排 PopupRequest 和 ListQuest。'
});
const substringMatchMemory = repo.writeMemory({
  project: 'ProjectN',
  load_level: 'short',
  semantic_type: 'module_note',
  title: 'PopupRequestRouter 兼容入口',
  content: '用于确认 FTS 未按完整 token 命中时仍可通过字面子串召回。'
});
const multiTermMemoryResults = repo.searchMemory({ project: 'ProjectN', query: 'ActivityManager PopupRequest ListQuest Smile', limit: 10 });
const substringMemoryResults = repo.searchMemory({ project: 'ProjectN', query: 'PopupRequest', limit: 10 });
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
const staleChecksum = overwrittenDoc.checksum ?? '';
fs.appendFileSync(overwrittenDocRead.absolute_path, '\n外部修改：模拟用户在 AI 修改前更新了文档。\n', 'utf8');
let staleChecksumRejected = false;
try {
  repo.patchDocument(hyphenDoc.path, 'write_doc 覆盖同一路径应保持数据库和正文一致。', '这次 patch 不应该成功。', staleChecksum);
} catch (error) {
  staleChecksumRejected = error instanceof Error && error.message.includes('Document changed since last read');
}
const rereadAfterExternalEdit = repo.readDocument(hyphenDoc.path);
const patchedAfterReread = repo.patchDocument(
  hyphenDoc.path,
  '外部修改：模拟用户在 AI 修改前更新了文档。',
  '外部修改：重读后允许 AI 基于最新 checksum 合并修改。',
  rereadAfterExternalEdit.record?.checksum ?? ''
);
const concurrencyDoc = repo.writeDocument({
  project: 'ProjectN',
  path: 'docs/projects/ProjectN/module-notes/concurrency.md',
  semantic_type: 'module_doc',
  title: '文档并发验证',
  brief: '覆盖 write_doc/patch_doc 的 expected_checksum 乐观锁场景。',
  tags: ['verify', 'concurrency'],
  content: '# 文档并发验证\n\n第一版内容。\n'
});
const concurrencyRead1 = repo.readDocument(concurrencyDoc.path);
const patchedWithExpectedChecksum = repo.patchDocument(
  concurrencyDoc.path,
  '第一版内容。',
  '第二版内容，patch_doc 带 expected_checksum 成功。',
  concurrencyRead1.record?.checksum ?? '',
  {
    change_summary: 'patch_doc 带 expected_checksum 更新到第二版',
    change_details: '验证 patch_doc 可在成功修改正文时写入数据库维护记录。'
  }
);
const patchChangeResults = repo.listDocumentChanges({ path: concurrencyDoc.path, change_type: 'patch', limit: 10 });
const concurrencyRead2 = repo.readDocument(concurrencyDoc.path);
let missingOldTextRejected = false;
try {
  repo.patchDocument(concurrencyDoc.path, '不存在的旧文本', '不应该写入。', concurrencyRead2.record?.checksum ?? '');
} catch (error) {
  missingOldTextRejected = error instanceof Error && error.message.includes('old_text not found');
}
const wrongChecksumBefore = repo.readDocument(concurrencyDoc.path);
let wrongChecksumRejected = false;
try {
  repo.patchDocument(concurrencyDoc.path, '第二版内容', '错误 checksum 不应该写入', 'wrong-checksum');
} catch (error) {
  wrongChecksumRejected = error instanceof Error && error.message.includes('Document changed since last read');
}
const wrongChecksumAfter = repo.readDocument(concurrencyDoc.path);
const writeDocExpectedRead = repo.readDocument(concurrencyDoc.path);
const writeDocWithExpectedChecksum = repo.writeDocument({
  project: 'ProjectN',
  path: concurrencyDoc.path,
  semantic_type: 'module_doc',
  title: '文档并发验证 - 安全覆盖',
  brief: 'write_doc 带 expected_checksum 覆盖成功。',
  tags: ['verify', 'concurrency', 'safe-overwrite'],
  content: '# 文档并发验证\n\n第三版内容，write_doc 带 expected_checksum 成功。\n',
  expected_checksum: writeDocExpectedRead.record?.checksum ?? '',
  change_summary: 'write_doc 带 expected_checksum 安全覆盖到第三版',
  change_details: '验证 write_doc 覆盖已有文档时可写入数据库维护记录。'
});
const rewriteChangeResults = repo.listDocumentChanges({ path: concurrencyDoc.path, change_type: 'rewrite', limit: 10 });
const staleWriteRead = repo.readDocument(concurrencyDoc.path);
fs.appendFileSync(staleWriteRead.absolute_path, '\n外部修改：write_doc 覆盖前的并发变更。\n', 'utf8');
let staleWriteRejected = false;
try {
  repo.writeDocument({
    project: 'ProjectN',
    path: concurrencyDoc.path,
    semantic_type: 'module_doc',
    title: '文档并发验证 - 过期覆盖',
    content: '# 文档并发验证\n\n过期 checksum 不应该覆盖。\n',
    expected_checksum: staleWriteRead.record?.checksum ?? ''
  });
} catch (error) {
  staleWriteRejected = error instanceof Error && error.message.includes('Document changed since last read');
}
const afterRejectedWrite = repo.readDocument(concurrencyDoc.path);
const uncheckedWrite = repo.writeDocument({
  project: 'ProjectN',
  path: concurrencyDoc.path,
  semantic_type: 'module_doc',
  title: '文档并发验证 - 兼容覆盖',
  brief: '不传 expected_checksum 时保持旧调用兼容。',
  tags: ['verify', 'concurrency', 'legacy-overwrite'],
  content: '# 文档并发验证\n\n第四版内容，不传 expected_checksum 仍允许覆盖。\n'
});
const uncheckedWriteRead = repo.readDocument(concurrencyDoc.path);
const concurrencySearchResults = repo.searchDocs({ project: 'ProjectN', query: '第四版内容', limit: 10 });
const manualChange = repo.recordDocumentChange({
  project: 'ProjectN',
  path: concurrencyDoc.path,
  change_type: 'note',
  summary: '手动记录维护说明',
  details: '验证独立 record_doc_change 能写入维护记录。',
  source: 'verify'
});
const updatedManualChange = repo.updateDocumentChange(manualChange.id, {
  summary: '手动记录维护说明（已更新）',
  details: '验证 update_doc_change 能更新摘要和详情。'
});
const deprecatedChange = repo.recordDocumentChange({
  project: 'ProjectN',
  path: concurrencyDoc.path,
  change_type: 'cleanup',
  summary: '待废弃维护记录',
  source: 'verify'
});
repo.deprecateDocumentChange(deprecatedChange.id, '验证废弃记录默认不再返回。');
const deletedChange = repo.recordDocumentChange({
  project: 'ProjectN',
  path: concurrencyDoc.path,
  change_type: 'cleanup',
  summary: '待删除维护记录',
  source: 'verify'
});
repo.deleteDocumentChange(deletedChange.id, '验证软删除记录默认不再返回。');
const activeDocChanges = repo.listDocumentChanges({ path: concurrencyDoc.path, limit: 20 });
const deprecatedDocChanges = repo.listDocumentChanges({ path: concurrencyDoc.path, status: 'deprecated', limit: 20 });
const deletedDocChanges = repo.listDocumentChanges({ path: concurrencyDoc.path, status: 'deleted', limit: 20 });
const hyphenDocResults = repo.searchDocs({ project: 'ProjectN', query: 'update-doc', limit: 10 });
const hyphenMemoryResults = repo.searchMemory({ project: 'ProjectN', query: 'update-doc', limit: 10 });
const storageInfo = repo.getStorageInfo('ProjectN');
const resolvedBeforeMove = repo.resolveDocumentPath(hyphenDoc.path);
repo.recordDocumentChange({
  project: 'ProjectN',
  path: hyphenDoc.path,
  change_type: 'note',
  summary: '移动前维护记录',
  source: 'verify'
});
const movedDoc = repo.moveDocument(hyphenDoc.path, 'docs/projects/ProjectN/module-notes/update-doc.md', {
  change_summary: '移动 update-doc 验证文档',
  change_details: '验证 move_doc 会同步旧维护记录 path，并可写入 move 维护记录。'
});
const resolvedAfterMove = repo.resolveDocumentPath(movedDoc.new_path);
const movedOldPathChanges = repo.listDocumentChanges({ path: hyphenDoc.path, limit: 10 });
const movedNewPathChanges = repo.listDocumentChanges({ path: movedDoc.new_path, limit: 10 });
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
if (!topicResults.some((result) => result.id === topicDoc.id)) failures.push('Multi-term doc search did not recall the relevant topic document.');
if (!(targetedContext as any).related_document_index.some((result: any) => result.id === topicDoc.id)) failures.push('Targeted context did not prioritize the relevant document.');
if (multiTermMemoryResults[0]?.id !== focusedMatchMemory.id) failures.push('Multi-term memory search did not prioritize the highest-coverage result.');
if (!substringMemoryResults.some((result) => result.id === substringMatchMemory.id)) failures.push('Memory search did not recall substring-only matches.');
if ((targetedContext as any).semantic_type_catalog.length !== 0) failures.push('Targeted context included the full semantic type catalog.');
if (JSON.stringify(targetedContext).length > 10000) failures.push('Targeted context exceeded the requested token budget estimate.');
if (hyphenDocResults.length === 0) failures.push('Hyphen doc search returned no results.');
if (hyphenMemoryResults.length === 0) failures.push('Hyphen memory search returned no results.');
if (overwrittenDoc.id !== hyphenDoc.id) failures.push('writeDocument overwrite created a new document id.');
if (!overwrittenDocRead.content.includes('write_doc 覆盖同一路径应保持数据库和正文一致。')) failures.push('writeDocument overwrite did not update Markdown content.');
if (!staleChecksumRejected) failures.push('patchDocument did not reject a stale expected_checksum.');
if (patchedAfterReread.id !== hyphenDoc.id) failures.push('patchDocument after reread did not preserve document id.');
if (patchedWithExpectedChecksum.id !== concurrencyDoc.id) failures.push('patchDocument with expected_checksum did not preserve document id.');
if (!missingOldTextRejected) failures.push('patchDocument did not reject missing old_text.');
if (!wrongChecksumRejected) failures.push('patchDocument did not reject a wrong expected_checksum.');
if (wrongChecksumAfter.content !== wrongChecksumBefore.content) failures.push('patchDocument changed content after wrong expected_checksum.');
if (writeDocWithExpectedChecksum.id !== concurrencyDoc.id) failures.push('writeDocument with expected_checksum did not update existing document.');
if (!staleWriteRejected) failures.push('writeDocument did not reject a stale expected_checksum.');
if (!afterRejectedWrite.content.includes('外部修改：write_doc 覆盖前的并发变更。')) failures.push('writeDocument stale rejection lost external edit.');
if (afterRejectedWrite.content.includes('过期 checksum 不应该覆盖')) failures.push('writeDocument stale rejection still overwrote content.');
if (uncheckedWrite.id !== concurrencyDoc.id) failures.push('writeDocument without expected_checksum did not preserve document id.');
if (!uncheckedWriteRead.content.includes('第四版内容，不传 expected_checksum 仍允许覆盖。')) failures.push('writeDocument without expected_checksum did not update content.');
if (concurrencySearchResults.length === 0) failures.push('Document FTS did not reflect unchecked write_doc overwrite.');
if (!patchChangeResults.some((change) => change.summary.includes('第二版'))) failures.push('patchDocument did not record requested document change.');
if (!rewriteChangeResults.some((change) => change.summary.includes('第三版'))) failures.push('writeDocument did not record requested document change.');
if (updatedManualChange.summary !== '手动记录维护说明（已更新）') failures.push('updateDocumentChange did not update summary.');
if (!activeDocChanges.some((change) => change.id === manualChange.id)) failures.push('listDocumentChanges did not return active manual change.');
if (activeDocChanges.some((change) => change.id === deprecatedChange.id || change.id === deletedChange.id)) failures.push('listDocumentChanges returned deprecated/deleted records by default.');
if (!deprecatedDocChanges.some((change) => change.id === deprecatedChange.id)) failures.push('listDocumentChanges did not return deprecated records when requested.');
if (!deletedDocChanges.some((change) => change.id === deletedChange.id)) failures.push('listDocumentChanges did not return deleted records when requested.');
if (!storageInfo.project_documents_root?.includes('ProjectN')) failures.push('Storage info did not include project document root.');
if (!resolvedBeforeMove.absolute_path.endsWith('update-doc.md')) failures.push('resolveDocumentPath did not return absolute doc path.');
if (!fs.existsSync(resolvedAfterMove.absolute_path)) failures.push('moveDocument did not move the Markdown file.');
if (movedDoc.updated_memory_ids.length === 0) failures.push('moveDocument did not update related long_index memory.');
if (movedOldPathChanges.length !== 0) failures.push('moveDocument left document changes on old path.');
if (!movedNewPathChanges.some((change) => change.change_type === 'move')) failures.push('moveDocument did not record requested move document change.');
if (!movedNewPathChanges.some((change) => change.summary === '移动前维护记录')) failures.push('moveDocument did not migrate existing document change path.');
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
