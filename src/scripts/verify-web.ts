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

try {
  await wait(1200);
  await request('/api/health');
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
  const stats = await request('/api/stats/terms?project=ProjectN');
  const candidates = await request('/api/stats/candidates?project=ProjectN');
  const context = await request('/api/context?project=ProjectN&query=导入测试');
  console.log(JSON.stringify({ imported, statsCount: stats.length, candidatesCount: candidates.length, context }, null, 2));
} finally {
  child.kill();
  await wait(300);
  fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
