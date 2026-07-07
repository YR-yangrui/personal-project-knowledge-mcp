# 架构说明

`personal-project-knowledge-mcp` 是一个个人本地 AI 记忆 / 文档 MCP 服务，目标是让 AI 在每次会话中自动获得必要的长期上下文，同时避免把长文档全文塞进上下文造成污染。

---

## 核心原则

- **记忆 = 会自动载入的内容**。
- **短记忆**自动全文载入。
- **长记忆索引**只自动载入标题、摘要、路径，不代表正文已读。
- **文档**默认不自动载入正文，只能通过搜索或 `read_doc` 按需读取。
- 复杂内容应沉淀为 Markdown 文档，再生成 `long_index`。

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

---

## 默认数据目录

```text
%USERPROFILE%\.personal-project-knowledge-mcp
```

可通过环境变量覆盖：

```powershell
$env:PPKM_DATA_ROOT='D:\AIKnowledge'
```
