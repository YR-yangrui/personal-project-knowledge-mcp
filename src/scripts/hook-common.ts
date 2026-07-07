import fs from 'node:fs';
import path from 'node:path';
import { createId, nowIso } from '../ids.js';
import { ensureDir } from '../paths.js';

export interface HookSession {
  id: string;
  project: string;
  cwd: string;
  query?: string;
  created_at: string;
  session_dir: string;
}

export function sessionsRoot(dataRoot: string): string {
  return path.join(dataRoot, 'hook-sessions');
}

export function createSession(dataRoot: string, project: string, cwd: string, query?: string): HookSession {
  const id = createId('session');
  const sessionDir = path.join(sessionsRoot(dataRoot), id);
  ensureDir(sessionDir);
  const session: HookSession = {
    id,
    project,
    cwd,
    query,
    created_at: nowIso(),
    session_dir: sessionDir
  };
  writeJson(path.join(sessionDir, 'session.json'), session);
  return session;
}

export function loadSession(dataRoot: string, idOrPath: string): HookSession {
  const sessionPath = fs.existsSync(idOrPath)
    ? idOrPath
    : path.join(sessionsRoot(dataRoot), idOrPath, 'session.json');
  return JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as HookSession;
}

export function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : process.env[`npm_config_${name}`];
}
