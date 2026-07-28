import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tempRoot = path.join(os.tmpdir(), `ppkm-web-verify-${Date.now()}`);
const port = 8899;
const env = { ...process.env, PPKM_DATA_ROOT: tempRoot, PPKM_WEB_PORT: String(port) };
const child = spawn(process.execPath, ['--import', 'tsx', 'src/web.ts'], {
  cwd: process.cwd(),
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(pathname: string, options: RequestInit = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const json = await response.json() as any;
  if (!json.ok) throw new Error(json.error || `HTTP ${response.status}`);
  return json.data;
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 10_000;
  let lastError: unknown;

  // The TypeScript web entrypoint can take longer than a fixed delay to bind,
  // especially on a cold process. Poll health so the verification is not flaky.
  while (Date.now() < deadline) {
    try {
      await request('/api/health');
      return;
    }
    catch (error) {
      lastError = error;
      await wait(100);
    }
  }

  throw new Error(`Web server did not become ready within 10 seconds: ${String(lastError)}`);
}

try {
  await waitForServer();
  await request('/api/storage?project=ProjectN');
  await request('/api/memories', {
    method: 'POST',
    body: JSON.stringify({
      project: 'ProjectN',
      load_level: 'short',
      semantic_type: 'project_rule',
      title: 'Web 验证规则',
      content: 'Web UI 验证短记忆。',
      confidence: 'high'
    })
  });

  const importDir = path.join(tempRoot, 'external-docs');
  fs.mkdirSync(importDir, { recursive: true });
  fs.writeFileSync(path.join(importDir, 'import-test.md'), '# 导入测试\n\n这是 Web API 导入验证文档。\n', 'utf8');

  const imported = await request('/api/import/markdown', {
    method: 'POST',
    body: JSON.stringify({ project: 'ProjectN', sourceDir: importDir, createIndex: true, overwrite: true })
  });
  const migratedSource = path.join(importDir, 'single-migrate.md');
  fs.writeFileSync(migratedSource, '# 单文件迁移\n\n这是 Web API 单文件迁移验证文档。\n', 'utf8');
  const migrated = await request('/api/migrate/markdown-file', {
    method: 'POST',
    body: JSON.stringify({
      project: 'ProjectN',
      sourcePath: migratedSource,
      targetPath: 'docs/projects/ProjectN/imports/single-migrate.md',
      createIndex: true,
      overwrite: true
    })
  });
  const moved = await request('/api/docs/move', {
    method: 'POST',
    body: JSON.stringify({
      oldPath: migrated.path,
      newPath: 'docs/projects/ProjectN/module-notes/single-migrate.md',
      overwrite: true
    })
  });
  const resolved = await request(`/api/docs/resolve?path=${encodeURIComponent(moved.new_path)}`);
  const bugReport = await request('/api/bug-reports', {
    method: 'POST',
    body: JSON.stringify({
      project: 'personal-project-knowledge-mcp',
      title: 'Web API 验证 bug report',
      description: 'AI 使用 MCP 时发现的问题应能记录到 bug_report 文档。',
      component: 'web',
      severity: 'normal'
    })
  });
  const stats = await request('/api/stats/terms?project=ProjectN');
  const candidates = await request('/api/stats/candidates?project=ProjectN');
  const context = await request('/api/context?project=ProjectN&query=导入测试');
  console.log(JSON.stringify({ imported, migrated, moved, resolved, bugReport, statsCount: stats.length, candidatesCount: candidates.length, context }, null, 2));
} finally {
  child.kill();
  await wait(300);
  fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
