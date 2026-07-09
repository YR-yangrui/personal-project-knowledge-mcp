import Database from 'better-sqlite3';
import path from 'node:path';
import { ensureDir } from './paths.js';

export function openDatabase(dataRoot: string): Database.Database {
  ensureDir(dataRoot);
  const db = new Database(path.join(dataRoot, 'memory.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      scope TEXT NOT NULL,
      load_level TEXT NOT NULL CHECK(load_level IN ('short', 'long_index')),
      semantic_type TEXT NOT NULL,
      title TEXT NOT NULL,
      brief TEXT,
      content TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'manual',
      confidence TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'active',
      priority TEXT NOT NULL DEFAULT 'normal',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT,
      last_accessed_at TEXT,
      last_verified_commit TEXT,
      related_doc TEXT,
      related_files TEXT NOT NULL DEFAULT '[]',
      supersedes TEXT NOT NULL DEFAULT '[]',
      superseded_by TEXT NOT NULL DEFAULT '[]',
      markdown_path TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      id UNINDEXED,
      title,
      brief,
      content,
      tags
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      semantic_type TEXT NOT NULL,
      title TEXT NOT NULL,
      brief TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      checksum TEXT,
      last_verified_commit TEXT,
      index_memory_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      id UNINDEXED,
      title,
      brief,
      content,
      tags
    );

    CREATE TABLE IF NOT EXISTS document_changes (
      id TEXT PRIMARY KEY,
      document_id TEXT,
      project TEXT NOT NULL,
      path TEXT NOT NULL,
      change_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      obsolete_reason TEXT,
      related_commit TEXT,
      related_session TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
    CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
    CREATE INDEX IF NOT EXISTS idx_memories_load_level ON memories(load_level);
    CREATE INDEX IF NOT EXISTS idx_memories_semantic_type ON memories(semantic_type);
    CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_documents_semantic_type ON documents(semantic_type);
    CREATE INDEX IF NOT EXISTS idx_document_changes_path ON document_changes(path);
    CREATE INDEX IF NOT EXISTS idx_document_changes_project ON document_changes(project);
    CREATE INDEX IF NOT EXISTS idx_document_changes_status ON document_changes(status);
    CREATE INDEX IF NOT EXISTS idx_document_changes_type ON document_changes(change_type);
  `);
}
