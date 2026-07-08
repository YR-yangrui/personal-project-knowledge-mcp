#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { backupNow } from './backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const { config, repo, service, stats } = createApp();
const app = express();

app.use(cors({ origin: ['http://127.0.0.1:8787', 'http://localhost:8787'] }));
app.use(express.json({ limit: '5mb' }));
app.use(express.static(publicDir));

function ok(value: unknown) {
  return { ok: true, data: value };
}

function asyncRoute(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/api/health', (_req, res) => {
  res.json(ok({ dataRoot: config.dataRoot, version: '0.1.0' }));
});

app.get('/api/storage', (req, res) => {
  res.json(ok(repo.getStorageInfo(req.query.project ? String(req.query.project) : undefined)));
});

app.get('/api/projects', (_req, res) => {
  res.json(ok({ projects: repo.listProjects() }));
});

app.get('/api/semantic-types', (req, res) => {
  const project = req.query.project ? String(req.query.project) : undefined;
  res.json(ok({ results: service.semanticTypeCatalog(repo.semanticTypeCounts(project)) }));
});

app.get('/api/context', (req, res) => {
  res.json(ok(service.buildContext(String(req.query.project || ''), String(req.query.query || ''), Number(req.query.budget || 4000))));
});

app.get('/api/memories', (req, res) => {
  res.json(ok(repo.searchMemory({
    query: req.query.query ? String(req.query.query) : undefined,
    project: req.query.project ? String(req.query.project) : undefined,
    semantic_type: req.query.semantic_type ? String(req.query.semantic_type) : undefined,
    load_level: req.query.load_level === 'short' || req.query.load_level === 'long_index' ? req.query.load_level : undefined,
    status: req.query.status as any || 'active',
    limit: req.query.limit ? Number(req.query.limit) : 50
  })));
});

app.post('/api/memories', (req, res) => {
  res.json(ok(repo.writeMemory(req.body)));
});

app.patch('/api/memories/:id', (req, res) => {
  res.json(ok(repo.updateMemory(req.params.id, req.body)));
});

app.post('/api/memories/:id/deprecate', (req, res) => {
  res.json(ok(repo.deprecateMemory(req.params.id, req.body?.reason, req.body?.superseded_by)));
});

app.get('/api/docs', (req, res) => {
  res.json(ok(repo.searchDocs({
    query: req.query.query ? String(req.query.query) : undefined,
    project: req.query.project ? String(req.query.project) : undefined,
    semantic_type: req.query.semantic_type ? String(req.query.semantic_type) : undefined,
    status: req.query.status as any || 'active',
    mode: req.query.mode === 'snippet' || req.query.mode === 'full' ? req.query.mode : 'index',
    snippet_radius: req.query.snippet_radius ? Number(req.query.snippet_radius) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : 50
  })));
});

app.get('/api/docs/read', (req, res) => {
  res.json(ok(repo.readDocument(String(req.query.path))));
});

app.get('/api/docs/resolve', (req, res) => {
  res.json(ok(repo.resolveDocumentPath(String(req.query.path))));
});

app.post('/api/docs', (req, res) => {
  res.json(ok(repo.writeDocument(req.body)));
});

app.post('/api/docs/move', (req, res) => {
  res.json(ok(repo.moveDocument(req.body.oldPath, req.body.newPath, { overwrite: req.body.overwrite })));
});

app.post('/api/docs/index', (req, res) => {
  res.json(ok(repo.createOrUpdateDocIndex(req.body.path)));
});

app.get('/api/stats/terms', (req, res) => {
  res.json(ok(stats.termStats(req.query.project ? String(req.query.project) : undefined, req.query.limit ? Number(req.query.limit) : 30)));
});

app.get('/api/stats/candidates', (req, res) => {
  res.json(ok(stats.frequentCandidates(req.query.project ? String(req.query.project) : undefined, req.query.limit ? Number(req.query.limit) : 10)));
});

app.post('/api/import/markdown', asyncRoute(async (req, res) => {
  res.json(ok(await stats.importMarkdownDir({
    sourceDir: req.body.sourceDir,
    project: req.body.project,
    pattern: req.body.pattern,
    createIndex: req.body.createIndex,
    overwrite: req.body.overwrite
  })));
}));

app.post('/api/migrate/markdown-file', asyncRoute(async (req, res) => {
  res.json(ok(await stats.migrateMarkdownFile({
    sourcePath: req.body.sourcePath,
    project: req.body.project,
    targetPath: req.body.targetPath,
    baseDir: req.body.baseDir,
    mode: req.body.mode,
    createIndex: req.body.createIndex,
    overwrite: req.body.overwrite,
    semanticType: req.body.semanticType,
    title: req.body.title,
    brief: req.body.brief,
    tags: req.body.tags
  })));
}));

app.post('/api/bug-reports', (req, res) => {
  res.json(ok(service.recordBugReport(req.body)));
});

app.post('/api/candidates/extract', (req, res) => {
  res.json(ok({ candidates: service.extractMemoryCandidates(req.body.conversation ?? '', req.body.project) }));
});

app.post('/api/candidates/commit', (req, res) => {
  res.json(ok(service.commitMemoryCandidates(req.body)));
});

app.post('/api/backup', (_req, res) => {
  res.json(ok(backupNow(config.dataRoot)));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ ok: false, error: message });
});

const port = Number(process.env.PPKM_WEB_PORT || 8787);
app.listen(port, '127.0.0.1', () => {
  console.log(`personal-project-knowledge-mcp web ui: http://127.0.0.1:${port}`);
  console.log(`dataRoot=${config.dataRoot}`);
});
