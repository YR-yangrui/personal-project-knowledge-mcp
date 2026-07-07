import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../app.js';
import { arg, loadSession, writeJson } from './hook-common.js';

const { config, service } = createApp();
const sessionId = arg('session');
if (!sessionId) throw new Error('Missing --session=<session_id_or_session_json_path>');

const session = loadSession(config.dataRoot, sessionId);
const file = arg('file');
const conversation = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');
const candidates = service.extractMemoryCandidates(conversation, session.project);
const pendingPath = path.join(session.session_dir, 'pending-candidates.json');
const reviewPath = path.join(session.session_dir, 'review-candidates.md');

writeJson(pendingPath, { session, candidates });
const review = [
  `# 候选记忆确认：${session.project}`,
  '',
  `Session：${session.id}`,
  '',
  '将需要提交的候选 ID 填入 `confirmed-candidates.json` 的 `confirmed_ids`。',
  '低风险候选可以用 hook-commit 的默认 auto 模式自动提交；高风险候选需要确认。',
  '',
  ...candidates.map((candidate) => [
    `## ${candidate.title}`,
    '',
    `- id：${candidate.id}`,
    `- type：${candidate.semantic_type}`,
    `- load：${candidate.load_level}`,
    `- project：${candidate.project}`,
    `- requires_confirmation：${candidate.requires_confirmation}`,
    `- reason：${candidate.reason}`,
    '',
    candidate.content,
    ''
  ].join('\n'))
].join('\n');
fs.writeFileSync(reviewPath, review, 'utf8');

const confirmPath = path.join(session.session_dir, 'confirmed-candidates.json');
if (!fs.existsSync(confirmPath)) {
  writeJson(confirmPath, { mode: 'auto', confirmed_ids: [] });
}

console.log(JSON.stringify({
  session_id: session.id,
  candidates: candidates.length,
  pending_path: pendingPath,
  review_path: reviewPath,
  confirm_path: confirmPath
}, null, 2));
