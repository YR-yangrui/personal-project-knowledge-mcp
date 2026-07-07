# Markdown 导入

Web API 和 Web UI 均支持导入已有 Markdown 目录。

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

