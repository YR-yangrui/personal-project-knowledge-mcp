# API 与 MCP Tools

本文档记录 MCP tools 和 Web API 的功能对应关系。

---

## MCP Tools

### 默认指南

| Tool | 说明 |
|---|---|
| `get_usage_guide` | 读取默认使用指南，说明本 MCP 在记忆、文档、决策、需求变动管理中的优先使用规则 |
| `get_storage_info` | 暴露 dataRoot、文档目录、记忆目录、备份目录和默认导入路径，供 AI 和人工整理使用 |

### 记忆

| Tool | 说明 |
|---|---|
| `build_context` | 构建自动载入上下文 |
| `list_loaded_memory` | 查看指定项目会自动载入的短记忆和长索引 |
| `search_memory` | 搜索记忆 |
| `get_memory` | 读取单条记忆 |
| `write_memory` | 写入短记忆或长记忆索引 |
| `update_memory` | 修改记忆 |
| `deprecate_memory` | 软废弃记忆 |
| `list_projects` | 列出项目 |

### 文档

| Tool | 说明 |
|---|---|
| `search_docs` | 搜索文档索引 |
| `read_doc` | 按路径读取 Markdown 正文，并返回相对路径和绝对路径 |
| `write_doc` | 写入并索引 Markdown 文档 |
| `resolve_doc_path` | 把 dataRoot 相对路径解析成绝对路径，并返回是否存在/是否已索引 |
| `patch_doc` | 替换文档中的文本 |
| `move_doc` | 在 dataRoot 内移动已索引文档，并同步文档索引和关联长记忆路径 |
| `create_or_update_doc_index` | 为文档创建或更新 `long_index` |
| `promote_doc_to_long_memory` | `create_or_update_doc_index` 的别名 |
| `demote_memory_to_doc` | 把过长记忆降级为文档 + 长索引 |
| `import_markdown_dir` | 批量导入外部 Markdown 目录到 dataRoot |
| `migrate_markdown_file` | 迁移单个外部 Markdown 文件到 dataRoot，支持 copy/move |

### 候选与会话

| Tool | 说明 |
|---|---|
| `extract_memory_candidates` | 从对话文本提取候选，不写入 |
| `commit_memory_candidates` | 提交候选，高风险默认需确认 |
| `record_session_artifacts` | 记录会话文档并生成长索引 |
| `record_bug_report` | AI 使用 MCP 过程中发现 MCP 自身 bug/不清晰行为时，记录为 `bug_report` 文档并生成长索引 |

### 维护

| Tool | 说明 |
|---|---|
| `backup_now` | 备份 SQLite 数据库文件 |

---

## MCP Prompts

| Prompt | 说明 |
|---|---|
| `use_personal_project_knowledge` | 输出默认使用指南 + 项目自动载入上下文，适合像 skill 一样显式启动本 MCP |

参数：

| 参数 | 说明 |
|---|---|
| `project` | 项目名，可选 |
| `cwd` | 当前工作目录，用于推断项目名，可选 |
| `query` | 当前主题，用于补充相关文档和长记忆索引，可选 |

---

## MCP Resources

| Resource | 说明 |
|---|---|
| `guide://personal-project-knowledge/usage` | 默认使用指南，Markdown |
| `storage://personal-project-knowledge/locations` | dataRoot、文档目录、记忆目录、备份目录和路径规则，JSON |
| `context://personal-project-knowledge/project/{project}` | 默认指南 + 指定项目短记忆全文 + 长记忆索引，Markdown |
| `memory://loaded/global` | 全局短记忆 JSON |
| `memory://loaded/project/{project}` | 指定项目短记忆和长记忆索引 JSON |
| `memory://projects` | 已有记忆或文档的项目列表 |

---

## Web API

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/storage` | 存储位置和路径规则 |
| `GET` | `/api/projects` | 项目列表 |
| `GET` | `/api/context` | 构建上下文 |
| `GET` | `/api/memories` | 搜索记忆 |
| `POST` | `/api/memories` | 新增记忆 |
| `PATCH` | `/api/memories/:id` | 修改记忆 |
| `POST` | `/api/memories/:id/deprecate` | 废弃记忆 |
| `GET` | `/api/docs` | 搜索文档 |
| `GET` | `/api/docs/read` | 读取文档正文 |
| `GET` | `/api/docs/resolve` | 解析文档绝对路径和索引状态 |
| `POST` | `/api/docs` | 新增文档 |
| `POST` | `/api/docs/move` | 移动已入库文档并同步关联索引 |
| `POST` | `/api/docs/index` | 创建文档长索引 |
| `GET` | `/api/stats/terms` | 高频词统计 |
| `GET` | `/api/stats/candidates` | 高频主题候选 |
| `POST` | `/api/import/markdown` | 导入 Markdown 目录 |
| `POST` | `/api/migrate/markdown-file` | 迁移单个 Markdown 文件 |
| `POST` | `/api/bug-reports` | 记录 MCP bug/反馈 |
| `POST` | `/api/candidates/extract` | 提取候选 |
| `POST` | `/api/candidates/commit` | 提交候选 |
| `POST` | `/api/backup` | 备份数据库 |
