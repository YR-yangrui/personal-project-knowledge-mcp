import type { KnowledgeRepository } from './repository.js';
import { CandidateExtractor } from './candidates.js';
import type { AppConfig } from './config.js';
import type { CommitCandidatesInput, CommitCandidatesResult, MemoryCandidate } from './types.js';
import { nowIso } from './ids.js';
import { slugify } from './paths.js';

export class KnowledgeService {
  private readonly extractor: CandidateExtractor;

  constructor(private readonly repo: KnowledgeRepository, private readonly config: AppConfig) {
    this.extractor = new CandidateExtractor(config);
  }

  buildContext(project?: string, query?: string, budgetTokens?: number): Record<string, unknown> {
    const loaded = this.repo.listLoadedMemory(project);
    const semanticTypeCounts = query ? [] : this.repo.semanticTypeCounts(project);
    const relatedDocs = query
      ? this.repo.searchDocs({ project, query, status: 'active', limit: 5, mode: 'index' })
      : [];
    const relatedLongMemory = query
      ? this.repo.searchMemory({ project, query, status: 'active', load_level: 'long_index', limit: 5 })
      : [];

    const loadedShort = loaded.short.map((m) => ({
      id: m.id,
      project: m.project,
      semantic_type: m.semantic_type,
      title: m.title,
      content: m.content,
      confidence: m.confidence,
      priority: m.priority
    }));
    const loadedLong = loaded.longIndex.map((m) => ({
      id: m.id,
      project: m.project,
      semantic_type: m.semantic_type,
      title: m.title,
      brief: m.brief,
      related_doc: m.related_doc,
      confidence: m.confidence,
      priority: m.priority
    }));
    const relatedDocuments = relatedDocs.map((d) => ({
      id: d.id,
      project: d.project,
      semantic_type: d.semantic_type,
      title: d.title,
      brief: d.brief,
      path: d.path
    }));
    const relatedDocumentPaths = new Set(relatedDocuments.map((doc) => doc.path));
    const relatedLong = relatedLongMemory
      // 文档索引和文档搜索经常指向同一正文，只保留信息更直接的文档入口。
      .filter((m) => !m.related_doc || !relatedDocumentPaths.has(m.related_doc))
      .map((m) => ({
        id: m.id,
        project: m.project,
        semantic_type: m.semantic_type,
        title: m.title,
        brief: m.brief,
        related_doc: m.related_doc
      }));
    const context = {
      semantic_type_catalog: query ? [] : this.semanticTypeCatalog(semanticTypeCounts),
      loaded_short_memories: loadedShort,
      loaded_long_memory_index: loadedLong,
      related_long_memory_index: relatedLong,
      related_document_index: relatedDocuments,
      notes: [
        '短记忆已自动全文载入，可直接使用。',
        '长记忆索引和文档入口只说明存在相关知识，不代表正文已读取；需要正文时调用 read_doc。',
        query
          ? '定向查询已优先装入相关结果；分类目录可通过 list_semantic_types 按需读取。'
          : 'semantic_type_catalog 会列出可搜索分类；show_in_context=false 或 auto_load_index=false 的分类默认不占启动上下文，需要主动搜索。'
      ]
    };
    return budgetTokens ? this.fitContextToBudget(context, budgetTokens) : context;
  }

  semanticTypeCatalog(counts = this.repo.semanticTypeCounts()): Array<Record<string, unknown>> {
    const countMap = new Map(counts.map((item) => [item.semantic_type, item]));
    const names = new Set([...Object.keys(this.config.semanticTypes), ...counts.map((item) => item.semantic_type)]);
    return Array.from(names).sort().map((name) => {
      const config = this.config.semanticTypes[name] ?? {
        default_load_level: 'long_index',
        default_scope: 'project',
        description: '',
        searchable: true,
        auto_load_index: false,
        show_in_context: false,
        show_in_webui: true
      };
      const count = countMap.get(name);
      return {
        semantic_type: name,
        ...config,
        memories: count?.memories ?? 0,
        documents: count?.documents ?? 0
      };
    });
  }

  private fitContextToBudget(context: Record<string, any>, budgetTokens: number): Record<string, unknown> {
    // 用保守的 1 token≈2 字符估算整个 JSON，而不是只限制短记忆正文。
    // 相关结果先进入预算，确保定向查询不会被固定目录和常驻索引挤掉。
    const maxChars = budgetTokens * 2;
    const fitted: Record<string, any> = {
      semantic_type_catalog: [],
      loaded_short_memories: [],
      loaded_long_memory_index: [],
      related_long_memory_index: [],
      related_document_index: [],
      notes: context.notes
    };
    const priorities = [
      'related_document_index',
      'related_long_memory_index',
      'loaded_short_memories',
      'loaded_long_memory_index',
      'semantic_type_catalog'
    ];

    for (const key of priorities) {
      for (const item of context[key] ?? []) {
        fitted[key].push(item);
        if (JSON.stringify(fitted).length > maxChars) fitted[key].pop();
      }
    }
    return fitted;
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
        if (candidate.content.length <= this.config.memorySizing.shortMaxChars) {
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

  recordBugReport(input: {
    project?: string;
    title: string;
    description: string;
    severity?: 'critical' | 'high' | 'normal' | 'low';
    component?: string;
    steps?: string[];
    expected?: string;
    actual?: string;
    workaround?: string;
    source?: string;
    tags?: string[];
  }): { document: ReturnType<KnowledgeRepository['writeDocument']>; memory: ReturnType<KnowledgeRepository['createOrUpdateDocIndex']> } {
    const project = input.project ?? 'global';
    const timestamp = nowIso();
    const day = timestamp.slice(0, 10);
    const docPath = `docs/projects/${project}/bug-reports/${day}-${slugify(input.title)}.md`;
    const content = [
      `# ${input.title}`,
      '',
      `- Project: ${project}`,
      `- Severity: ${input.severity ?? 'normal'}`,
      input.component ? `- Component: ${input.component}` : undefined,
      input.source ? `- Source: ${input.source}` : undefined,
      `- Reported At: ${timestamp}`,
      '',
      '## Description',
      '',
      input.description,
      '',
      input.steps?.length ? '## Steps To Reproduce' : undefined,
      ...(input.steps?.length ? ['', ...input.steps.map((step, index) => `${index + 1}. ${step}`), ''] : []),
      input.expected ? '## Expected' : undefined,
      input.expected ? '' : undefined,
      input.expected,
      input.actual ? '## Actual' : undefined,
      input.actual ? '' : undefined,
      input.actual,
      input.workaround ? '## Workaround' : undefined,
      input.workaround ? '' : undefined,
      input.workaround
    ].filter((line) => line !== undefined).join('\n');

    const document = this.repo.writeDocument({
      project,
      path: docPath,
      semantic_type: 'bug_report',
      title: input.title,
      brief: `${input.severity ?? 'normal'} bug${input.component ? ` in ${input.component}` : ''}: ${input.description.slice(0, 120)}`,
      content,
      tags: ['bug-report', ...(input.tags ?? [])]
    });
    const memory = this.repo.createOrUpdateDocIndex(document.path);
    return { document, memory };
  }
}
