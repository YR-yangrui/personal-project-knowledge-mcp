import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { createId, nowIso } from './ids.js';
import { ensureDir, memoryMarkdownPath, resolveDataPath, safeSegment, toRelativeDataPath } from './paths.js';
import { readMarkdownContent, writeDocumentMarkdown, writeMemoryMarkdown } from './markdown.js';
import type { AppConfig } from './config.js';
import type { DocumentLocation, DocumentRecord, MemoryRecord, SearchDocResult, SearchDocsInput, SearchMemoryInput, SemanticTypeCount, StorageInfo, WriteDocumentInput, WriteMemoryInput } from './types.js';

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

function ftsMatchQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"`)
    .join(' ');
}

export class KnowledgeRepository {
  constructor(private readonly db: Database.Database, private readonly config: AppConfig) {}

  getStorageInfo(project?: string): StorageInfo {
    const projectSegment = project ? path.join('docs', 'projects', project) : undefined;
    return {
      data_root: path.resolve(this.config.dataRoot),
      documents_root: resolveDataPath(this.config.dataRoot, 'docs'),
      memories_root: resolveDataPath(this.config.dataRoot, 'memories'),
      database_path: resolveDataPath(this.config.dataRoot, 'memory.sqlite'),
      config_path: resolveDataPath(this.config.dataRoot, 'config.yaml'),
      backups_root: resolveDataPath(this.config.dataRoot, 'backups'),
      default_imports_root: project
        ? resolveDataPath(this.config.dataRoot, path.join('docs', 'projects', project, 'imports'))
        : resolveDataPath(this.config.dataRoot, path.join('docs', 'projects', '_project_', 'imports')),
      project_documents_root: projectSegment ? resolveDataPath(this.config.dataRoot, projectSegment) : undefined,
      path_rules: [
        'Tool inputs for document paths are data-root-relative paths, for example docs/projects/ProjectN/notes/example.md.',
        'Absolute paths are exposed for manual inspection only; write_doc, patch_doc, read_doc and move_doc keep writes inside data_root.',
        'Use migrate_markdown_file or import_markdown_dir to bring external Markdown files into data_root.'
      ]
    };
  }

  resolveDocumentPath(docPath: string): DocumentLocation {
    const normalized = this.normalizeDataPath(docPath);
    const absolutePath = resolveDataPath(this.config.dataRoot, normalized);
    const row = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    return {
      relative_path: normalized,
      absolute_path: absolutePath,
      exists: fs.existsSync(absolutePath),
      indexed: Boolean(row),
      record: row ? mapDocument(row) : undefined
    };
  }

