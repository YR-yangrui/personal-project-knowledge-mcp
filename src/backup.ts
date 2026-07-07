import fs from 'node:fs';
import path from 'node:path';
import { nowIso } from './ids.js';
import { ensureDir } from './paths.js';

export interface BackupResult {
  backupDir: string;
  copiedFiles: string[];
}

export function backupNow(dataRoot: string): BackupResult {
  const stamp = nowIso().replace(/[:.]/g, '-');
  const backupDir = path.join(dataRoot, 'backups', stamp);
  ensureDir(backupDir);
  const copiedFiles: string[] = [];

  const sqliteFiles = ['memory.sqlite', 'memory.sqlite-wal', 'memory.sqlite-shm'];
  for (const file of sqliteFiles) {
    const src = path.join(dataRoot, file);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(backupDir, file);
    fs.copyFileSync(src, dest);
    copiedFiles.push(dest);
  }

  const manifest = {
    created_at: nowIso(),
    data_root: dataRoot,
    copied_files: copiedFiles.map((file) => path.relative(backupDir, file).replace(/\\/g, '/'))
  };
  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  copiedFiles.push(manifestPath);
  return { backupDir, copiedFiles };
}
