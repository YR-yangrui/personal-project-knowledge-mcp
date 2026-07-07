import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import fg from 'fast-glob';
import type { KnowledgeRepository } from './repository.js';
import type { MemoryCandidate } from './types.js';
import { createId } from './ids.js';

export interface TermStat {
  term: string;
  count: number;
  sources: string[];
}

export interface ImportMarkdownResult {
  imported: Array<{ source: string; path: string; title: string; index_memory_id?: string | null }>;
  skipped: Array<{ source: string; reason: string }>;
}

const stopWords = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into',
  '一个', '这个', '那个', '需要', '可以', '默认', '系统', '项目', '文档',
  '实现', '使用', '进行', '相关', '内容', '时候', '如果'
]);

export class StatsService {
  constructor(private readonly repo: KnowledgeRepository) {}

  termStats(project?: string, limit = 30): TermStat[] {
    const memories = this.repo.listRecentMemories(500).filter((item) => !project || item.project === project || item.project === 'global');
    const docs = this.repo.listRecentDocuments(500).filter((item) => !project || item.project === project);
    const map = new Map<string, TermStat>();

    for (const memory of memories) {
      this.collect(`${memory.title} ${memory.brief ?? ''} ${memory.content ?? ''} ${memory.tags.join(' ')}`, `memory:${memory.id}`, map);
    }
    for (const doc of docs) {
      this.collect(`${doc.title} ${doc.brief ?? ''} ${doc.tags.join(' ')}`, `doc:${doc.id}`, map);
    }

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
      .slice(0, Math.min(limit, 100));
  }

  frequentCandidates(project?: string, limit = 10): MemoryCandidate[] {
    return this.termStats(project, limit).map((stat) => ({
      id: createId('cand'),
      project: project ?? 'global',
      load_level: 'long_index',
      semantic_type: 'doc_index',
      title: `高频主题：${stat.term}`,
      brief: `在 ${stat.count} 处记忆/文档索引中反复出现，可考虑整理为主题文档或长记忆索引。`,
      content: `高频主题：${stat.term}\n出现次数：${stat.count}\n来源：${stat.sources.slice(0, 10).join(', ')}`,
      tags: ['stats', 'frequent'],
      confidence: 'low',
      priority: 'low',
      source: 'hook',
      requires_confirmation: true,
      reason: '高频统计生成，需人工确认是否值得沉淀。'
    }));
  }

  async importMarkdownDir(input: {
    sourceDir: string;
    project: string;
    pattern?: string;
    createIndex?: boolean;
    overwrite?: boolean;
  }): Promise<ImportMarkdownResult> {
    const sourceDir = path.resolve(input.sourceDir);
    const pattern = input.pattern ?? '**/*.md';
    const files = await fg(pattern, { cwd: sourceDir, absolute: true, onlyFiles: true, dot: false });
    const imported: ImportMarkdownResult['imported'] = [];
    const skipped: ImportMarkdownResult['skipped'] = [];

    for (const file of files) {
      try {
        const raw = fs.readFileSync(file, 'utf8');
        const parsed = matter(raw);
        const title = this.getTitle(parsed.content, parsed.data.title, file);
        const brief = this.getBrief(parsed.content, parsed.data.brief);
        const tags = Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : ['import'];
        const targetPath = this.repo.dataRelativePathFromExternalImport(input.project, file, sourceDir);
        const record = input.overwrite
          ? this.repo.upsertDocument({
            project: input.project,
            path: targetPath,
            semantic_type: String(parsed.data.semantic_type ?? 'imported_doc'),
            title,
            brief,
            content: parsed.content,
            tags
          })
          : this.repo.writeDocument({
            project: input.project,
            path: targetPath,
            semantic_type: String(parsed.data.semantic_type ?? 'imported_doc'),
            title,
            brief,
            content: parsed.content,
            tags
          });
        const index = input.createIndex === false ? undefined : this.repo.createOrUpdateDocIndex(record.path);
        imported.push({ source: file, path: record.path, title: record.title, index_memory_id: index?.id ?? record.index_memory_id });
      } catch (error) {
        skipped.push({ source: file, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    return { imported, skipped };
  }

  private collect(text: string, source: string, map: Map<string, TermStat>): void {
    const terms = text
      .split(/[^\p{L}\p{N}_\-\u4e00-\u9fa5]+/u)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 32 && !stopWords.has(item.toLowerCase()));
    const seen = new Set<string>();
    for (const term of terms) {
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const stat = map.get(key) ?? { term, count: 0, sources: [] };
      stat.count++;
      if (stat.sources.length < 20) stat.sources.push(source);
      map.set(key, stat);
    }
  }

  private getTitle(content: string, frontmatterTitle: unknown, file: string): string {
    if (typeof frontmatterTitle === 'string' && frontmatterTitle.trim()) return frontmatterTitle.trim();
    const heading = content.match(/^#\s+(.+)$/m);
    return heading?.[1]?.trim() || path.basename(file, path.extname(file));
  }

  private getBrief(content: string, frontmatterBrief: unknown): string {
    if (typeof frontmatterBrief === 'string' && frontmatterBrief.trim()) return frontmatterBrief.trim();
    const firstParagraph = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#') && !line.startsWith('---'));
    return firstParagraph ? firstParagraph.slice(0, 160) : '';
  }
}