  writeMemory(input: WriteMemoryInput): MemoryRecord {
    const id = createId('mem');
    const now = nowIso();
    const project = input.project ?? 'global';
    const scope = input.scope ?? (project === 'global' ? 'global' : 'project');
    const record = this.normalizeMemorySizing({
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
    });
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
    const currentRow = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    if (!currentRow) throw new Error(`Memory not found: ${id}`);
    const current = mapMemory(currentRow);
    const updated: MemoryRecord = {
      ...current,
      ...patch,
      tags: patch.tags ?? current.tags,
      related_files: patch.related_files ?? current.related_files,
      updated_at: nowIso()
    } as MemoryRecord;
    const normalized = this.normalizeMemorySizing(updated);
    const storedMarkdownPath = this.nextMemoryMarkdownPath(currentRow, current, normalized);
    const relativeMarkdownPath = toRelativeDataPath(this.config.dataRoot, storedMarkdownPath);
    this.db.prepare(`UPDATE memories SET
      project=@project, scope=@scope, load_level=@load_level, semantic_type=@semantic_type, title=@title,
      brief=@brief, content=@content, tags=@tags, source=@source, confidence=@confidence, status=@status,
      priority=@priority, updated_at=@updated_at, expires_at=@expires_at, last_verified_commit=@last_verified_commit,
      related_doc=@related_doc, related_files=@related_files, supersedes=@supersedes, superseded_by=@superseded_by,
      markdown_path=@markdown_path
      WHERE id=@id`).run({
        ...normalized,
        tags: json(normalized.tags),
        related_files: json(normalized.related_files),
        supersedes: json(normalized.supersedes),
        superseded_by: json(normalized.superseded_by),
        markdown_path: relativeMarkdownPath
      });
    this.upsertMemoryFts(normalized);
    writeMemoryMarkdown(storedMarkdownPath, normalized);
    return normalized;
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
      params.query = ftsMatchQuery(input.query);
      const sql = `SELECT m.* FROM memories_fts f JOIN memories m ON m.id = f.id ${where ? `${where} AND` : 'WHERE'} memories_fts MATCH @query ORDER BY bm25(memories_fts), m.updated_at DESC LIMIT @limit`;
      const results = this.db.prepare(sql).all(params).map(mapMemory);
      if (results.length > 0) return results;
      params.like = `%${input.query.trim()}%`;
      const likeSql = `SELECT m.* FROM memories m ${where ? `${where} AND` : 'WHERE'} (m.title LIKE @like OR m.brief LIKE @like OR m.content LIKE @like OR m.tags LIKE @like) ORDER BY m.updated_at DESC LIMIT @limit`;
      return this.db.prepare(likeSql).all(params).map(mapMemory);
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
      longIndex: rows.filter((r) => r.load_level === 'long_index' && this.shouldLoadIndexInContext(r))
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

  semanticTypeCounts(project?: string): SemanticTypeCount[] {
    const params: Record<string, unknown> = {};
    const memoryWhere = project ? "WHERE status = 'active' AND (project = 'global' OR project = @project)" : "WHERE status = 'active'";
    const documentWhere = project ? "WHERE status = 'active' AND project = @project" : "WHERE status = 'active'";
    if (project) params.project = project;
    const memoryRows = this.db.prepare(`SELECT semantic_type, COUNT(*) AS count FROM memories ${memoryWhere} GROUP BY semantic_type`).all(params) as Array<{ semantic_type: string; count: number }>;
    const documentRows = this.db.prepare(`SELECT semantic_type, COUNT(*) AS count FROM documents ${documentWhere} GROUP BY semantic_type`).all(params) as Array<{ semantic_type: string; count: number }>;
    const map = new Map<string, SemanticTypeCount>();
    for (const row of memoryRows) {
      map.set(row.semantic_type, { semantic_type: row.semantic_type, memories: row.count, documents: 0 });
    }
    for (const row of documentRows) {
      const current = map.get(row.semantic_type) ?? { semantic_type: row.semantic_type, memories: 0, documents: 0 };
      current.documents = row.count;
      map.set(row.semantic_type, current);
    }
    return Array.from(map.values()).sort((a, b) => a.semantic_type.localeCompare(b.semantic_type));
  }

  writeDocument(input: WriteDocumentInput): DocumentRecord {
    const relativePath = this.normalizeDataPath(input.path);
    const existing = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(relativePath);
    if (existing) return this.updateExistingDocument(existing, input);

    const id = createId('doc');
    const now = nowIso();
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
    this.insertDocumentRecord(record, input.content);
    // 写正文必须放在唯一约束检查之后，避免数据库失败但 Markdown 已覆盖造成状态不一致。
    writeDocumentMarkdown(absolutePath, record, input.content);
    return record;
  }

  upsertDocument(input: WriteDocumentInput): DocumentRecord {
    const normalized = this.normalizeDataPath(input.path);
    const existing = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    if (!existing) return this.writeDocument(input);
    return this.updateExistingDocument(existing, input);
  }

  private updateExistingDocument(existing: unknown, input: WriteDocumentInput): DocumentRecord {
    const current = mapDocument(existing);
    const absolutePath = resolveDataPath(this.config.dataRoot, current.path);
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
    this.updateDocumentRecord(updated, input.content);
    // 先更新索引记录，再覆盖文件，避免 SQL 失败时留下已更新正文和旧数据库记录。
    writeDocumentMarkdown(absolutePath, updated, input.content);
    return updated;
  }

  readDocument(docPath: string): { record?: DocumentRecord; content: string; data: Record<string, unknown>; relative_path: string; absolute_path: string } {
    const normalized = this.normalizeDataPath(docPath);
    const absolutePath = resolveDataPath(this.config.dataRoot, normalized);
    if (!fs.existsSync(absolutePath)) throw new Error(`Document not found: ${docPath}`);
    const parsed = readMarkdownContent(absolutePath);
    const row = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    return { record: row ? mapDocument(row) : undefined, content: parsed.content, data: parsed.data, relative_path: normalized, absolute_path: absolutePath };
  }

  dataRelativePathFromExternalImport(project: string, sourcePath: string, baseDir?: string): string {
    const fileName = path.basename(sourcePath);
    const relative = baseDir ? path.relative(baseDir, sourcePath).replace(/\\/g, '/') : fileName;
    return `docs/projects/${project}/imports/${relative}`;
  }

  patchDocument(docPath: string, oldText: string, newText: string): DocumentRecord {
    const normalized = this.normalizeDataPath(docPath);
    const absolutePath = resolveDataPath(this.config.dataRoot, normalized);
    const parsed = readMarkdownContent(absolutePath);
    if (!parsed.content.includes(oldText)) throw new Error('old_text not found in document content.');
    const nextContent = parsed.content.replace(oldText, newText);
    const row = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    if (!row) throw new Error(`Document is not indexed: ${docPath}`);
    const record = { ...mapDocument(row), checksum: checksum(nextContent), updated_at: nowIso() };
    this.db.prepare('UPDATE documents SET checksum=@checksum, updated_at=@updated_at WHERE id=@id').run(record);
    this.upsertDocumentFts(record, nextContent);
    // patch_doc 也保持同样顺序：数据库失败时不提前覆盖用户的 Markdown 正文。
    writeDocumentMarkdown(absolutePath, record, nextContent);
    return record;
  }

  searchDocs(input: SearchDocsInput): SearchDocResult[] {
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
      params.query = ftsMatchQuery(input.query);
      const sql = `SELECT d.* FROM documents_fts f JOIN documents d ON d.id = f.id ${where ? `${where} AND` : 'WHERE'} documents_fts MATCH @query ORDER BY bm25(documents_fts), d.updated_at DESC LIMIT @limit`;
      const results = this.db.prepare(sql).all(params).map(mapDocument);
      if (results.length > 0) return this.enrichDocResults(results, input);
      params.like = `%${input.query.trim()}%`;
      const likeSql = `SELECT d.* FROM documents_fts f JOIN documents d ON d.id = f.id ${where ? `${where} AND` : 'WHERE'} (d.title LIKE @like OR d.brief LIKE @like OR d.tags LIKE @like OR f.content LIKE @like) ORDER BY d.updated_at DESC LIMIT @limit`;
      return this.enrichDocResults(this.db.prepare(likeSql).all(params).map(mapDocument), input);
    }
    return this.enrichDocResults(this.db.prepare(`SELECT d.* FROM documents d ${where} ORDER BY d.updated_at DESC LIMIT @limit`).all(params).map(mapDocument), input);
  }

