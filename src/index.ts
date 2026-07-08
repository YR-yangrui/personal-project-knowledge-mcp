#!/usr/bin/env node
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createApp } from './app.js';
import { detectProject } from './project.js';
import { backupNow } from './backup.js';
import { usageGuideMarkdown } from './usage-guide.js';
import { renderContextMarkdown } from './context-markdown.js';

const { config, repo, service, stats } = createApp();

const server = new McpServer({
  name: 'personal-project-knowledge-mcp',
  version: '0.1.0'
}, {
  instructions: usageGuideMarkdown
});

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>
  };
}

server.registerTool('build_context', {
  description: 'Use at the start of a task or before answering from stored knowledge. Builds project context: short memories are full content and can be trusted directly; long memories/documents are index-only and require read_doc for details.',
  inputSchema: {
    project: z.string().optional(),
    query: z.string().optional(),
    cwd: z.string().optional(),
    budget_tokens: z.number().int().positive().optional()
  }
}, async ({ project, query, cwd, budget_tokens }) => {
  const resolvedProject = project ?? (cwd ? detectProject(cwd) : undefined);
  return jsonResult(service.buildContext(resolvedProject, query, budget_tokens));
});

server.registerTool('get_usage_guide', {
  description: 'Read the default server instructions for this personal knowledge MCP. Use when the client did not surface MCP initialize instructions or you need to confirm memory/document boundaries.',
  inputSchema: {}
}, async () => jsonResult({ markdown: usageGuideMarkdown }));

server.registerTool('get_storage_info', {
  description: 'Show where this MCP stores data, documents, memories, backups, and default imports. Use before manual file adjustment, migration, or when the assistant needs absolute document locations.',
  inputSchema: {
    project: z.string().optional()
  }
}, async ({ project }) => jsonResult(repo.getStorageInfo(project)));

server.registerPrompt('use_personal_project_knowledge', {
  title: 'Use Personal Project Knowledge',
  description: 'Load the default usage guide plus current project memories, similar to selecting a personal skill.',
  argsSchema: {
    project: z.string().optional().describe('Project name; if omitted, pass cwd so the server can infer it.'),
    cwd: z.string().optional().describe('Current working directory used to infer the project.'),
    query: z.string().optional().describe('Optional topic for related document and long-memory index retrieval.')
  }
}, async ({ project, cwd, query }) => {
  const resolvedProject = project ?? (cwd ? detectProject(cwd) : 'global');
  const context = service.buildContext(resolvedProject, query, 4000);
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: renderContextMarkdown(resolvedProject, context, true)
      }
    }]
  };
});

server.registerTool('list_loaded_memory', {
  description: 'Inspect active memories that auto-load for a project. Use to debug what the assistant should already know: short memories include full content, long_index entries include only title/brief/doc path.',
  inputSchema: { project: z.string().optional(), cwd: z.string().optional() }
}, async ({ project, cwd }) => {
  const resolvedProject = project ?? (cwd ? detectProject(cwd) : undefined);
  return jsonResult(repo.listLoadedMemory(resolvedProject));
});

server.registerTool('search_memory', {
  description: 'Search durable auto-loaded knowledge: preferences, project rules, gotchas, decisions, requirement-change indexes, and doc indexes. Use before answering questions about remembered rules or prior decisions.',
  inputSchema: {
    query: z.string().optional(),
    project: z.string().optional(),
    semantic_type: z.string().optional(),
    load_level: z.enum(['short', 'long_index']).optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['active', 'stale', 'deprecated', 'deleted']).optional(),
    limit: z.number().int().positive().max(100).optional()
  }
}, async (input) => jsonResult({ results: repo.searchMemory(input) }));

server.registerTool('get_memory', {
  description: 'Read one memory record by id after search_memory/list_loaded_memory. For long_index entries, use related_doc + read_doc if full details are needed.',
  inputSchema: { id: z.string() }
}, async ({ id }) => jsonResult(repo.getMemory(id) ?? { error: 'not_found' }));

