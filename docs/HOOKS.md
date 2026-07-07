# Codex Hook 与默认上下文

当前实现同时提供 MCP Prompt / Resource 和 Codex SessionStart hook。

- 客户端支持 MCP prompts/resources 时，优先使用 `use_personal_project_knowledge` 或读取 `guide://personal-project-knowledge/usage`。
- Codex SessionStart hook 作为自动注入兜底，每次会话开始输出默认使用指南 + 当前项目记忆上下文。
- 文件流脚本仍保留，方便手动或半自动接入。

---

## 1. 会话开始

```powershell
npx tsx src/scripts/hook-start.ts --cwd=C:\ProjectN --query=限时订单
```

输出：

```json
{
  "session_id": "session_xxx",
  "context_path": "...\\context.md"
}
```

将 `context.md` 内容粘贴到 Codex 会话开头。

`context.md` 包含：

- `Personal Project Knowledge MCP 使用指南`：说明优先使用本 MCP 管理记忆、文档、决策、需求变动。
- `短记忆`：自动全文载入，可直接作为已知事实使用。
- `长记忆索引`：只代表存在相关资料，需要细节时调用 `read_doc`。

---

## 2. 会话结束

```powershell
Get-Content C:\RequestFiles\conversation.txt | npx tsx src/scripts/hook-end.ts --session=session_xxx
```

生成：

- `pending-candidates.json`
- `review-candidates.md`
- `confirmed-candidates.json`

---

## 3. 确认高风险候选

编辑 `confirmed-candidates.json`：

```json
{
  "mode": "auto",
  "confirmed_ids": ["cand_xxx"]
}
```

说明：

- `mode=auto`：低风险自动提交，高风险必须在 `confirmed_ids` 中。
- `mode=all`：全部提交。
- `mode=confirmed_only`：只提交确认列表中的候选。

---

## 4. 提交候选

```powershell
npx tsx src/scripts/hook-commit.ts --session=session_xxx
```

结果写入：

```text
commit-result.json
```