  createOrUpdateDocIndex(docPath: string): MemoryRecord {
    const normalized = this.normalizeDataPath(docPath);
    const row = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(normalized);
    if (!row) throw new Error(`Document is not indexed: ${docPath}`);
    const doc = mapDocument(row);
    if (doc.index_memory_id) {
      return this.updateMemory(doc.index_memory_id, {
        semantic_type: doc.semantic_type,
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
      semantic_type: doc.semantic_type,
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
    const doc = this.upsertDocument({
      project: memory.project,
      path: this.demotedMemoryDocumentPath(memory),
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
    this.db.prepare('UPDATE documents SET index_memory_id = ? WHERE id = ?').run(updated.id, doc.id);
    return { document: doc, memory: updated };
  }

  moveDocument(oldPath: string, newPath: string, options: { overwrite?: boolean } = {}): {
    document: DocumentRecord;
    old_path: string;
    new_path: string;
    old_absolute_path: string;
    new_absolute_path: string;
    updated_memory_ids: string[];
  } {
    const oldRelative = this.normalizeDataPath(oldPath);
    const newRelative = this.normalizeDataPath(newPath);
    const oldAbsolute = resolveDataPath(this.config.dataRoot, oldRelative);
    const newAbsolute = resolveDataPath(this.config.dataRoot, newRelative);
    const row = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(oldRelative);
    if (!row) throw new Error(`Document is not indexed: ${oldPath}`);
    if (!fs.existsSync(oldAbsolute)) throw new Error(`Document file not found: ${oldPath}`);
    if (oldRelative === newRelative) {
      return {
        document: mapDocument(row),
        old_path: oldRelative,
        new_path: newRelative,
        old_absolute_path: oldAbsolute,
        new_absolute_path: newAbsolute,
        updated_memory_ids: []
      };
    }

    const existingTarget = this.db.prepare('SELECT * FROM documents WHERE path = ?').get(newRelative);
    if (existingTarget) throw new Error(`Target path is already indexed: ${newPath}`);
    if (fs.existsSync(newAbsolute) && !options.overwrite) {
      throw new Error(`Target file already exists: ${newPath}`);
    }

    const parsed = readMarkdownContent(oldAbsolute);
    const current = mapDocument(row);
    const updated: DocumentRecord = {
      ...current,
      path: newRelative,
      checksum: checksum(parsed.content),
      updated_at: nowIso()
    };

    ensureDir(path.dirname(newAbsolute));
    if (fs.existsSync(newAbsolute)) fs.rmSync(newAbsolute);
    fs.renameSync(oldAbsolute, newAbsolute);
    writeDocumentMarkdown(newAbsolute, updated, parsed.content);
    this.db.prepare('UPDATE documents SET path=@path, checksum=@checksum, updated_at=@updated_at WHERE id=@id').run(updated);
    this.upsertDocumentFts(updated, parsed.content);

    const memoryRows = this.db.prepare('SELECT id FROM memories WHERE related_doc = ? OR id = ?')
      .all(oldRelative, current.index_memory_id ?? '') as Array<{ id: string }>;
    const updatedMemoryIds: string[] = [];
    for (const memoryRow of memoryRows) {
      const patch = memoryRow.id === current.index_memory_id
        ? { title: updated.title, brief: updated.brief ?? `Document: ${updated.path}`, related_doc: updated.path, tags: updated.tags }
        : { related_doc: updated.path };
      this.updateMemory(memoryRow.id, patch as any);
      updatedMemoryIds.push(memoryRow.id);
    }

    return {
      document: updated,
      old_path: oldRelative,
      new_path: newRelative,
      old_absolute_path: oldAbsolute,
      new_absolute_path: newAbsolute,
      updated_memory_ids: updatedMemoryIds
    };
  }

  private normalizeDataPath(inputPath: string): string {
    return inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  private insertDocumentRecord(record: DocumentRecord, content: string): void {
    this.db.prepare(`INSERT INTO documents (
      id, project, path, semantic_type, title, brief, tags, status, checksum,
      last_verified_commit, index_memory_id, created_at, updated_at
    ) VALUES (@id, @project, @path, @semantic_type, @title, @brief, @tags, @status, @checksum,
      @last_verified_commit, @index_memory_id, @created_at, @updated_at)`).run({ ...record, tags: json(record.tags) });
    this.upsertDocumentFts(record, content);
  }

  private updateDocumentRecord(record: DocumentRecord, content: string): void {
    this.db.prepare(`UPDATE documents SET
      project=@project, semantic_type=@semantic_type, title=@title, brief=@brief, tags=@tags,
      status=@status, checksum=@checksum, last_verified_commit=@last_verified_commit,
      index_memory_id=@index_memory_id, updated_at=@updated_at
      WHERE id=@id`).run({ ...record, tags: json(record.tags) });
    this.upsertDocumentFts(record, content);
  }

  private shouldLoadIndexInContext(memory: MemoryRecord): boolean {
    const typeConfig = this.config.semanticTypes[memory.semantic_type];
    if (!typeConfig) return true;
    return typeConfig.show_in_context && typeConfig.auto_load_index;
  }

  private enrichDocResults(records: DocumentRecord[], input: SearchDocsInput): SearchDocResult[] {
    const mode = input.mode ?? 'index';
    if (mode === 'index') return records;
    return records.map((record) => {
      const absolutePath = resolveDataPath(this.config.dataRoot, record.path);
      const parsed = fs.existsSync(absolutePath) ? readMarkdownContent(absolutePath) : { content: '' };
      if (mode === 'full') {
        return { ...record, content: parsed.content };
      }
      return { ...record, snippet: this.makeSnippet(parsed.content, input.query, input.snippet_radius) };
    });
  }

  private makeSnippet(content: string, query?: string, radius = 80): string {
    const compactRadius = Math.max(20, Math.min(radius, 400));
    if (!content) return '';
    const terms = query?.trim().split(/\s+/).filter(Boolean) ?? [];
    const lower = content.toLowerCase();
    const hit = terms
      .map((term) => lower.indexOf(term.toLowerCase()))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, hit - compactRadius);
    const end = Math.min(content.length, hit + compactRadius);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < content.length ? '...' : '';
    return `${prefix}${content.slice(start, end)}${suffix}`.replace(/\s+/g, ' ').trim();
  }

  private nextMemoryMarkdownPath(currentRow: any, current: MemoryRecord, updated: MemoryRecord): string {
    const currentPath = typeof currentRow.markdown_path === 'string' && currentRow.markdown_path
      ? resolveDataPath(this.config.dataRoot, currentRow.markdown_path)
      : undefined;
    const shouldRepath = current.project !== updated.project
      || current.load_level !== updated.load_level
      || current.title !== updated.title;
    if (!shouldRepath && currentPath) return currentPath;
    const nextPath = memoryMarkdownPath(this.config.dataRoot, updated.project, updated.load_level, updated.id, updated.title);
    // 转换 short/long_index 时 Markdown 目录也跟随 load_level，避免旧目录中留下仍被索引引用的 stale 文件。
    if (currentPath && currentPath !== nextPath && fs.existsSync(currentPath)) {
      fs.rmSync(currentPath);
    }
    return nextPath;
  }

  private normalizeMemorySizing(record: MemoryRecord): MemoryRecord {
    const sizing = this.config.memorySizing;
    const content = record.content ?? '';
    if (record.load_level === 'short' && content.length > sizing.shortMaxChars) {
      if (!sizing.autoDemoteOverlongShort) {
        throw new Error(`Short memory is too long (${content.length} chars). Demote it to a document + long_index.`);
      }
      // 过长短记忆自动沉淀为文档，memory 只保留自动载入索引，避免长正文挤占会话上下文。
      const doc = this.upsertDocument({
        project: record.project,
        path: this.demotedMemoryDocumentPath(record),
        semantic_type: `${record.semantic_type}_doc`,
        title: record.title,
        brief: record.brief ?? this.briefFromContent(content, record.title),
        content,
        tags: record.tags,
        last_verified_commit: record.last_verified_commit ?? undefined
      });
      this.db.prepare('UPDATE documents SET index_memory_id = ? WHERE id = ?').run(record.id, doc.id);
      return {
        ...record,
        load_level: 'long_index',
        brief: record.brief ?? this.briefFromContent(content, record.title),
        content: null,
        related_doc: doc.path
      };
    }

    if (this.shouldPromoteLongIndexToShort(record)) {
      return {
        ...record,
        load_level: 'short',
        content: record.content ?? record.brief ?? '',
        related_doc: null
      };
    }

    if (record.load_level === 'long_index' && !record.brief) {
      throw new Error('long_index memory requires brief so AI can see the index without reading the body.');
    }
    return record;
  }

  private shouldPromoteLongIndexToShort(record: MemoryRecord): boolean {
    if (!this.config.memorySizing.autoPromoteShortLongIndex) return false;
    if (record.load_level !== 'long_index') return false;
    if (record.related_doc) return false;
    if (record.semantic_type === 'doc_index') return false;
    const candidateContent = record.content ?? record.brief ?? '';
    if (!candidateContent.trim()) return false;
    return candidateContent.length <= this.config.memorySizing.longToShortMaxChars;
  }

  private demotedMemoryDocumentPath(record: Pick<MemoryRecord, 'id' | 'project'>): string {
    const dir = safeSegment(this.config.memorySizing.demoteDocumentDir || 'archives');
    const root = record.project === 'global'
      ? 'docs/global'
      : `docs/projects/${safeSegment(record.project)}`;
    return `${root}/${dir}/${record.id}.md`;
  }

  private briefFromContent(content: string, fallback: string): string {
    const compact = content.replace(/\s+/g, ' ').trim();
    return compact ? compact.slice(0, 160) : fallback;
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
