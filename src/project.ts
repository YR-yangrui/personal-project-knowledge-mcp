import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export function detectProject(cwd = process.cwd()): string {
  const configProject = findProjectConfig(cwd);
  if (configProject) return configProject;
  const gitRoot = findUp(cwd, '.git');
  if (gitRoot) return path.basename(path.dirname(gitRoot));
  return path.basename(cwd);
}

function findProjectConfig(cwd: string): string | undefined {
  let dir = path.resolve(cwd);
  while (true) {
    const configPath = path.join(dir, '.personal-memory.yaml');
    if (fs.existsSync(configPath)) {
      const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8')) ?? {};
      if (typeof parsed.project === 'string' && parsed.project.trim()) return parsed.project.trim();
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function findUp(cwd: string, name: string): string | undefined {
  let dir = path.resolve(cwd);
  while (true) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
