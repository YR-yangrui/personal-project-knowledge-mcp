# 会话文件流

正式入口是 MCP `instructions`、tools/resources/prompts，以及通用 `skills/` / `plugin/`。本文件记录的脚本只用于手动或半自动文件流，不做自动 SessionStart 注入。

---

## 1. 生成上下文

```powershell
npm run session:start -- --cwd=C:\ProjectN --query=限时订单
```

输出：

```json
{
  "session_id": "session_xxx",
  "context_path": "...\\context.md"
}
```

将 `context.md` 内容注入 AI 会话开头，或作为客户端的额外上下文。

`context.md` 包含：

- `Personal Project Knowledge MCP 使用指南`
- `短记忆`：自动全文载入，可直接作为已知事实使用。
- `长记忆索引`：只代表存在相关资料，需要细节时调用 `read_doc`。

---

## 2. 会话结束提取候选

```powershell
Get-Content C:\RequestFiles\conversation.txt | npm run session:end -- --session=session_xxx
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
npm run session:commit -- --session=session_xxx
```

结果写入：

```text
commit-result.json
```
