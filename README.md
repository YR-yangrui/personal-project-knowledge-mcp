# personal-project-knowledge-mcp

个人本地 AI 记忆 / 文档 MCP。短记忆自动全文载入，长记忆只自动载入索引，长正文沉淀为 Markdown 文档并按需读取。

## 安装与构建

```powershell
npm install
npm run build
```

Windows 一键通用安装：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

通用安装会：

- 安装 npm 依赖。
- 构建 TypeScript。
- 初始化数据目录和 `config.yaml`。
- 不写入任何特定客户端配置。

## 数据目录

默认数据目录：

```text
%USERPROFILE%\.personal-project-knowledge-mcp
```

可用环境变量覆盖：

```powershell
$env:PPKM_DATA_ROOT='D:\AIKnowledge'
```

## 初始化种子数据

```powershell
npm run seed
npm run verify
```

## MCP 启动

```powershell
npm run build
node dist/index.js
```

## 通用 MCP 使用

任意支持 stdio MCP 的客户端都可以直接启动：

```json
{
  "mcpServers": {
    "personal-project-knowledge": {
      "command": "node",
      "args": ["E:/projects/personal-project-knowledge-mcp/dist/index.js"]
    }
  }
}
```

通用产物：

- `manifest.json`：包级 MCP plugin 清单。
- `plugin/personal-project-knowledge/manifest.json`：可移植 plugin 描述。
- `skills/personal-project-knowledge/SKILL.md`：可移植 skill，适用于支持 skill/指令包的 AI 客户端。

## Codex 适配安装

Codex 只是一个适配目标，不是主产物。一键安装/更新 Codex MCP 配置、plugin adapter 和 skill：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1
```

默认会写入：

```text
%USERPROFILE%\.codex\config.toml
```

并新增/更新：

```toml
[mcp_servers.personal-project-knowledge]
command = "node"
args = ["E:/projects/personal-project-knowledge-mcp/dist/index.js"]
startup_timeout_sec = 120
```

安装脚本会自动备份原 Codex 配置，安装后需要重启客户端。

也可以用通用安装顺便安装 Codex adapter：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -InstallCodexAdapter
```

## 卸载

只移除 Codex adapter、Codex MCP 配置、个人 plugin/skill，不删除数据：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall-codex.ps1
```

通用卸载入口默认保留数据和 Codex adapter：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall.ps1
```

通用卸载并移除 Codex adapter：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall.ps1 -RemoveCodexAdapter
```

删除记忆和文档数据需要显式确认参数，避免误删：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall.ps1 -RemoveData -Force
```

## 核心工具

- `get_usage_guide`：读取默认使用指南，说明什么时候优先使用本 MCP。
- `build_context`：构建自动载入上下文。
- `list_loaded_memory`：查看当前项目会自动载入的短记忆和长索引。
- `write_memory`：写短记忆或长记忆索引。
- `search_memory` / `get_memory`：搜索和读取记忆。
- `write_doc` / `search_docs` / `read_doc`：管理 Markdown 文档。
- `create_or_update_doc_index`：让文档生成可自动载入的长记忆索引。
- `demote_memory_to_doc`：把过长短记忆降级成文档 + 长索引。
- `extract_memory_candidates`：从对话文本启发式提取候选，不直接写入。
- `commit_memory_candidates`：提交候选，高风险类型默认需要确认。
- `record_session_artifacts`：记录会话文档并生成 long_index。
- `backup_now`：备份 SQLite 数据库文件。

## MCP Prompt / Resource

本项目按 MCP 常见语义拆分：

- `Instructions`：MCP 初始化时暴露的默认使用说明，这是主要入口，类似 Unity MCP 的 server instructions。
- `Tools`：执行增删改查、导入、备份等动作。
- `Resources`：暴露可读上下文，例如默认指南、项目记忆上下文。
- `Prompts`：提供类似 skill 的可选工作流入口。
- `Session files`：手动/半自动会话文件流，用于生成上下文和提交候选；不做自动会话注入。

当前提供：

- Server instructions：默认使用指南，客户端初始化 MCP server 时即可获取。
- Prompt `use_personal_project_knowledge`：载入默认指南 + 当前项目短记忆 + 长记忆索引，可传 `project`、`cwd`、`query`。
- Resource `guide://personal-project-knowledge/usage`：默认使用指南，说明应优先用本 MCP 管理记忆和文档。
- Resource `context://personal-project-knowledge/project/{project}`：指定项目的默认指南 + 自动载入上下文。
- Resource `memory://loaded/project/{project}`：指定项目的结构化记忆 JSON。
- `manifest.json`：工具清单，便于插件/安装器/文档生成器发现能力。
- `skills/personal-project-knowledge`：通用 skill 源。
- `codex-plugin/personal-project-knowledge`：Codex adapter，从通用 skill 同步。

## 会话文件流脚本

手动生成可注入上下文：

```powershell
npm run session:load -- --cwd=C:\ProjectN --query=限时订单
```

更完整的文件流包装：

```powershell
# 1. 生成 context.md 和 session.json
npm run session:start -- --cwd=C:\ProjectN --query=限时订单

# 2. 把输出中的 context_path 内容注入 AI 会话开头

# 3. 会话结束：从对话文本生成 pending-candidates.json 和 review-candidates.md
Get-Content C:\RequestFiles\conversation.txt | npm run session:end -- --session=<session_id>

# 4. 如需确认高风险候选，编辑 confirmed-candidates.json
# {
#   "mode": "auto",
#   "confirmed_ids": ["cand_xxx"]
# }

# 5. 提交候选
npm run session:commit -- --session=<session_id>
```

从对话文本提取候选：

```powershell
Get-Content C:\RequestFiles\conversation.txt | npm run session:extract -- --project=ProjectN
```

手动备份：

```powershell
npm run backup
```

## Web UI

启动本地管理界面：

```powershell
npm run web
```

然后打开：

```text
http://127.0.0.1:8787
```

Web UI 首版支持：

- 查看当前数据目录和项目。
- 构建自动载入上下文。
- 搜索、新增、废弃记忆。
- 搜索、读取、新增文档并创建 `long_index`。
- 查看高频统计和高频候选。
- 导入现有 Markdown 目录。
- 触发 SQLite 备份。

Web API 验证：

```powershell
npm run verify:web
```

## 重要边界

- 短记忆会自动全文载入。
- 长记忆只自动载入标题、摘要、路径，不代表正文已读。
- 文档正文必须通过 `read_doc` 按需读取。
- 超过配置长度的短记忆会被拒绝，应改写成文档 + 长索引。
- 自动会话注入 hook 已移除；客户端应通过 MCP instructions、tools/resources/prompts 或通用 skill/plugin 获取使用说明。
