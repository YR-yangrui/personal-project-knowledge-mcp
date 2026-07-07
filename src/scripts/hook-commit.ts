import path from 'node:path';
import { createApp } from '../app.js';
import type { CommitCandidatesInput, MemoryCandidate } from '../types.js';
import { arg, loadSession, readJson, writeJson } from './hook-common.js';

const { config, service } = createApp();
const sessionId = arg('session');
if (!sessionId) throw new Error('Missing --session=<session_id_or_session_json_path>');

const session = loadSession(config.dataRoot, sessionId);
const pendingPath = arg('pending') ?? path.join(session.session_dir, 'pending-candidates.json');
const confirmPath = arg('confirm') ?? path.join(session.session_dir, 'confirmed-candidates.json');
const pending = readJson<{ candidates: MemoryCandidate[] }>(pendingPath);
const confirm = readJson<{ mode?: CommitCandidatesInput['mode']; confirmed_ids?: string[] }>(confirmPath);
const result = service.commitMemoryCandidates({
  candidates: pending.candidates,
  mode: confirm.mode ?? 'auto',
  confirmed_ids: confirm.confirmed_ids ?? []
});
const resultPath = path.join(session.session_dir, 'commit-result.json');
writeJson(resultPath, result);

console.log(JSON.stringify({
  session_id: session.id,
  committed: result.committed.length,
  skipped: result.skipped.length,
  result_path: resultPath
}, null, 2));
