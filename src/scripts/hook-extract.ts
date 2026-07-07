import fs from 'node:fs';
import { createApp } from '../app.js';
import { detectProject } from '../project.js';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : process.env[`npm_config_${name}`];
}

const { service } = createApp();
const cwd = arg('cwd') ?? process.cwd();
const project = arg('project') ?? detectProject(cwd);
const file = arg('file');
const conversation = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');
const candidates = service.extractMemoryCandidates(conversation, project);
console.log(JSON.stringify({ project, candidates }, null, 2));