server.registerTool('write_memory', {
  description: 'Write durable memory. Use for "remember this", preferences, project rules, gotchas, concise decisions, and long-memory indexes. Keep load_level=short concise; put long bodies into write_doc then create_or_update_doc_index.',
  inputSchema: {
    project: z.string().optional(),
    scope: z.enum(['global', 'project', 'module', 'file', 'user']).optional(),
    load_level: z.enum(['short', 'long_index']),
    semantic_type: z.string(),
    title: z.string(),
    brief: z.string().optional(),
    content: z.string().optional(),
    tags: z.array(z.string()).optional(),
    source: z.string().optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    status: z.enum(['active', 'stale', 'deprecated', 'deleted']).optional(),
    priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
    expires_at: z.string().optional(),
    last_verified_commit: z.string().optional(),
    related_doc: z.string().optional(),
    related_files: z.array(z.string()).optional()
  }
}, async (input) => jsonResult(repo.writeMemory(input)));

server.registerTool('update_memory', {
  description: 'Patch an existing memory record when a preference, rule, gotcha, decision index, or requirement-change index needs correction. Prefer updating/deprecating old records over creating contradictory active memories.',
  inputSchema: { id: z.string(), patch: z.record(z.string(), z.unknown()) }
}, async ({ id, patch }) => jsonResult(repo.updateMemory(id, patch as any)));

server.registerTool('deprecate_memory', {
  description: 'Soft-deprecate stale or superseded memory and optionally point to a replacement. Use when requirements change, a rule is no longer valid, or a newer decision overrides an older one.',
  inputSchema: { id: z.string(), reason: z.string().optional(), superseded_by: z.string().optional() }
}, async ({ id, reason, superseded_by }) => jsonResult(repo.deprecateMemory(id, reason, superseded_by)));

server.registerTool('list_projects', {
  description: 'List projects with stored memories or documents. Use when project name is unclear or the user asks what knowledge bases exist.',
  inputSchema: {}
}, async () => jsonResult({ projects: repo.listProjects() }));

server.registerTool('list_semantic_types', {
  description: 'List configured semantic types/categories, including searchability, default loading policy, and memory/document counts. Use before category-aware searches or when the user asks what categories exist.',
  inputSchema: { project: z.string().optional(), cwd: z.string().optional() }
}, async ({ project, cwd }) => {
  const resolvedProject = project ?? (cwd ? detectProject(cwd) : undefined);
  return jsonResult({ results: service.semanticTypeCatalog(repo.semanticTypeCounts(resolvedProject)) });
});

server.registerTool('search_docs', {
  description: 'Search indexed Markdown documents by text and metadata. Returns metadata/path only, not full body. Use read_doc next when the document is relevant and details matter.',
  inputSchema: {
    query: z.string().optional(),
    project: z.string().optional(),
    semantic_type: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['active', 'stale', 'deprecated', 'deleted']).optional(),
    mode: z.enum(['index', 'snippet', 'full']).optional(),
    snippet_radius: z.number().int().positive().max(400).optional(),
    limit: z.number().int().positive().max(100).optional()
  }
}, async (input) => jsonResult({ results: repo.searchDocs(input) }));

server.registerTool('read_doc', {
  description: 'Read Markdown document body by data-root-relative path. Returns relative_path and absolute_path so the assistant can tell where the file is saved. Use only after search_docs/build_context/long_index indicates the document is relevant.',
  inputSchema: { path: z.string() }
}, async ({ path }) => jsonResult(repo.readDocument(path)));

server.registerTool('write_doc', {
  description: 'Write and index a Markdown document for long-form knowledge: designs, decisions, requirement changes, investigation notes, imported docs, and session artifacts. Path is relative to the data root.',
  inputSchema: {
    project: z.string().optional(),
    path: z.string(),
    semantic_type: z.string().optional(),
    title: z.string(),
    brief: z.string().optional(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['active', 'stale', 'deprecated', 'deleted']).optional(),
    last_verified_commit: z.string().optional()
  }
}, async (input) => jsonResult(repo.writeDocument(input)));

server.registerTool('resolve_doc_path', {
  description: 'Resolve a data-root-relative document path to its absolute file path and indexing state. Use when manually adjusting or moving a Markdown document.',
  inputSchema: { path: z.string() }
}, async ({ path }) => jsonResult(repo.resolveDocumentPath(path)));

server.registerTool('patch_doc', {
  description: 'Patch an indexed Markdown document with targeted text replacement. Use for small doc corrections; use write_doc for full rewrites.',
  inputSchema: { path: z.string(), old_text: z.string(), new_text: z.string() }
}, async ({ path, old_text, new_text }) => jsonResult(repo.patchDocument(path, old_text, new_text)));

