import { createId } from './ids.js';
import type { AppConfig } from './config.js';
import type { MemoryCandidate } from './types.js';

const highRiskTypes = new Set(['decision', 'requirement_change']);

interface Rule {
  semantic_type: string;
  tags: string[];
  keywords: string[];
  projectScoped: boolean;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

const rules: Rule[] = [
  { semantic_type: 'preference', tags: ['preference'], keywords: ['偏好', '默认', '以后都', '以后请', '我喜欢', '记住'], projectScoped: false, priority: 'high' },
  { semantic_type: 'gotcha', tags: ['gotcha'], keywords: ['坑', '报错', '失败原因', '踩坑', '注意', '不要再', '避免'], projectScoped: false, priority: 'normal' },
  { semantic_type: 'project_rule', tags: ['rule'], keywords: ['必须', '禁止', '规则', '约定', '默认路径', '强制'], projectScoped: true, priority: 'high' },
  { semantic_type: 'decision', tags: ['decision'], keywords: ['决定', '决策', '采用', '选择', '不做', '暂缓'], projectScoped: true, priority: 'normal' },
  { semantic_type: 'requirement_change', tags: ['requirement'], keywords: ['需求变更', '改为', '改成', '从', '调整为'], projectScoped: true, priority: 'normal' }
];

export class CandidateExtractor {
  constructor(private readonly config: AppConfig) {}

  extract(conversation: string, project = 'global'): MemoryCandidate[] {
    const lines = this.normalizeLines(conversation);
    const candidates: MemoryCandidate[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const rule = this.matchRule(line);
      if (!rule) continue;
      const targetProject = rule.projectScoped ? project : 'global';
      const title = this.makeTitle(line, rule.semantic_type);
      const key = `${targetProject}|${rule.semantic_type}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const loadLevel = line.length <= this.config.maxShortMemoryChars ? 'short' : 'long_index';
      candidates.push({
        id: createId('cand'),
        project: targetProject,
        load_level: loadLevel,
        semantic_type: rule.semantic_type,
        title,
        brief: loadLevel === 'long_index' ? this.truncate(line, 120) : undefined,
        content: line,
        tags: rule.tags,
        confidence: 'medium',
        priority: rule.priority,
        source: 'conversation',
        requires_confirmation: highRiskTypes.has(rule.semantic_type),
        reason: `命中关键词规则：${rule.semantic_type}`
      });
    }
    return candidates;
  }

  private normalizeLines(conversation: string): string[] {
    return conversation
      .split(/\r?\n|。|；|;|!/g)
      .map((line) => line.replace(/^[-*\d.、\s]+/, '').trim())
      .filter((line) => line.length >= 8 && line.length <= 2000);
  }

  private matchRule(line: string): Rule | undefined {
    for (const rule of rules) {
      for (const keyword of rule.keywords) {
        if (line.includes(keyword)) return rule;
      }
    }
    return undefined;
  }

  private makeTitle(line: string, semanticType: string): string {
    const prefix = semanticType.replace(/_/g, ' ');
    return `${prefix}: ${this.truncate(line, 36)}`;
  }

  private truncate(value: string, max: number): string {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
  }
}
