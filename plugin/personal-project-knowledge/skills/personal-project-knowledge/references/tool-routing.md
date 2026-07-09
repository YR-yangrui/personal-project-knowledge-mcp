# Tool Routing Reference

## Recall

- `build_context`: build current project context; short memories are full text, long memories/docs are indexes.
- `list_loaded_memory`: inspect what auto-loads for a project.
- `search_memory`: search preferences, rules, gotchas, decisions, requirement-change indexes.
- `get_memory`: read one memory by id.
- `search_docs`: search Markdown document metadata and FTS index.
- `read_doc`: read Markdown body only after search/index says it is relevant; use the returned `record.checksum` as the optimistic-lock token for edits.

## Write Or Update Memory

- `write_memory`: write concise durable memory.
  - `semantic_type=preference`: user preference or global behavior.
  - `semantic_type=project_rule`: project-specific convention or boundary.
  - `semantic_type=gotcha`: short pitfall or recurring trap.
  - `semantic_type=decision`: use `long_index` unless very short.
  - `semantic_type=requirement_change`: usually `long_index` plus document.
- `update_memory`: patch an existing record.
- `deprecate_memory`: mark stale/superseded memory inactive.
- `demote_memory_to_doc`: move overlong memory into Markdown and keep a long index.

## Documents

- `write_doc`: create or replace indexed Markdown. When replacing an existing document, pass `expected_checksum` from the latest `read_doc` to avoid overwriting concurrent edits.
- `patch_doc`: targeted replacement in an indexed Markdown document. Prefer this for small updates and pass `expected_checksum`; if the document changed, reread and merge instead of retrying blindly.
- `create_or_update_doc_index`: make/update the auto-loaded long index for a document.
- `promote_doc_to_long_memory`: alias for document indexing.

## Candidates And Sessions

- `extract_memory_candidates`: propose memories from conversation text; does not write.
- `commit_memory_candidates`: commit approved/low-risk candidates.
- `record_session_artifacts`: store session documents and candidate memories.

## Maintenance

- `list_projects`: discover project names in the knowledge base.
- `backup_now`: backup SQLite files before risky bulk changes.

## Guardrails

- Do not put long Markdown bodies in short memory.
- Do not answer from long index details until `read_doc` has loaded the body.
- Do not edit an existing document from stale context; call `read_doc`, pass `expected_checksum`, and reread if the MCP reports that the document changed.
- Prefer updating/deprecating old memories over writing contradictory new ones.
- If the user says "记住", write memory immediately unless it is clearly too long; then write document + long index.