server.registerTool('move_doc', {
  description: 'Move an indexed Markdown document inside the data root and update its document record plus related long_index memory paths. Use after manual reclassification or cleanup.',
  inputSchema: {
    old_path: z.string(),
    new_path: z.string(),
    overwrite: z.boolean().optional()
  }
}, async ({ old_path, new_path, overwrite }) => jsonResult(repo.moveDocument(old_path, new_path, { overwrite })));

server.registerTool('create_or_update_doc_index', {
  description: 'Create or update a long_index memory for an indexed document so its title/brief/path auto-loads while the long Markdown body remains read-on-demand.',
  inputSchema: { path: z.string() }
}, async ({ path }) => jsonResult(repo.createOrUpdateDocIndex(path)));

server.registerTool('promote_doc_to_long_memory', {
  description: 'Alias of create_or_update_doc_index. Promote a document into auto-loaded long memory index without loading the full body every session.',
  inputSchema: { path: z.string() }
}, async ({ path }) => jsonResult(repo.createOrUpdateDocIndex(path)));

server.registerTool('demote_memory_to_doc', {
  description: 'Move an overlong memory body into a Markdown document and keep a long_index memory entry. Use when a short memory is too large or should not auto-load in full.',
  inputSchema: { memory_id: z.string() }
}, async ({ memory_id }) => jsonResult(repo.demoteMemoryToDoc(memory_id)));

server.registerTool('import_markdown_dir', {
  description: 'Import an external Markdown directory into this MCP data root. Use for bulk migration of existing personal docs; creates indexed documents and optional long_index memories.',
  inputSchema: {
    source_dir: z.string(),
    project: z.string(),
    pattern: z.string().optional(),
    create_index: z.boolean().optional(),
    overwrite: z.boolean().optional()
  }
}, async ({ source_dir, project, pattern, create_index, overwrite }) => jsonResult(await stats.importMarkdownDir({
  sourceDir: source_dir,
  project,
  pattern,
  createIndex: create_index,
  overwrite
})));

server.registerTool('migrate_markdown_file', {
  description: 'Copy or move one external Markdown file into this MCP data root. Use for controlled document migration; move mode deletes the source only after the new indexed document is written.',
  inputSchema: {
    source_path: z.string(),
    project: z.string(),
    target_path: z.string().optional(),
    base_dir: z.string().optional(),
    mode: z.enum(['copy', 'move']).optional(),
    create_index: z.boolean().optional(),
    overwrite: z.boolean().optional(),
    semantic_type: z.string().optional(),
    title: z.string().optional(),
    brief: z.string().optional(),
    tags: z.array(z.string()).optional()
  }
}, async (input) => jsonResult(await stats.migrateMarkdownFile({
  sourcePath: input.source_path,
  project: input.project,
  targetPath: input.target_path,
  baseDir: input.base_dir,
  mode: input.mode,
  createIndex: input.create_index,
  overwrite: input.overwrite,
  semanticType: input.semantic_type,
  title: input.title,
  brief: input.brief,
  tags: input.tags
})));

server.registerTool('record_bug_report', {
  description: 'Record a bug or feedback about this MCP discovered by the AI while using it. Creates a bug_report Markdown document plus long_index so maintainers can batch review and fix later.',
  inputSchema: {
    project: z.string().optional(),
    title: z.string(),
    description: z.string(),
    severity: z.enum(['critical', 'high', 'normal', 'low']).optional(),
    component: z.string().optional(),
    steps: z.array(z.string()).optional(),
    expected: z.string().optional(),
    actual: z.string().optional(),
    workaround: z.string().optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional()
  }
}, async (input) => jsonResult(service.recordBugReport(input)));

server.registerTool('extract_memory_candidates', {
  description: 'Extract heuristic memory candidates from conversation text without writing anything. Use near session end or when reviewing what should be remembered.',
  inputSchema: {
    conversation: z.string(),
    project: z.string().optional(),
    cwd: z.string().optional()
  }
}, async ({ conversation, project, cwd }) => {
  const resolvedProject = project ?? (cwd ? detectProject(cwd) : undefined) ?? 'global';
  return jsonResult({ candidates: service.extractMemoryCandidates(conversation, resolvedProject) });
});

