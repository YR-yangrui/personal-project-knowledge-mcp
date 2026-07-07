# Markdown 导入与迁移

MCP Tools、Web API 和 Web UI 均支持导入已有 Markdown 目录，也支持迁移单个 Markdown 文件。

---

## Web UI 导入

启动 Web UI：

```powershell
npm run web
```

在“导入 Markdown 目录”中填写：

- 目录：例如 `C:\claude\ProjectN\docs`
- pattern：默认 `**/*.md`
- 是否覆盖同路径
- 是否创建 `long_index`

---

## API 导入

```http
POST /api/import/markdown
```

请求体：

```json
{
  "project": "ProjectN",
  "sourceDir": "C:\\claude\\ProjectN\\docs",
  "pattern": "**/*.md",
  "createIndex": true,
  "overwrite": true
}
```

## MCP 导入/迁移

批量导入目录：

```json
{
  "tool": "import_markdown_dir",
  "arguments": {
    "project": "ProjectN",
    "source_dir": "C:\\claude\\ProjectN\\docs",
    "pattern": "**/*.md",
    "create_index": true,
    "overwrite": true
  }
}
```

迁移单个文件：

```json
{
  "tool": "migrate_markdown_file",
  "arguments": {
    "project": "ProjectN",
    "source_path": "C:\\RequestFiles\\legacy-note.md",
    "target_path": "docs/projects/ProjectN/imports/legacy-note.md",
    "mode": "copy",
    "create_index": true,
    "overwrite": true
  }
}
```

`mode=move` 会在目标文档写入、索引创建成功后删除源文件；失败时保留源文件。

---

## 导入规则

- 导入后的文档写入：

```text
docs/projects/<ProjectName>/imports/<原相对路径>
```

- 如果 Markdown frontmatter 中存在 `title`、`brief`、`tags`、`semantic_type`，会优先使用。
- 没有 `title` 时使用第一个一级标题。
- 没有一级标题时使用文件名。
- `createIndex=true` 时会自动创建可自动载入的 `long_index`。
- 文档 frontmatter 会写入 `path`，方便人工打开文件时识别 dataRoot 相对路径。

## 存储位置与手动整理

先调用 `get_storage_info` 或读取 `storage://personal-project-knowledge/locations` 查看：

- `data_root`：知识库根目录。
- `documents_root`：Markdown 文档根目录。
- `memories_root`：记忆 Markdown 镜像目录。
- `default_imports_root`：默认导入目录。

手动整理已入库文档时，不建议直接移动文件。请使用：

- `resolve_doc_path`：查看文档绝对位置和索引状态。
- `move_doc`：在 dataRoot 内移动文档，同时更新数据库索引和相关 `long_index.related_doc`。
