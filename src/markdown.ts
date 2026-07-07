import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { ensureDir } from './paths.js';
import type { DocumentRecord, MemoryRecord } from './types.js';

function cleanFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

export function writeMemoryMarkdown(filePath: string, record: MemoryRecord): void {
  ensureDir(path.dirname(filePath));
  const body = record.load_level === 'short'
    ? (record.content ?? '')
    : `> 长记忆索引只说明存在相关知识，不代表正文已读取。\n\n${record.brief ?? ''}\n`;
  const data = {
    id: record.id,
    project: record.project,
    scope: record.scope,
    load_level: record.load_level,
    semantic_type: record.semantic_type,
    title: record.title,
    brief: record.brief ?? undefined,
    tags: record.tags,
    source: record.source,
    confidence: record.confidence,
    status: record.status,
    priority: record.priority,
    expires_at: record.expires_at ?? undefined,
    last_verified_commit: record.last_verified_commit ?? undefined,
    related_doc: record.related_doc ?? undefined,
    related_files: record.related_files,
    supersedes: record.supersedes,
    superseded_by: record.superseded_by,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
  fs.writeFileSync(filePath, matter.stringify(body, cleanFrontmatter(data)), 'utf8');
}

export function writeDocumentMarkdown(filePath: string, record: DocumentRecord, content: string): void {
  ensureDir(path.dirname(filePath));
  const data = {
    id: record.id,
    project: record.project,
    semantic_type: record.semantic_type,
    title: record.title,
    brief: record.brief ?? undefined,
    tags: record.tags,
    status: record.status,
    checksum: record.checksum ?? undefined,
    last_verified_commit: record.last_verified_commit ?? undefined,
    index_memory_id: record.index_memory_id ?? undefined,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
  fs.writeFileSync(filePath, matter.stringify(content, cleanFrontmatter(data)), 'utf8');
}

export function readMarkdownContent(filePath: string): { data: Record<string, unknown>; content: string } {
  const parsed = matter(fs.readFileSync(filePath, 'utf8'));
  return { data: parsed.data, content: parsed.content };
}
