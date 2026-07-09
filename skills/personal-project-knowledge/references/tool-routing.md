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

- `get_storage_info`: reveal data root, document root, memory root, backups, and import conventions.
- `write_doc`: create or replace indexed Markdown. When replacing an existing document, pass `expected_checksum` from the latest `read_doc` to avoid overwriting concurrent edits.
- `resolve_doc_path`: map a data-root-relative document path to its absolute file path and indexed state.
- `patch_doc`: targeted replacement in an indexed Markdown document. Prefer this for small updates and pass `expected_checksum`; if the document changed, reread and merge instead of retrying blindly.
- `move_doc`: move an indexed Markdown document within the data root and update related long indexes.
- `record_doc_change`: record maintenance history in the database instead of adding Markdown changelog text.
- `list_doc_changes`: query database-managed maintenance records; default returns active records only.
- `update_doc_change`: correct a maintenance record.
- `deprecate_doc_change`: mark an obsolete maintenance record as deprecated.
- `delete_doc_change`: soft-delete a maintenance record.
- `create_or_update_doc_index`: make/update the auto-loaded long index for a document.
- `promote_doc_to_long_memory`: alias for document indexing.

## Migration

- `import_markdown_dir`: bulk import existing Markdown directories into the MCP data root.
- `migrate_markdown_file`: copy or move one external Markdown file into the MCP data root.

## Candidates And Sessions

- `extract_memory_candidates`: propose memories from conversation text; does not write.
- `commit_memory_candidates`: commit approved/low-risk candidates.
- `record_session_artifacts`: store session documents and candidate memories.
- `record_bug_report`: when the AI discovers a bug or confusing behavior in this MCP, record it as a `bug_report` document plus long index for later batch fixes.

## Maintenance

- `list_projects`: discover project names in the knowledge base.
- `backup_now`: backup SQLite files before risky bulk changes.

## Guardrails

- Do not put long Markdown bodies in short memory.
- Do not answer from long index details until `read_doc` has loaded the body.
- Do not edit an existing document from stale context; call `read_doc`, pass `expected_checksum`, and reread if the MCP reports that the document changed.
- Do not append manual update logs/changelogs to Markdown bodies; use document change tools so history can be filtered, deprecated, or deleted.
- Prefer updating/deprecating old memories over writing contradictory new ones.
- If the user says "记住", write memory immediately unless it is clearly too long; then write document + long index.
- If manually adjusting files, never invent absolute paths; call `get_storage_info` or `resolve_doc_path`.
- If MCP search, migration, or path behavior fails, call `record_bug_report` with component, expected behavior, actual behavior, and workaround if known.
