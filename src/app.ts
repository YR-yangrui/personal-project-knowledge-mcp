import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { KnowledgeRepository } from './repository.js';
import { KnowledgeService } from './service.js';
import { StatsService } from './stats.js';

export function createApp() {
  const config = loadConfig();
  const db = openDatabase(config.dataRoot);
  const repo = new KnowledgeRepository(db, config);
  const service = new KnowledgeService(repo, config);
  const stats = new StatsService(repo);
  return { config, db, repo, service, stats };
}
