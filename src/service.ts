import type { KnowledgeRepository } from './repository.js';
import { CandidateExtractor } from './candidates.js';
import type { AppConfig } from './config.js';
import type { CommitCandidatesInput, CommitCandidatesResult, MemoryCandidate, MemoryRecord } from './types.js';

export class KnowledgeService {
  private readonly extractor: CandidateExtractor;

  constructor(private readonly repo: KnowledgeRepository, private readonly config: AppConfig) {
    this.extractor = new CandidateExtractor(config);
  }

  buildContext(project?: string, query?: string, budgetTokens?: number): Record<string, unknown> {
    const loaded = this.repo.listLoadedMemory(project);
    const relatedDocs = query
      ? this.repo.searchDocs({ project, query, status: 'active', limit: 5 })
      : [];
    const relatedLongMemory = query
      ? this.repo.searchMemory({ project, query, status: 'active', load_level: 'long_index', limit: 5 })
      : [];

    const short = this.trimShortMemories(loaded.short, budgetTokens);
    return {
      loaded_short_memories: short.map((m) => ({
        id: m.id,
        project: m.project,
        semantic_type: m.semantic_type,
        title: m.title,
        content: m.content,
        confidence: m.confidence,
        priority: m.priority
      })),
      loaded_long_memory_index: loaded.longIndex.map((m) => ({
        id: m.id,
        project: m.project,
        semantic_type: m.semantic_type,
        title: m.title,
        brief: m.brief,
        related_doc: m.related_doc,
        confidence: m.confidence,
        priority: m.priority
      })),
      related_long_memory_index: relatedLongMemory.map((m) => ({
        id: m.id,
        project: m.project,
        semantic_type: m.semantic_type,
        title: m.title,
        brief: m.brief,
        related_doc: m.related_doc
      })),
      related_document_index: relatedDocs.map((d) => ({
        id: d.id,
        project: d.project,
        semantic_type: d.semantic_type,
        title: d.title,
        brief: d.brief,
        path: d.path
      })),
      notes: [
        '短记忆已自动全文载入，可直接使用。',
        '长记忆索引和文档入口只说明存在相关知识，不代表正文已读取；需要正文时调用 read_doc。'
      ]
    };
  }

  private trimShortMemories(records: MemoryRecord[], budgetTokens?: number): MemoryRecord[] {
    if (!budgetTokens) return records;
    // 粗略按 1 token≈2 个中文/英文字符预算，首版只防止异常超载，不做精确 tokenizer。
    let usedChars = 0;
    const maxChars = budgetTokens * 2;
    const result: MemoryRecord[] = [];
    for (const record of records) {
      const len = (record.content ?? '').length + record.title.length;
      if (usedChars + len > maxChars) break;
      result.push(record);
      usedChars += len;
    }
    return result;
  }

  extractMemoryCandidates(conversation: string, project?: string): MemoryCandidate[] {
    return this.extractor.extract(conversation, project ?? 'global');
  }

  commitMemoryCandidates(input: CommitCandidatesInput): CommitCandidatesResult {
    const committed: CommitCandidatesResult['committed'] = [];
    const skipped: CommitCandidatesResult['skipped'] = [];
    const confirmed = new Set(input.confirmed_ids ?? []);
    const mode = input.mode ?? 'auto';

    for (const candidate of input.candidates) {
      if (candidate.requires_confirmation && mode !== 'all' && !confirmed.has(candidate.id)) {
        skipped.push({ candidate, reason: 'requires_confirmation' });
        continue;
      }

      try {
        if (candidate.load_level === 'short' && candidate.content.length <= this.config.maxShortMemoryChars) {
          committed.push(this.repo.writeMemory({
            project: candidate.project,
            load_level: 'short',
            semantic_type: candidate.semantic_type,
            title: candidate.title,
            content: candidate.content,
            tags: candidate.tags,
            source: candidate.source,
            confidence: candidate.confidence,
            priority: candidate.priority
          }));
          continue;
        }

        // 长内容不能直接进入短记忆：先沉淀为文档，再创建可自动载入的 long_index。
        const docPath = `docs/projects/${candidate.project}/archives/${candidate.id}.md`;
        const document = this.repo.writeDocument({
          project: candidate.project,
          path: docPath,
          semantic_type: `${candidate.semantic_type}_doc`,
          title: candidate.title,
          brief: candidate.brief ?? candidate.title,
          content: candidate.content,
          tags: candidate.tags
        });
        const memory = this.repo.createOrUpdateDocIndex(document.path);
        committed.push({ document, memory });
      } catch (error) {
        skipped.push({ candidate, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    return { committed, skipped };
  }

  recordSessionArtifacts(project: string, docs: Array<{ path: string; title: string; content: string; brief?: string; tags?: string[] }> = [], memories: MemoryCandidate[] = []): CommitCandidatesResult {
    const committed: CommitCandidatesResult['committed'] = [];
    const skipped: CommitCandidatesResult['skipped'] = [];

    for (const doc of docs) {
      try {
        const written = this.repo.writeDocument({
          project,
          path: doc.path,
          semantic_type: 'session_artifact',
          title: doc.title,
          brief: doc.brief,
          content: doc.content,
          tags: doc.tags ?? ['session']
        });
        const memory = this.repo.createOrUpdateDocIndex(written.path);
        committed.push({ document: written, memory });
      } catch (error) {
        skipped.push({
          candidate: {
            id: `doc:${doc.path}`,
            project,
            load_level: 'long_index',
            semantic_type: 'doc_index',
            title: doc.title,
            content: doc.content,
            tags: doc.tags ?? ['session'],
            confidence: 'medium',
            priority: 'normal',
            source: 'manual',
            requires_confirmation: false,
            reason: 'record_session_artifacts document'
          },
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const memoryResult = this.commitMemoryCandidates({ candidates: memories, mode: 'auto' });
    committed.push(...memoryResult.committed);
    skipped.push(...memoryResult.skipped);
    return { committed, skipped };
  }
}
