import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import YAML from 'yaml';

export interface SemanticTypeConfig {
  default_load_level: 'short' | 'long_index';
  default_scope: string;
  description: string;
  searchable: boolean;
  auto_load_index: boolean;
  show_in_context: boolean;
  show_in_webui: boolean;
}

export interface AppConfig {
  dataRoot: string;
  maxShortMemoryChars: number;
  memorySizing: {
    shortMaxChars: number;
    longToShortMaxChars: number;
    autoDemoteOverlongShort: boolean;
    autoPromoteShortLongIndex: boolean;
    demoteDocumentDir: string;
  };
  budgets: {
    globalShortTokens: number;
    projectShortTokens: number;
    longIndexTokens: number;
    relatedTopK: number;
  };
  semanticTypes: Record<string, SemanticTypeConfig>;
}

const defaultSemanticTypes = {
  preference: { default_load_level: 'short', default_scope: 'global', description: '个人偏好和稳定行为约束。', searchable: true, auto_load_index: true, show_in_context: true, show_in_webui: true },
  gotcha: { default_load_level: 'short', default_scope: 'global', description: '简短踩坑和跨项目经验。', searchable: true, auto_load_index: true, show_in_context: true, show_in_webui: true },
  project_rule: { default_load_level: 'short', default_scope: 'project', description: '项目硬规则和长期约定。', searchable: true, auto_load_index: true, show_in_context: true, show_in_webui: true },
  decision: { default_load_level: 'long_index', default_scope: 'project', description: '项目决策记录；长正文按需读取。', searchable: true, auto_load_index: true, show_in_context: true, show_in_webui: true },
  requirement_change: { default_load_level: 'long_index', default_scope: 'project', description: '需求变更记录；长正文按需读取。', searchable: true, auto_load_index: true, show_in_context: true, show_in_webui: true },
  doc_index: { default_load_level: 'long_index', default_scope: 'project', description: '兼容旧文档索引分类。', searchable: true, auto_load_index: true, show_in_context: true, show_in_webui: true },
  module_doc: { default_load_level: 'long_index', default_scope: 'project', description: '模块文档入口。', searchable: true, auto_load_index: true, show_in_context: true, show_in_webui: true },
  bugfix: { default_load_level: 'long_index', default_scope: 'project', description: 'Bug 修复记录；默认仅搜索，不占启动上下文。', searchable: true, auto_load_index: false, show_in_context: false, show_in_webui: true },
  bug_report: { default_load_level: 'long_index', default_scope: 'project', description: 'MCP 或项目问题报告；默认仅搜索。', searchable: true, auto_load_index: false, show_in_context: false, show_in_webui: true },
  session_artifact: { default_load_level: 'long_index', default_scope: 'project', description: '会话产物归档；默认仅搜索。', searchable: true, auto_load_index: false, show_in_context: false, show_in_webui: true },
  snippet: { default_load_level: 'short', default_scope: 'global', description: '短片段或可复用片段。', searchable: true, auto_load_index: true, show_in_context: true, show_in_webui: true }
} as const;

export function defaultDataRoot(): string {
  return process.env.PPKM_DATA_ROOT || path.join(os.homedir(), '.personal-project-knowledge-mcp');
}

export function loadConfig(): AppConfig {
  const dataRoot = defaultDataRoot();
  const configPath = path.join(dataRoot, 'config.yaml');
  const base: AppConfig = {
    dataRoot,
    maxShortMemoryChars: 500,
    memorySizing: {
      shortMaxChars: 500,
      longToShortMaxChars: 300,
      autoDemoteOverlongShort: true,
      autoPromoteShortLongIndex: true,
      demoteDocumentDir: 'archives'
    },
    budgets: {
      globalShortTokens: 800,
      projectShortTokens: 1200,
      longIndexTokens: 2000,
      relatedTopK: 5
    },
    semanticTypes: { ...defaultSemanticTypes }
  };

  if (!fs.existsSync(configPath)) return base;
  const raw = YAML.parse(fs.readFileSync(configPath, 'utf8')) ?? {};
  const rawMemorySizing = raw.memorySizing ?? {};
  const shortMaxChars = rawMemorySizing.shortMaxChars ?? raw.maxShortMemoryChars ?? base.memorySizing.shortMaxChars;
  const rawSemanticTypes = raw.semanticTypes ?? {};
  const semanticTypes = mergeSemanticTypes(base.semanticTypes, rawSemanticTypes);
  return {
    ...base,
    ...raw,
    dataRoot: raw.dataRoot ?? dataRoot,
    // Keep maxShortMemoryChars for older config.yaml files while using memorySizing as
    // the canonical threshold group for automatic short/long conversion.
    maxShortMemoryChars: shortMaxChars,
    memorySizing: { ...base.memorySizing, ...rawMemorySizing, shortMaxChars },
    budgets: { ...base.budgets, ...(raw.budgets ?? {}) },
    semanticTypes
  };
}

function mergeSemanticTypes(base: AppConfig['semanticTypes'], raw: Record<string, Partial<SemanticTypeConfig>>): AppConfig['semanticTypes'] {
  const result: AppConfig['semanticTypes'] = { ...base };
  for (const [name, value] of Object.entries(raw)) {
    const fallback = base[name] ?? {
      default_load_level: 'long_index',
      default_scope: 'project',
      description: '',
      searchable: true,
      auto_load_index: false,
      show_in_context: false,
      show_in_webui: true
    } satisfies SemanticTypeConfig;
    result[name] = { ...fallback, ...value };
  }
  return result;
}