const candidateSchema = z.object({
  id: z.string(),
  project: z.string(),
  load_level: z.enum(['short', 'long_index']),
  semantic_type: z.string(),
  title: z.string(),
  brief: z.string().optional(),
  content: z.string(),
  tags: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  priority: z.enum(['critical', 'high', 'normal', 'low']),
  source: z.enum(['conversation', 'manual', 'hook']),
  requires_confirmation: z.boolean(),
  reason: z.string()
});

server.registerTool('commit_memory_candidates', {
  description: 'Commit extracted memory candidates. Guardrails skip high-risk candidates unless confirmed. Use after extract_memory_candidates or user confirmation.',
  inputSchema: {
    candidates: z.array(candidateSchema),
    mode: z.enum(['auto', 'all', 'confirmed_only']).optional(),
    confirmed_ids: z.array(z.string()).optional()
  }
}, async (input) => jsonResult(service.commitMemoryCandidates(input)));

server.registerTool('record_session_artifacts', {
  description: 'Record session outputs worth preserving. Documents become Markdown docs plus long memory indexes; memory candidates are committed with normal guardrails.',
  inputSchema: {
    project: z.string(),
    docs: z.array(z.object({
      path: z.string(),
      title: z.string(),
      content: z.string(),
      brief: z.string().optional(),
      tags: z.array(z.string()).optional()
    })).optional(),
    memories: z.array(candidateSchema).optional()
  }
}, async ({ project, docs, memories }) => jsonResult(service.recordSessionArtifacts(project, docs ?? [], memories ?? [])));

server.registerTool('backup_now', {
  description: 'Create a timestamped backup of SQLite database files. Use before risky bulk imports, migrations, or large memory/document edits.',
  inputSchema: {}
}, async () => jsonResult(backupNow(config.dataRoot)));

server.registerResource('loaded-global', 'memory://loaded/global', {
  title: 'Loaded global short memories',
  description: 'Global short memories that are safe to auto-load.',
  mimeType: 'application/json'
}, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(repo.listLoadedMemory().short.filter((m) => m.project === 'global'), null, 2) }]
}));

server.registerResource('usage-guide', 'guide://personal-project-knowledge/usage', {
  title: 'Personal Project Knowledge MCP usage guide',
  description: 'Default auto-loaded guide explaining when and how to prefer this MCP for memories and documents.',
  mimeType: 'text/markdown'
}, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: 'text/markdown', text: usageGuideMarkdown }]
}));

server.registerResource('storage-locations', 'storage://personal-project-knowledge/locations', {
  title: 'Personal Project Knowledge storage locations',
  description: 'Absolute and relative storage roots for manual document inspection, migration, and cleanup.',
  mimeType: 'application/json'
}, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(repo.getStorageInfo(), null, 2) }]
}));

server.registerResource('project-context', new ResourceTemplate('context://personal-project-knowledge/project/{project}', { list: undefined }), {
  title: 'Personal Project Knowledge project context',
  description: 'Default usage guide plus auto-loaded short memories and long memory indexes for a project.',
  mimeType: 'text/markdown'
}, async (uri, { project }) => {
  const resolvedProject = String(project);
  const context = service.buildContext(resolvedProject, undefined, 4000);
  return {
    contents: [{
      uri: uri.href,
      mimeType: 'text/markdown',
      text: renderContextMarkdown(resolvedProject, context, true)
    }]
  };
});

server.registerResource('loaded-project', new ResourceTemplate('memory://loaded/project/{project}', { list: undefined }), {
  title: 'Loaded project memories',
  description: 'Project short memories and long memory indexes.',
  mimeType: 'application/json'
}, async (uri, { project }) => ({
  contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(repo.listLoadedMemory(String(project)), null, 2) }]
}));

server.registerResource('projects', 'memory://projects', {
  title: 'Projects',
  description: 'Projects with memory or document records.',
  mimeType: 'application/json'
}, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ projects: repo.listProjects(), dataRoot: config.dataRoot }, null, 2) }]
}));

server.registerResource('semantic-types', 'memory://semantic-types', {
  title: 'Semantic Types',
  description: 'Configured memory/document categories and their default search/load behavior.',
  mimeType: 'application/json'
}, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ results: service.semanticTypeCatalog(repo.semanticTypeCounts()) }, null, 2) }]
}));

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`personal-project-knowledge-mcp running. dataRoot=${config.dataRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
