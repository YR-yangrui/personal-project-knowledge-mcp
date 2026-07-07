import fs from 'node:fs';
import path from 'node:path';
import type { LoadLevel } from './types.js';

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function safeSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'untitled';
}

export function slugify(value: string): string {
  return safeSegment(value.toLowerCase()).replace(/^-+|-+$/g, '');
}

export function memoryMarkdownPath(dataRoot: string, project: string, loadLevel: LoadLevel, id: string, title: string): string {
  const scope = project === 'global' ? path.join('memories', 'global') : path.join('memories', 'projects', safeSegment(project));
  const levelDir = loadLevel === 'short' ? 'short' : 'long-index';
  return path.join(dataRoot, scope, levelDir, `${id}-${slugify(title)}.md`);
}

export function resolveDataPath(dataRoot: string, inputPath: string): string {
  const resolved = path.resolve(dataRoot, inputPath);
  const root = path.resolve(dataRoot);
  // 防止 MCP 调用者用 ../ 把文档写出个人知识库根目录。
  if (!resolved.startsWith(root)) {
    throw new Error(`Path escapes data root: ${inputPath}`);
  }
  return resolved;
}

export function toRelativeDataPath(dataRoot: string, absolutePath: string): string {
  return path.relative(dataRoot, absolutePath).replace(/\\/g, '/');
}
