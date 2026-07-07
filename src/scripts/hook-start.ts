import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../app.js';
import { detectProject } from '../project.js';
import { renderContextMarkdown } from '../context-markdown.js';
import { arg, createSession, writeJson } from './hook-common.js';

const { config, service } = createApp();
const cwd = arg('cwd') ?? process.cwd();
const query = arg('query') ?? '';
const project = arg('project') ?? detectProject(cwd);
const session = createSession(config.dataRoot, project, cwd, query);
const context = service.buildContext(project, query, 4000) as any;

const markdown = renderContextMarkdown(project, context, true);

const contextPath = path.join(session.session_dir, 'context.md');
const contextJsonPath = path.join(session.session_dir, 'context.json');
fs.writeFileSync(contextPath, markdown, 'utf8');
writeJson(contextJsonPath, context);

console.log(JSON.stringify({
  session_id: session.id,
  project,
  session_dir: session.session_dir,
  context_path: contextPath,
  context_json_path: contextJsonPath,
  instruction: `把 ${contextPath} 的内容注入 AI 会话开头，或作为 MCP 客户端的会话前置上下文。`
}, null, 2));
