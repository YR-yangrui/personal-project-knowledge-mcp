# Config Fields Reference

## File Location

Default config path:

```text
%USERPROFILE%\.personal-project-knowledge-mcp\config.yaml
```

If `PPKM_DATA_ROOT` is set, the config path is:

```text
<PPKM_DATA_ROOT>\config.yaml
```

Use `get_storage_info` to confirm the active `data_root` and `config_path` before editing.

## Storage

```yaml
dataRoot: "C:/Users/Administrator/.personal-project-knowledge-mcp"
```

Changing `dataRoot` moves where future runs read/write data. It does not automatically migrate existing SQLite or Markdown files.

## Memory Sizing

```yaml
memorySizing:
  shortMaxChars: 500
  longToShortMaxChars: 300
  autoDemoteOverlongShort: true
  autoPromoteShortLongIndex: true
  demoteDocumentDir: archives
```

Fields:

- `shortMaxChars`: maximum content length for `short` memory.
- `longToShortMaxChars`: maximum content/brief length for auto-converting a doc-less `long_index` into `short`.
- `autoDemoteOverlongShort`: when true, overlong short memories become a Markdown document plus long index instead of failing.
- `autoPromoteShortLongIndex`: when true, short doc-less long indexes become short memories.
- `demoteDocumentDir`: project document subdirectory for generated demotion documents, usually `archives`.

Compatibility:

```yaml
maxShortMemoryChars: 500
```

Older configs may still use `maxShortMemoryChars`. New edits should prefer `memorySizing.shortMaxChars`; the loader keeps both compatible.

## Context Budgets

```yaml
budgets:
  globalShortTokens: 800
  projectShortTokens: 1200
  longIndexTokens: 2000
  relatedTopK: 5
```

Current implementation uses the explicit `budget_tokens` passed to `build_context` to trim short memories roughly by character count, and uses TopK defaults in query-related search paths. Keep these values as policy defaults even if not every budget is enforced with exact tokenization yet.

## Semantic Types

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

Custom example:

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

Notes:

- Semantic types are strings in storage and tool schemas, so config can extend them without a database migration.
- The config provides defaults and guidance; callers can still pass explicit `semantic_type`, `load_level`, and `scope`.
- Prefer tags for cross-cutting labels and `semantic_type` for the primary category.
- `searchable=false` hides a category from normal search guidance, but existing records are still in storage.
- `auto_load_index=false` prevents long indexes in that category from entering startup context.
- `show_in_context=false` keeps the category out of startup category guidance if a client chooses to filter it.
- `show_in_webui=false` hides the category from the Web UI category navigation.

## Restart Guidance

After editing config, restart any running MCP server and Web UI process. Existing processes keep the configuration loaded at startup.
