# 架构说明

`personal-project-knowledge-mcp` 是一个个人本地 AI 记忆 / 文档 MCP 服务，目标是让 AI 在每次会话中自动获得必要的长期上下文，同时避免把长文档全文塞进上下文造成污染。

---

## 核心原则

- **记忆 = 会自动载入的内容**。
- **短记忆**自动全文载入。
- **长记忆索引**只自动载入标题、摘要、路径，不代表正文已读。
- **文档**默认不自动载入正文，只能通过搜索或 `read_doc` 按需读取。
- 复杂内容应沉淀为 Markdown 文档，再生成 `long_index`。
- 短/长记忆边界由 `memorySizing` 配置控制，过长短记忆可自动降级为 `document + long_index`，足够短且无关联文档的 `long_index` 可自动转回 `short`。
- 语义分类由 `semanticTypes` 配置控制；分类可以声明“默认加载”或“仅搜索”。例如 `bugfix` 默认可搜索但不加载索引。

---

## 内容层级

| 层级 | 类型 | 自动载入方式 | 用途 |
|---|---|---|---|
| Layer 1 | `short_memory` | 全文 | 偏好、gotcha、项目硬规则、短决策 |
| Layer 2 | `long_index` | 标题、摘要、路径 | 模块文档入口、长决策入口、需求变更入口 |
| Layer 3 | `document` | 不自动载入 | Markdown 正文，按需读取 |

---

## 主要模块

| 模块 | 文件 | 说明 |
|---|---|---|
| 配置 | `src/config.ts` | 数据目录、预算、语义类型默认配置 |
| 数据库 | `src/db.ts` | SQLite schema 和 FTS 初始化 |
| 仓储层 | `src/repository.ts` | 记忆、文档、FTS、Markdown 落盘 |
| 服务层 | `src/service.ts` | 构建上下文、候选提取/提交、会话产物记录 |
| 候选提取 | `src/candidates.ts` | 本地启发式候选提取 |
| 统计/导入 | `src/stats.ts` | 高频统计、候选生成、Markdown 目录导入 |
| MCP 服务 | `src/index.ts` | stdio MCP tools/resources |
| Web 服务 | `src/web.ts` | 本地 Web UI API |
| 通用 Skill | `skills/personal-project-knowledge/` | 可移植客户端路由指南 |
| 配置 Skill | `skills/personal-project-knowledge-config/` | 指导修改 config.yaml、短长转换阈值和语义分类 |
| 通用 Plugin | `plugin/personal-project-knowledge/` | 可移植插件清单 |
| Codex Adapter | `codex-plugin/personal-project-knowledge/` | Codex 专用封装，使用通用 skill |
| 会话文件流脚本 | `src/scripts/hook-*.ts` | 手动生成上下文、候选提取与候选提交 |

---

## 数据流

```text
用户 / AI
  ↓
MCP tools 或 Web API
  ↓
KnowledgeService
  ↓
KnowledgeRepository
  ├─ SQLite metadata + FTS
  └─ Markdown files
```

写入或更新 memory 时，`KnowledgeRepository` 会根据 `memorySizing` 统一判断：

- `short` 内容超过 `shortMaxChars` 且启用 `autoDemoteOverlongShort`：写入 Markdown 文档，并把 memory 保存为 `long_index`。
- `long_index` 没有 `related_doc`，且内容/摘要不超过 `longToShortMaxChars`，并启用 `autoPromoteShortLongIndex`：保存为 `short`。
- document-backed `doc_index` 不参与自动转短，避免丢失“正文需按需读取”的边界。

分类加载策略：

- `semanticTypes.<type>.auto_load_index=true` 且 `show_in_context=true`：该分类的 long_index 默认进入启动上下文。
- `auto_load_index=false`：该分类不占启动上下文，但仍可通过搜索工具和 Web UI 分类搜索返回。
- `build_context` 会返回 `semantic_type_catalog`，让 AI 启动时知道有哪些分类、哪些默认加载、哪些需要主动搜索。
- 文档索引 memory 使用原文档 `semantic_type`，`source=doc_index` 表示它是文档入口。

---

## 默认数据目录

```text
%USERPROFILE%\.personal-project-knowledge-mcp
```

可通过环境变量覆盖：

```powershell
$env:PPKM_DATA_ROOT='D:\AIKnowledge'
```
