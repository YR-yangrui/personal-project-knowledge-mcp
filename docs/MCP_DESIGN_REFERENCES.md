# MCP 设计参考

本项目参考 MCP 官方语义、TypeScript SDK reference server，以及 Unity MCP 的组织方式，拆成 `Instructions`、`Tools`、`Resources`、`Prompts`、`Hooks` 五类入口。

## 设计结论

- `Instructions` 是主入口：在 MCP initialize 结果中告诉客户端“这个 server 应该怎么用”。这对应 Unity MCP 的 `FastMCP(..., instructions=...)` 做法。
- `Tools` 用于动作：写记忆、改文档、导入 Markdown、备份数据库。
- `Resources` 用于可读上下文：默认使用指南、项目上下文、结构化记忆列表。
- `Prompts` 用于可选择的工作流：像 skill 一样显式载入“个人知识库管理规则 + 项目记忆”。
- `Hooks` 用于客户端兜底：当客户端不展示或不使用 MCP instructions/prompt/resource 时，SessionStart hook 自动注入默认上下文。

## 为什么不只做 hook

Hook 能解决 Codex 会话开始时的自动注入问题，但它不是 MCP 的通用语义。只做 hook 会导致：

- 其他 MCP 客户端无法发现“默认使用说明”。
- 用户无法像选择 skill 一样显式调用一套工作流。
- 记忆上下文只能通过 shell 输出注入，不利于 UI/客户端资源面板展示。

因此本项目同时提供：

- MCP server `instructions`
- `guide://personal-project-knowledge/usage`
- `context://personal-project-knowledge/project/{project}`
- `use_personal_project_knowledge`
- `scripts/codex-session-start.ps1`
- `manifest.json` 工具清单

## 与本项目记忆模型的关系

- 短记忆：自动全文载入，适合简短全局偏好和项目强规则。
- 长记忆索引：自动载入标题/摘要/路径，正文仍在文档中。
- 文档：Markdown 正文，按需搜索和读取。

这保持了“记忆 = 会自动载入”的原则，同时避免长正文污染每次会话上下文。
