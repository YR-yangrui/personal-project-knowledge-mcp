---
name: personal-project-knowledge-config
description: Interactive configuration-console skill for personal-project-knowledge-mcp. Use when the user wants to view, understand, or change config.yaml; tune short/long memory conversion; adjust context budgets; change dataRoot; add or modify semantic types/categories; list all available configuration features; or asks for a guided configuration program/menu for this MCP.
---

# Personal Project Knowledge Config Console

Act like a configuration program for `personal-project-knowledge-mcp`. Do not answer as a loose explanation. Always use the fixed console-style layout below so the user can see available configuration functions and choose the next action.

## Required First Response Format

When this skill is activated, the first visible response must use this structure:

```markdown
**配置中心**
- 目标：personal-project-knowledge-mcp
- 配置文件：<config path or 待确认>
- 当前状态：<已读取 / 未读取 / 需要定位 dataRoot>

**功能菜单**
| 编号 | 分类 | 可配置功能 | 关键字段 | 重启 |
|---:|---|---|---|---|
| 1 | 存储位置 | 查看/调整数据根目录 | dataRoot, PPKM_DATA_ROOT | 是 |
| 2 | 短长记忆转换 | 调整短记忆阈值、自动转长、自动转短 | memorySizing.* | 是 |
| 3 | 上下文预算 | 调整自动载入预算和相关结果数量 | budgets.* | 是 |
| 4 | 语义分类 | 新增/修改自定义分类 | semanticTypes.* | 是 |
| 5 | 客户端行为 | 说明 Skill/Plugin/Codex 接入方式 | skills, plugin, install scripts | 视情况 |
| 6 | 当前配置检查 | 读取并汇总现有配置 | config.yaml + defaults | 否 |
| 7 | 安全维护 | 备份、重启提示、迁移注意事项 | backup_now, config backup | 视情况 |

**推荐操作**
- 如果你想改配置：回复编号或直接说目标，例如“2，把短记忆阈值改成 800”。
- 如果你想新增分类：回复“4，新增 xxx 分类”。
- 如果你不确定：我会先执行“6 当前配置检查”。

**等待输入**
请选择编号或描述你要修改的配置。
```

If the user already requested a specific change, still show the menu briefly, then continue with the matching section.

## Required Follow-Up Format

For every configuration operation, use this structure:

```markdown
**配置项**
- 分类：<menu category>
- 字段：<YAML field path>
- 当前值：<current value or 未读取>
- 目标值：<desired value>

**影响说明**
- <what changes>
- <what does not change>
- <restart requirement>

**执行计划**
1. 定位 `config.yaml`。
2. 备份或保留原配置。
3. 最小化修改 YAML。
4. 提示重启 MCP/Web UI。

**结果**
- <not_started / changed / skipped / failed>
- 文件：<path>
- 下一步：<restart or further action>
```

Do not hide available options. If the user asks a broad question like “能配置什么”, output the full menu plus a short explanation for each category.

## Configuration Categories

### 1. Storage

Fields:

```yaml
dataRoot: "C:/Users/Administrator/.personal-project-knowledge-mcp"
```

Also check `PPKM_DATA_ROOT`. Changing `dataRoot` changes where future processes read/write data. It does not migrate existing data automatically.

### 2. Memory Sizing And Auto Conversion

Fields:

```yaml
memorySizing:
  shortMaxChars: 500
  longToShortMaxChars: 300
  autoDemoteOverlongShort: true
  autoPromoteShortLongIndex: true
  demoteDocumentDir: archives
```

Functions:

- Configure when a memory is considered `short`.
- Configure when overlong `short` memory becomes `document + long_index`.
- Configure when doc-less `long_index` becomes `short`.
- Configure where generated demotion documents are stored.

Rules:

- Keep `longToShortMaxChars <= shortMaxChars` unless the user explicitly wants a wide promotion window.
- `doc_index` and document-backed `long_index` should not auto-promote to `short` because the body must remain read-on-demand.
- Older `maxShortMemoryChars` is still compatible, but new edits should prefer `memorySizing.shortMaxChars`.

### 3. Context Budgets

Fields:

```yaml
budgets:
  globalShortTokens: 800
  projectShortTokens: 1200
  longIndexTokens: 2000
  relatedTopK: 5
```

Functions:

- Adjust global short-memory budget.
- Adjust project short-memory budget.
- Adjust long-index budget policy.
- Adjust related document/index TopK.

### 4. Semantic Types / Categories

Fields:

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
```

Functions:

- Add new primary categories.
- Change default load level for a category.
- Change default scope for a category.
- Configure whether a category is searchable.
- Configure whether document indexes in a category load by default.
- Configure whether the category appears in startup context and Web UI.
- Explain whether a category should be `short` or `long_index`.

Use lowercase snake_case names:

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

Allowed `default_load_level` values:

- `short`
- `long_index`

Allowed `default_scope` values:

- `global`
- `project`
- `module`
- `file`
- `user`

Adding a semantic type does not migrate existing records automatically.

### 5. Client Behavior

Explain and adjust repository-side adapter files only when requested:

- `skills/`
- `plugin/`
- `codex-plugin/`
- `scripts/install-codex.ps1`
- `scripts/sync-adapters.ps1`

Runtime `config.yaml` does not control Codex skill discovery; installing/syncing skills is a separate operation.

### 6. Current Config Check

When the user is unsure, do this first:

1. Call MCP `get_storage_info` if available, or resolve default data root.
2. Read `config.yaml`.
3. Merge mentally with defaults from `src/config.ts`.
4. Show a compact table:
   - field
   - current value
   - default value
   - recommendation

### 7. Safety Maintenance

Before risky config changes:

- Copy `config.yaml` to a timestamped backup next to the file.
- For large data-root changes, warn that data migration is separate.
- Tell the user to restart active MCP server and Web UI after config changes.

## Detailed Reference

Read `references/config-fields.md` only when exact defaults, compatibility notes, or examples are needed. Keep the main interaction in the console format above.
