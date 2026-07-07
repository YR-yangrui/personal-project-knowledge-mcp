import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import YAML from 'yaml';

export interface AppConfig {
  dataRoot: string;
  maxShortMemoryChars: number;
  budgets: {
    globalShortTokens: number;
    projectShortTokens: number;
    longIndexTokens: number;
    relatedTopK: number;
  };
  semanticTypes: Record<string, { default_load_level: 'short' | 'long_index'; default_scope: string }>;
}

const defaultSemanticTypes = {
  preference: { default_load_level: 'short', default_scope: 'global' },
  gotcha: { default_load_level: 'short', default_scope: 'global' },
  project_rule: { default_load_level: 'short', default_scope: 'project' },
  decision: { default_load_level: 'long_index', default_scope: 'project' },
  requirement_change: { default_load_level: 'long_index', default_scope: 'project' },
  doc_index: { default_load_level: 'long_index', default_scope: 'project' },
  snippet: { default_load_level: 'short', default_scope: 'global' }
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
  return {
    ...base,
    ...raw,
    dataRoot: raw.dataRoot ?? dataRoot,
    budgets: { ...base.budgets, ...(raw.budgets ?? {}) },
    semanticTypes: { ...base.semanticTypes, ...(raw.semanticTypes ?? {}) }
  };
}
