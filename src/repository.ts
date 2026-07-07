import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { createId, nowIso } from './ids.js';
import { memoryMarkdownPath, resolveDataPath, toRelativeDataPath } from './paths.js';
import { readMarkdownContent, writeDocumentMarkdown, writeMemoryMarkdown } from './markdown.js';
import type { AppConfig } from './config.js';
import type { DocumentRecord, MemoryRecord, SearchDocsInput, SearchMemoryInput, WriteDocumentInput, WriteMemoryInput } from './types.js';

function json(value: unknown): string {
  return JSON.stringify(value ?? []);
}

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapMemory(row: any): MemoryRecord {
  return {
    id: row.id,
    project: row.project,
    scope: row.scope,
    load_level: row.load_level,
    semantic_type: row.semantic_type,
    title: row.title,
    brief: row.brief,
    content: row.content,
    tags: parseArray(row.tags),
    source: row.source,
    confidence: row.confidence,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    last_accessed_at: row.last_accessed_at,
    last_verified_commit: row.last_verified_commit,
    related_doc: row.related_doc,
    related_files: parseArray(row.related_files),
    supersedes: parseArray(row.supersedes),
    superseded_by: parseArray(row.superseded_by)
  };
}

function mapDocument(row: any): DocumentRecord {
  return {
    id: row.id,
    project: row.project,
    path: row.path,
    semantic_type: row.semantic_type,
    title: row.title,
    brief: row.brief,
    tags: parseArray(row.tags),
    status: row.status,
    checksum: row.checksum,
    last_verified_commit: row.last_verified_commit,
    index_memory_id: row.index_memory_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function checksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export class KnowledgeRepository {
  constructor(private readonly db: Database.Database, private readonly config: AppConfig) {}

  writeMemory(input: WriteMemoryInput): MemoryRecord {
    if (input.load_level === 'short' && (input.content?.length ?? 0) > this.config.maxShortMemoryChars) {
      throw new Error(`Short memory is too long (${input.content?.length} chars). Demote it to a document + long_index.`);
    }
    if (input.load_level === 'long_index' && !input.brief) {
      throw new Error('long_index memory requires brief so AI can see the index without reading the body.');
    }

    const id = createId('mem');
    const now = nowIso();
    const project = input.project ?? 'global';
    const scope = input.scope ?? (project === 'global' ? 'global' : 'project');
    const record: MemoryRecord = {
      id,
      project,
      scope,
      load_level: input.load_level,
      semantic_type: input.semantic_type,
      title: input.title,
      brief: input.brief ?? null,
      content: input.content ?? null,
      tags: input.tags ?? [],
      source: input.source ?? 'manual',
      confidence: input.confidence ?? 'medium',
      status: input.status ?? 'active',
      priority: input.priority ?? 'normal',
      created_at: now,
      updated_at: now,
      expires_at: input.expires_at ?? null,
      last_accessed_at: null,
      last_verified_commit: input.last_verified_commit ?? null,
      related_doc: input.related_doc ?? null,
      related_files: input.related_files ?? [],
      supersedes: [],
      superseded_by: []
    };
    const mdPath = memoryMarkdownPath(this.config.dataRoot, project, record.load_level, id, record.title);
    writeMemoryMarkdown(mdPath, record);
    const relativeMdPath = toRelativeDataPath(this.config.dataRoot, mdPath);

    this.db.prepare(`INSERT INTO memories (
      id, project, scope, load_level, semantic_type, title, brief, content, tags, source,
      confidence, status, priority, created_at, updated_at, expires_at, last_accessed_at,
      last_verified_commit, related_doc, related_files, supersedes, superseded_by, markdown_path
    ) VALUES (@id, @project, @scope, @load_level, @semantic_type, @title, @brief, @content, @tags, @source,
      @confidence, @status, @priority, @created_at, @updated_at, @expires_at, @last_accessed_at,
      @last_verified_commit, @related_doc, @related_files, @supersedes, @superseded_by, @markdown_path)`).run({
      ...record,
      tags: json(record.tags),
      related_files: json(record.related_files),
      supersedes: json(record.supersedes),
      superseded_by: json(record.superseded_by),
      markdown_path: relativeMdPath
    });
    this.upsertMemoryFts(record);
    return record;
  }

  getMemory(id: string): MemoryRecord | undefined {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    if (!row) return undefined;
    this.db.prepare('UPDATE memories SET last_accessed_at = ? WHERE id = ?').run(nowIso(), id);
    return mapMemory(row);
  }

  updateMemory(id: string, patch: Partial<WriteMemoryInput & { status: string; priority: string; superseded_by: string[] }>): MemoryRecord {
    const current = this.getMemory(id);
    if (!current) throw new Error(`Memory not found: ${id}`);
    const updated: MemoryRecord = {
      ...current,
      ...patch,
      tags: patch.tags ?? current.tags,
      related_files: patch.related_files ?? current.related_files,
      updated_at: nowIso()
    } as MemoryRecord;
    if (updated.load_level === 'short' && (updated.content?.length ?? 0) > this.config.maxShortMemoryChars) {
      throw new Error(`Short memory is too long (${updated.content?.length} chars). Demote it to a document + long_index.`);
    }
    this.db.prepare(`UPDATE memories SET
      project=@project, scope=@scope, load_level=@load_level, semantic_type=@semantic_type, title=@title,
      brief=@brief, content=@content, tags=@tags, source=@source, confidence=@confidence, status=@status,
      priority=@priority, updated_at=@updated_at, expires_at=@expires_at, last_verified_commit=@last_verified_commit,
      related_doc=@related_doc, related_files=@related_files, supersedes=@supersedes, superseded_by=@superseded_by
      WHERE id=@id`).run({
        ...updated,
        tags: json(updated.tags),
        related_files: json(updated.related_files),
        supersedes: json(updated.supersedes),
        superseded_by: json(updated.superseded_by)
      });
    this.upsertMemoryFts(updated);
    return updated;
  }

  deprecateMemory(id: string, reason?: string, supersededBy?: string): MemoryRecord {
    const current = this.getMemory(id);
    if (!current) throw new Error(`Memory not found: ${id}`);
    const note = reason ? `\n\nDeprecated reason: ${reason}` : '';
    return this.updateMemory(id, {
      status: 'deprecated',
      content: current.content ? `${current.content}${note}` : note.trim(),
      superseded_by: supersededBy ? [supersededBy] : current.superseded_by
    } as any);
  }

  searchMemory(input: SearchMemoryInput): MemoryRecord[] {
    const limit = Math.min(input.limit ?? 20, 100);
    const filters: string[] = [];
    const params: Record<string, unknown> = { limit };
    if (input.project) { filters.push('m.project = @project'); params.project = input.project; }
    if (input.semantic_type) { filters.push('m.semantic_type = @semantic_type'); params.semantic_type = input.semantic_type; }
    if (input.load_level) { filters.push('m.load_level = @load_level'); params.load_level = input.load_level; }
    if (input.status) { filters.push('m.status = @status'); params.status = input.status; }
    if (input.tags?.length) {
      for (let i = 0; i < input.tags.length; i++) {
        filters.push(`m.tags LIKE @tag${i}`);
        params[`tag${i}`] = `%${input.tags[i]}%`;
      }
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    if (input.query?.trim()) {
      params.query = input.query.trim();
      const sql = `SELECT m.* FROM memories_fts f JOIN memories m ON m.id = f.id ${where ? `${where} AND` : 'WHERE'} memories_fts MATCH @query ORDER BY bm25(memories_fts), m.updated_at DESC LIMIT @limit`;
      return this.db.prepare(sql).all(params).map(mapMemory);
    }
    const sql = `SELECT m.* FROM memories m ${where} ORDER BY m.updated_at DESC LIMIT @limit`;
    return this.db.prepare(sql).all(params).map(mapMemory);
  }

  listLoadedMemory(project?: string): { short: MemoryRecord[]; longIndex: MemoryRecord[] } {
    const now = nowIso();
    const rows = this.db.prepare(`SELECT * FROM memories
      WHERE status = 'active'
        AND (expires_at IS NULL OR expires_at > @now)
        AND (project = 'global' OR project = @project)
      ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        CASE project WHEN 'global' THEN 0 ELSE 1 END,
        updated_at DESC`).all({ project: project ?? '', now }).map(mapMemory);
    return {
      short: rows.filter((r) => r.load_level === 'short'),
      longIndex: rows.filter((r) => r.load_level === 'long_index')
    };
  }

  listProjects(): string[] {
    const mems = this.db.prepare(`SELECT DISTINCT project FROM memories WHERE project != 'global'`).all() as Array<{ project: string }>;
    const docs = this.db.prepare(`SELECT DISTINCT project FROM documents WHERE project != 'global'`).all() as Array<{ project: string }>;
    return Array.from(new Set([...mems.map((r) => r.project), ...docs.map((r) => r.project)])).sort();
  }

  listRecentMemories(limit = 200): MemoryRecord[] {
    return this.db.prepare('SELECT * FROM memories WHERE status = ? ORDER BY updated_at DESC LIMIT ?')
      .all('active', Math.min(limit, 1000))
      .map(mapMemory);
  }

  listRecentDocuments(limit = 200): DocumentRecord[] {
    return this.db.prepare('SELECT * FROM documents WHERE status = ? ORDER BY updated_at DESC LIMIT ?')
      .all('active', Math.min(limit, 1000))
      .map(mapDocument);
  }

  writeDocument(input: WriteDocumentInput): DocumentRecord {
    const id = createId('doc');
    const now = nowIso();
    const relativePath = input.path.replace(/\\/g, '/');
    const absolutePath = resolveDataPath(this.config.dataRoot, relativePath);
    const record: DocumentRecord = {
      id,
      project: input.project ?? 'global',
      path: relativePath,
      semantic_type: input.semantic_type ?? 'reference',
      title: input.title,
      brief: input.brief ?? null,
      tags: input.tags ?? [],
      status: input.status ?? 'active',
      checksum: checksum(input.content),
      last_verified_commit: input.last_verified_commit ?? null,
      index_memory_id: null,
      created_at: now,
      updated_at: now
    };
    writeDocumentMarkdown(absolutePath, record, input.content);
    this.db.prepare(`INSERT INTO documents (
      id, project, path, semantic_type, title, brief, tags, status, checksum,
      last_verified_commit, index_memory_id, created_at, updated_at
    ) VALUES (@id, @project, @path, @semantic_type, @title, @brief, @tags, @status, @checksum,
      @last_verified_commit, @index_memory_id, @created_at, @updated_at)`).run({ ...record, tags: json(record.tags) });
    this.upsertDocumentFts(record, input.content);
    return record;
  }

  upsertDocument(input: WriteDocumentInput): DocumentRecord {
    const normalized = input.path.replace(/\\/g, '/');
    const existing = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    if (!existing) return this.writeDocument(input);

    const current = mapDocument(existing);
    const absolutePath = resolveDataPath(this.config.dataRoot, normalized);
    const updated: DocumentRecord = {
      ...current,
      project: input.project ?? current.project,
      semantic_type: input.semantic_type ?? current.semantic_type,
      title: input.title,
      brief: input.brief ?? current.brief,
      tags: input.tags ?? current.tags,
      status: input.status ?? current.status,
      checksum: checksum(input.content),
      last_verified_commit: input.last_verified_commit ?? current.last_verified_commit,
      updated_at: nowIso()
    };
    writeDocumentMarkdown(absolutePath, updated, input.content);
    this.db.prepare(`UPDATE documents SET
      project=@project, semantic_type=@semantic_type, title=@title, brief=@brief, tags=@tags,
      status=@status, checksum=@checksum, last_verified_commit=@last_verified_commit,
      index_memory_id=@index_memory_id, updated_at=@updated_at
      WHERE id=@id`).run({ ...updated, tags: json(updated.tags) });
    this.upsertDocumentFts(updated, input.content);
    return updated;
  }

  readDocument(docPath: string): { record?: DocumentRecord; content: string; data: Record<string, unknown> } {
    const normalized = docPath.replace(/\\/g, '/');
    const absolutePath = resolveDataPath(this.config.dataRoot, normalized);
    if (!fs.existsSync(absolutePath)) throw new Error(`Document not found: ${docPath}`);
    const parsed = readMarkdownContent(absolutePath);
    const row = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    return { record: row ? mapDocument(row) : undefined, content: parsed.content, data: parsed.data };
  }

  dataRelativePathFromExternalImport(project: string, sourcePath: string, baseDir?: string): string {
    const fileName = path.basename(sourcePath);
    const relative = baseDir ? path.relative(baseDir, sourcePath).replace(/\\/g, '/') : fileName;
    return `docs/projects/${project}/imports/${relative}`;
  }

  patchDocument(docPath: string, oldText: string, newText: string): DocumentRecord {
    const normalized = docPath.replace(/\\/g, '/');
    const absolutePath = resolveDataPath(this.config.dataRoot, normalized);
    const parsed = readMarkdownContent(absolutePath);
    if (!parsed.content.includes(oldText)) throw new Error('old_text not found in document content.');
    const nextContent = parsed.content.replace(oldText, newText);
    const row = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    if (!row) throw new Error(`Document is not indexed: ${docPath}`);
    const record = { ...mapDocument(row), checksum: checksum(nextContent), updated_at: nowIso() };
    writeDocumentMarkdown(absolutePath, record, nextContent);
    this.db.prepare('UPDATE documents SET checksum=@checksum, updated_at=@updated_at WHERE id=@id').run(record);
    this.upsertDocumentFts(record, nextContent);
    return record;
  }

  searchDocs(input: SearchDocsInput): DocumentRecord[] {
    const limit = Math.min(input.limit ?? 20, 100);
    const filters: string[] = [];
    const params: Record<string, unknown> = { limit };
    if (input.project) { filters.push('d.project = @project'); params.project = input.project; }
    if (input.semantic_type) { filters.push('d.semantic_type = @semantic_type'); params.semantic_type = input.semantic_type; }
    if (input.status) { filters.push('d.status = @status'); params.status = input.status; }
    if (input.tags?.length) {
      for (let i = 0; i < input.tags.length; i++) {
        filters.push(`d.tags LIKE @tag${i}`);
        params[`tag${i}`] = `%${input.tags[i]}%`;
      }
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    if (input.query?.trim()) {
      params.query = input.query.trim();
      const sql = `SELECT d.* FROM documents_fts f JOIN documents d ON d.id = f.id ${where ? `${where} AND` : 'WHERE'} documents_fts MATCH @query ORDER BY bm25(documents_fts), d.updated_at DESC LIMIT @limit`;
      return this.db.prepare(sql).all(params).map(mapDocument);
    }
    return this.db.prepare(`SELECT d.* FROM documents d ${where} ORDER BY d.updated_at DESC LIMIT @limit`).all(params).map(mapDocument);
  }

  createOrUpdateDocIndex(docPath: string): MemoryRecord {
    const normalized = docPath.replace(/\\/g, '/');
    const row = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    if (!row) throw new Error(`Document is not indexed: ${docPath}`);
    const doc = mapDocument(row);
    if (doc.index_memory_id) {
      return this.updateMemory(doc.index_memory_id, {
        title: doc.title,
        brief: doc.brief ?? `Document: ${doc.path}`,
        related_doc: doc.path,
        tags: doc.tags
      } as any);
    }
    const memory = this.writeMemory({
      project: doc.project,
      scope: 'project',
      load_level: 'long_index',
      semantic_type: 'doc_index',
      title: doc.title,
      brief: doc.brief ?? `Document: ${doc.path}`,
      related_doc: doc.path,
      tags: doc.tags,
      source: 'doc_index',
      confidence: 'high'
    });
    this.db.prepare('UPDATE documents SET index_memory_id = ? WHERE id = ?').run(memory.id, doc.id);
    return memory;
  }

  demoteMemoryToDoc(memoryId: string): { document: DocumentRecord; memory: MemoryRecord } {
    const memory = this.getMemory(memoryId);
    if (!memory) throw new Error(`Memory not found: ${memoryId}`);
    const docPath = `docs/projects/${memory.project}/archives/${memory.id}.md`;
    const doc = this.writeDocument({
      project: memory.project,
      path: docPath,
      semantic_type: `${memory.semantic_type}_doc`,
      title: memory.title,
      brief: memory.brief ?? memory.title,
      content: memory.content ?? memory.brief ?? '',
      tags: memory.tags,
      last_verified_commit: memory.last_verified_commit ?? undefined
    });
    const updated = this.updateMemory(memoryId, {
      load_level: 'long_index',
      brief: memory.brief ?? memory.title,
      content: null as any,
      related_doc: doc.path
    });
    return { document: doc, memory: updated };
  }

  private upsertMemoryFts(record: MemoryRecord): void {
    this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(record.id);
    this.db.prepare('INSERT INTO memories_fts (id, title, brief, content, tags) VALUES (?, ?, ?, ?, ?)')
      .run(record.id, record.title, record.brief ?? '', record.content ?? '', record.tags.join(' '));
  }

  private upsertDocumentFts(record: DocumentRecord, content: string): void {
    this.db.prepare('DELETE FROM documents_fts WHERE id = ?').run(record.id);
    this.db.prepare('INSERT INTO documents_fts (id, title, brief, content, tags) VALUES (?, ?, ?, ?, ?)')
      .run(record.id, record.title, record.brief ?? '', content, record.tags.join(' '));
  }
}
