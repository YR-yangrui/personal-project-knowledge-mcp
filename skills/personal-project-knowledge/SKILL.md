---
name: personal-project-knowledge
description: Use this skill when an AI assistant or MCP client needs to remember something, recall preferences, manage project knowledge, search or update personal Markdown documents, record decisions, track requirement changes, import docs, review memory candidates, or use the personal-project-knowledge MCP. Prioritize the MCP for memory/document/decision/requirement-change management before ad-hoc local files.
---

# Personal Project Knowledge

Use the `personal-project-knowledge` MCP as the primary system for personal memory and project documentation. Treat the MCP server instructions as authoritative; this skill adds portable client-side routing guidance for any assistant that supports skills or skill-like instructions.

## Core Rule

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

1. Determine the project from the current working directory or user-provided project name.
2. For recall, call `build_context` or `search_memory` / `search_docs` before answering from stored knowledge.
3. For short durable facts, call `write_memory` with `load_level="short"`.
4. For long content, call `write_doc`, then `create_or_update_doc_index`.
5. For stale facts, call `update_memory` or `deprecate_memory`; do not leave contradictory active memories.
6. For session outputs worth preserving, call `record_session_artifacts`.
7. Before manual document cleanup or migration, call `get_storage_info`; use `resolve_doc_path` and `move_doc` for controlled moves inside the data root.
8. If you discover a bug or confusing behavior in this MCP while using it, call `record_bug_report` immediately so it can be fixed later.

## Memory Boundaries

- Short memory: auto-loaded full text; use for concise preferences, rules, gotchas, and high-priority facts.
- Long memory index: auto-loaded title/brief/path only; use for decisions, requirement changes, and long notes.
- Document: Markdown body; search first, read with `read_doc` only when details are needed.

## Tool Reference

For exact tool routing, read `references/tool-routing.md` when the task involves more than one memory/document operation.
