export type LoadLevel = 'short' | 'long_index';
export type Scope = 'global' | 'project' | 'module' | 'file' | 'user';
export type Status = 'active' | 'stale' | 'deprecated' | 'deleted';
export type Confidence = 'high' | 'medium' | 'low';
export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface MemoryRecord {
  id: string;
  project: string;
  scope: Scope;
  load_level: LoadLevel;
  semantic_type: string;
  title: string;
  brief?: string | null;
  content?: string | null;
  tags: string[];
  source: string;
  confidence: Confidence;
  status: Status;
  priority: Priority;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  last_accessed_at?: string | null;
  last_verified_commit?: string | null;
  related_doc?: string | null;
  related_files: string[];
  supersedes: string[];
  superseded_by: string[];
}

export interface DocumentRecord {
  id: string;
  project: string;
  path: string;
  semantic_type: string;
  title: string;
  brief?: string | null;
  tags: string[];
  status: Status;
  checksum?: string | null;
  last_verified_commit?: string | null;
  index_memory_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageInfo {
  data_root: string;
  documents_root: string;
  memories_root: string;
  database_path: string;
  config_path: string;
  backups_root: string;
  default_imports_root: string;
  project_documents_root?: string;
  path_rules: string[];
}

export interface DocumentLocation {
  relative_path: string;
  absolute_path: string;
  exists: boolean;
  indexed: boolean;
  record?: DocumentRecord;
}

export interface WriteMemoryInput {
  project?: string;
  scope?: Scope;
  load_level: LoadLevel;
  semantic_type: string;
  title: string;
  brief?: string;
  content?: string;
  tags?: string[];
  source?: string;
  confidence?: Confidence;
  status?: Status;
  priority?: Priority;
  expires_at?: string;
  last_verified_commit?: string;
  related_doc?: string;
  related_files?: string[];
}

export interface WriteDocumentInput {
  project?: string;
  path: string;
  semantic_type?: string;
  title: string;
  brief?: string;
  content: string;
  tags?: string[];
  status?: Status;
  last_verified_commit?: string;
  expected_checksum?: string;
}

export interface SearchMemoryInput {
  query?: string;
  project?: string;
  semantic_type?: string;
  load_level?: LoadLevel;
  tags?: string[];
  status?: Status;
  limit?: number;
}

export interface SearchDocsInput {
  query?: string;
  project?: string;
  semantic_type?: string;
  tags?: string[];
  status?: Status;
  limit?: number;
  mode?: 'index' | 'snippet' | 'full';
  snippet_radius?: number;
}

export interface SearchDocResult extends DocumentRecord {
  snippet?: string;
  content?: string;
}

export interface SemanticTypeCount {
  semantic_type: string;
  memories: number;
  documents: number;
}

export interface MemoryCandidate {
  id: string;
  project: string;
  load_level: LoadLevel;
  semantic_type: string;
  title: string;
  brief?: string;
  content: string;
  tags: string[];
  confidence: Confidence;
  priority: Priority;
  source: 'conversation' | 'manual' | 'hook';
  requires_confirmation: boolean;
  reason: string;
}

export interface CommitCandidatesInput {
  candidates: MemoryCandidate[];
  mode?: 'auto' | 'all' | 'confirmed_only';
  confirmed_ids?: string[];
}

export interface CommitCandidatesResult {
  committed: Array<MemoryRecord | { document: DocumentRecord; memory: MemoryRecord }>;
  skipped: Array<{ candidate: MemoryCandidate; reason: string }>;
}
