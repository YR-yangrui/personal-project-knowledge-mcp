# Configuration Guide

`personal-project-knowledge-mcp` reads runtime configuration from `config.yaml` in the active data root.

Default path:

```text
%USERPROFILE%\.personal-project-knowledge-mcp\config.yaml
```

If `PPKM_DATA_ROOT` is set, `config.yaml` is read from that directory.

## Memory Sizing

Use `memorySizing` to control automatic conversion between short memories and long memory indexes.

```yaml
memorySizing:
  shortMaxChars: 500
  longToShortMaxChars: 300
  autoDemoteOverlongShort: true
  autoPromoteShortLongIndex: true
  demoteDocumentDir: archives
```

- `shortMaxChars`: maximum full-text content length for `short` memories.
- `longToShortMaxChars`: maximum content/brief length for converting a doc-less `long_index` to `short`.
- `autoDemoteOverlongShort`: when true, an overlong short memory becomes a Markdown document plus `long_index` instead of failing.
- `autoPromoteShortLongIndex`: when true, a doc-less `long_index` with short content/brief becomes a `short` memory.
- `demoteDocumentDir`: document subdirectory used for generated demotion documents.

`maxShortMemoryChars` remains supported for older configs, but new edits should prefer `memorySizing.shortMaxChars`.

## Context Budgets

```yaml
budgets:
  globalShortTokens: 800
  projectShortTokens: 1200
  longIndexTokens: 2000
  relatedTopK: 5
```

These fields describe context-loading policy defaults. `build_context` can also receive an explicit `budget_tokens` value.

## Semantic Types

Semantic types are configurable strings used as primary categories.

```yaml
semanticTypes:
  preference:
    default_load_level: short
    default_scope: global
    description: 个人偏好和稳定行为约束。
    searchable: true
    auto_load_index: true
    show_in_context: true
    show_in_webui: true
  gotcha:
    default_load_level: short
    default_scope: global
  project_rule:
    default_load_level: short
    default_scope: project
  decision:
    default_load_level: long_index
    default_scope: project
  requirement_change:
    default_load_level: long_index
    default_scope: project
  doc_index:
    default_load_level: long_index
    default_scope: project
  snippet:
    default_load_level: short
    default_scope: global
    description: 短片段或可复用片段。
    searchable: true
    auto_load_index: true
    show_in_context: true
    show_in_webui: true
```

Custom category example:

```yaml
semanticTypes:
  bugfix:
    default_load_level: long_index
    default_scope: project
    description: Bug 修复记录；默认仅搜索，不占启动上下文。
    searchable: true
    auto_load_index: false
    show_in_context: false
    show_in_webui: true
  unity_prefab_note:
    default_load_level: long_index
    default_scope: project
    description: Unity Prefab 分析记录。
    searchable: true
    auto_load_index: false
    show_in_context: false
    show_in_webui: true
  powershell_gotcha:
    default_load_level: short
    default_scope: global
    description: PowerShell 踩坑短记忆。
    searchable: true
    auto_load_index: true
    show_in_context: true
    show_in_webui: true
```

Use `semantic_type` for the main category and `tags` for cross-cutting labels.

`bugfix` and similar categories should normally use `searchable: true` with `auto_load_index: false`, so records are preserved and searchable without occupying startup context.

## Skill Support

Use the `personal-project-knowledge-config` skill when asking an AI assistant to change configuration. The skill guides changes by category:

1. Storage paths.
2. Memory sizing and automatic short/long conversion.
3. Context budgets.
4. Semantic types and custom categories.
5. Client/plugin behavior.

Restart active MCP or Web UI processes after changing `config.yaml`, because configuration is loaded at process startup.
