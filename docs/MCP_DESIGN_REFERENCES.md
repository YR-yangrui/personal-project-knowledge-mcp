# MCP 设计参考

本项目参考 MCP 官方语义、TypeScript SDK reference server，以及 Unity MCP 的组织方式，拆成 `Instructions`、`Tools`、`Resources`、`Prompts`、`Skill/Plugin` 五类入口。

## 设计结论

- `Instructions` 是主入口：在 MCP initialize 结果中告诉客户端“这个 server 应该怎么用”。这对应 Unity MCP 的 `FastMCP(..., instructions=...)` 做法。
- `Tools` 用于动作：写记忆、改文档、导入 Markdown、备份数据库。
- `Resources` 用于可读上下文：默认使用指南、项目上下文、结构化记忆列表。
- `Prompts` 用于可选择的工作流：像 skill 一样显式载入“个人知识库管理规则 + 项目记忆”。
- `Skill/Plugin` 用于跨客户端分发：通用 `skills/` 与 `plugin/` 是主产物，`codex-plugin/` 只是 Codex adapter。

## 为什么不用 SessionStart hook

SessionStart hook 能解决部分客户端会话开始时的自动注入问题，但它不是 MCP 的通用语义。依赖 hook 会导致：

- 其他 MCP 客户端无法发现“默认使用说明”。
- 用户无法像选择 skill 一样显式调用一套工作流。
- 记忆上下文只能通过 shell 输出注入，不利于 UI/客户端资源面板展示。

因此本项目已移除自动会话注入 hook。需要文件流时，只保留手动脚本生成上下文和候选。

因此本项目同时提供：

- MCP server `instructions`
- `guide://personal-project-knowledge/usage`
- `context://personal-project-knowledge/project/{project}`
- `use_personal_project_knowledge`
- `manifest.json` 工具清单
- `skills/personal-project-knowledge` 通用 skill
- `plugin/personal-project-knowledge` 通用 plugin
- `codex-plugin/personal-project-knowledge` Codex adapter

## 与本项目记忆模型的关系

- 短记忆：自动全文载入，适合简短全局偏好和项目强规则。
- 长记忆索引：自动载入标题/摘要/路径，正文仍在文档中。
- 文档：Markdown 正文，按需搜索和读取。

这保持了“记忆 = 会自动载入”的原则，同时避免长正文污染每次会话上下文。
