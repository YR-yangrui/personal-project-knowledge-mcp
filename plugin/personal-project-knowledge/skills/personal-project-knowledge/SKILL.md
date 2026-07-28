---
name: personal-project-knowledge
description: Use only when the user explicitly wants to remember, forget, or recall prior knowledge; manage knowledge-base Markdown; record decisions or requirement changes; import/review memory artifacts; or explicitly use the personal-project-knowledge MCP. Do not trigger for ordinary project work merely because it may benefit from project context.
---

# Personal Project Knowledge

Use the `personal-project-knowledge` MCP as the primary system for explicit personal-memory and knowledge-base operations. Treat the MCP server instructions as authoritative; this skill only routes tasks that pass the activation gate below.

## Activation Gate

Activate this skill when the user explicitly asks to:

- remember, update, forget, or recall a preference, rule, decision, gotcha, or prior result
- search, read, create, patch, move, or import knowledge-base Markdown
- preserve decisions, requirement changes, investigation notes, or session artifacts
- review memory candidates or directly use this MCP

Do not activate this skill merely because:

- the request concerns a project or is running inside a project directory
- stored context might be generally useful
- the task is code reading, implementation, debugging, review, testing, planning, or explanation
- project memories were already injected at session start

Do not call `build_context` as a generic preflight step. If relevant memories are already present in the conversation, use them directly. Call MCP tools only when the requested knowledge operation needs them.

## Storage Rule

Prefer the MCP over ad-hoc files whenever the task is about:

- remembering or updating user preferences, project rules, gotchas, conventions
- searching, reading, writing, or patching personal/project Markdown documents
- recording decisions, requirement changes, investigation notes, or session artifacts
- importing existing Markdown documents into the knowledge base
- extracting or committing memory candidates from a conversation

Do not use this MCP for code symbol discovery unless the user is asking about stored docs/memory. Use the current project's code-discovery tools for code navigation.

## First Install Routing

When the user has just installed, enabled, connected, or initialized this MCP for the first time, do not start by writing memories. First invoke or switch to the `personal-project-knowledge-config` skill and guide the user through configuration. The config flow should help the user confirm:

- data root and `PPKM_DATA_ROOT`
- short/long memory conversion thresholds
- startup context budgets and related-result counts
- custom semantic types/categories

If the user is unsure, recommend the config skill's "current configuration check" first.

## Workflow

1. Identify the explicit knowledge intent; stop if the activation gate is not met.
2. For broad recall of stored project knowledge, call `build_context`. For a specific fact or document, prefer targeted `search_memory` or `search_docs`, then read only the matching record.
3. Before writing a memory, search for an existing equivalent record; update it instead of creating a duplicate.
4. For short durable facts, call `write_memory` with `load_level="short"`.
5. For long content, call `write_doc`, then `create_or_update_doc_index`.
6. Before modifying an existing document, call `read_doc` and pass its current `checksum` as `expected_checksum` to `patch_doc` or `write_doc`; if the checksum changed, reread and merge.
7. Do not maintain "Update Log" / "Changelog" sections inside Markdown bodies; use document-change tools.
8. For stale facts, call `update_memory` or `deprecate_memory`; do not leave contradictory active memories.
9. For session outputs the user wants preserved, call `record_session_artifacts`.
10. Before manual document cleanup or migration, call `get_storage_info`; use `resolve_doc_path` and `move_doc` for controlled moves inside the data root.
11. If you discover a bug in this MCP while actively using it, call `record_bug_report`.

## Memory Boundaries

- Short memory: auto-loaded full text; use for concise preferences, rules, gotchas, and high-priority facts.
- Long memory index: auto-loaded title/brief/path only; use for decisions, requirement changes, and long notes.
- Document: Markdown body; search first, read with `read_doc` only when details are needed. Treat documents as time-sensitive and use `expected_checksum` when updating them.
- Document change record: database-managed maintenance history; query only when needed so it does not pollute Markdown bodies or startup context.

## Tool Reference

For exact tool routing, read `references/tool-routing.md` when the task involves more than one memory/document operation.
