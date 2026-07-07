import { usageGuideMarkdown } from './usage-guide.js';

export function renderContextMarkdown(project: string, context: any, includeGuide = true): string {
  const sections: string[] = [];
  if (includeGuide) {
    sections.push(usageGuideMarkdown, '---');
  }

  sections.push(
    `# 自动载入记忆：${project}`,
    '',
    '## 短记忆',
    ...(context.loaded_short_memories ?? []).map((memory: any) => `- [${memory.project}/${memory.semantic_type}] ${memory.title}：${memory.content}`),
    '',
    '## 长记忆索引',
    ...(context.loaded_long_memory_index ?? []).map((memory: any) => {
      const doc = memory.related_doc ? `；需要正文时读取 ${memory.related_doc}` : '';
      return `- [${memory.project}/${memory.semantic_type}] ${memory.title}：${memory.brief ?? ''}${doc}`;
    }),
    '',
    '> 长记忆索引只说明存在相关知识，不代表正文已读取。'
  );

  if ((context.related_long_memory_index ?? []).length > 0) {
    sections.push(
      '',
      '## 查询相关长记忆',
      ...(context.related_long_memory_index ?? []).map((memory: any) => {
        const doc = memory.related_doc ? `；需要正文时读取 ${memory.related_doc}` : '';
        return `- [${memory.project}/${memory.semantic_type}] ${memory.title}：${memory.brief ?? ''}${doc}`;
      })
    );
  }

  if ((context.related_document_index ?? []).length > 0) {
    sections.push(
      '',
      '## 查询相关文档',
      ...(context.related_document_index ?? []).map((doc: any) => `- [${doc.project}/${doc.semantic_type}] ${doc.title}：${doc.brief ?? ''}；路径 ${doc.path}`)
    );
  }

  sections.push('');
  return sections.join('\n');
}
