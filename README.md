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
- 提示安装者为目标 AI 客户端添加会话启动 hook，以便自动注入记忆上下文。

如果你是让 AI 代为安装，安装完成后请直接要求 AI 继续完成 hook 接入：

```text
请为当前 AI 客户端添加 personal-project-knowledge-mcp 的会话启动 hook，让新会话自动注入 build_context 生成的短记忆和长记忆索引。
```

对于 Codex，推荐直接使用 `scripts/install-codex.ps1` 或通用安装参数 `-InstallCodexAdapter`，它会默认写入 `SessionStart` hook。其他客户端需要按各自 hook / startup context 机制接入；若客户端没有 hook 能力，则需要在会话开始时主动调用 `build_context` 或读取 `context://personal-project-knowledge/project/{project}`。

## 数据目录

默认数据目录：

```text
%USERPROFILE%\.personal-project-knowledge-mcp
```

可用环境变量覆盖：

```powershell
$env:PPKM_DATA_ROOT='D:\AIKnowledge'
```

## 配置与短长记忆自动转换

运行配置文件位于：

```text
%USERPROFILE%\.personal-project-knowledge-mcp\config.yaml
```

新配置优先使用 `memorySizing` 控制短记忆和长记忆索引的自动转换：

```yaml
memorySizing:
  shortMaxChars: 500
  longToShortMaxChars: 300
  autoDemoteOverlongShort: true
  autoPromoteShortLongIndex: true
  demoteDocumentDir: archives
```

- `shortMaxChars`：短记忆最大正文长度。
- `autoDemoteOverlongShort`：短记忆过长时自动写成 Markdown 文档，并把 memory 改为 `long_index`。
- `longToShortMaxChars`：无关联文档的 `long_index` 内容足够短时，可自动转回 `short`。
- `autoPromoteShortLongIndex`：启用无文档长索引转短记忆。
- `demoteDocumentDir`：自动降级生成文档的目录。

旧配置中的 `maxShortMemoryChars` 仍兼容；新修改建议使用 `memorySizing.shortMaxChars`。

需要调整配置或新增语义分类时，可使用 skill `personal-project-knowledge-config`。它会按存储、短长阈值、上下文预算、语义类型等分类逐步引导修改。

语义分类支持配置搜索与默认加载策略。像 `bugfix` 这类记录推荐保存为文档并允许搜索，但默认不加载索引：

```yaml
semanticTypes:
  bugfix:
    default_load_level: long_index
    default_scope: project
    description: "Bug 修复记录；默认仅搜索，不占启动上下文。"
    searchable: true
    auto_load_index: false
    show_in_context: false
    show_in_webui: true
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

通用 MCP 配置只负责启动 server，不保证记忆会自动进入会话上下文。要实现“新会话一开始就看到记忆”，目标客户端还需要额外配置会话启动注入：

- 优先：添加 session-start / startup hook，运行本项目的上下文加载脚本或调用 `build_context`。
- Codex：运行 `scripts/install-codex.ps1`，默认安装 `SessionStart` hook。
- 其他客户端：让安装 AI 根据客户端能力，把 `build_context` 结果作为会话前置上下文；如果无法配置 hook，就在每次会话开始主动调用 `build_context`。

通用产物：

- `manifest.json`：包级 MCP plugin 清单。
- `plugin/personal-project-knowledge/manifest.json`：可移植 plugin 描述。
- `skills/personal-project-knowledge/SKILL.md`：可移植 skill，适用于支持 skill/指令包的 AI 客户端。
- `skills/personal-project-knowledge-config/SKILL.md`：配置管理 skill，指导修改 `config.yaml`、短长转换阈值和自定义语义分类。

首次安装或刚接入 MCP 后，建议直接对 AI 说：

```text
我刚首次安装 personal-project-knowledge-mcp，请调用 personal-project-knowledge-config skill 带我完成配置。
```

AI 应先使用配置 Skill 展示配置菜单，确认 dataRoot、短长记忆阈值、上下文预算和语义分类后，再进入日常记忆/文档使用。

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

默认还会安装 `SessionStart` hook：

```toml
[[hooks.SessionStart]]
matcher = "startup|resume|clear|compact"

[[hooks.SessionStart.hooks]]
type = "command"
command = 'powershell -NoProfile -ExecutionPolicy Bypass -File "E:/Projects/personal-project-knowledge-mcp/scripts/codex-session-start.ps1" -Mode "inline"'
```

这个 hook 会运行 `scripts/codex-session-start.ps1`，在会话启动、恢复、清空或压缩后加载当前项目的短记忆和长记忆索引。Codex command hook 目前主要通过 stdout 把内容交给会话，因此 stdout 既是“注入上下文”的通道，也是终端可能看到的输出通道。

### SessionStart 输出模式

安装脚本通过 `-SessionStartOutputMode` 控制 hook 输出模式：

| 模式 | 终端输出 | 会话效果 | 适用场景 |
|---|---|---|---|
| `inline` | 输出完整 Markdown 上下文 | Codex 启动时可直接看到完整短记忆和长记忆索引 | 默认模式；最强自动注入，但终端会显示记忆内容 |
| `file` | 只输出很短的上下文文件路径提示 | 完整上下文写入 session artifact；需要细节时读取提示里的文件 | 推荐降噪模式；避免终端刷屏，同时保留上下文入口 |
| `silent` | 不输出 | 只生成 session artifact；不会通过 stdout 自动注入全文 | 只想保留产物、不需要启动注入时使用 |

默认安装等价于：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1 -SessionStartOutputMode inline
```

如果希望降低启动时的终端输出，推荐切到 `file`：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1 -SessionStartOutputMode file
```

如果想完全静默：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1 -SessionStartOutputMode silent
```

注意：`silent` 不会把记忆全文自动注入当前会话。若目标是“终端不刷整段记忆，但仍能让 AI 找到上下文”，优先使用 `file`。

### 切换、禁用和临时覆盖

已经安装过 Codex adapter 时，可以重复运行 `install-codex.ps1` 切换模式。脚本会先备份 `%USERPROFILE%\.codex\config.toml`，再替换本项目管理的 MCP 配置和 hook 块。

切回完整自动注入：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1 -SessionStartOutputMode inline
```

改成降噪文件指针：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1 -SessionStartOutputMode file
```

改成完全静默：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1 -SessionStartOutputMode silent
```

若只想安装 MCP/Skill 而不自动注入记忆，可使用：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1 -SkipSessionStartHook
```

若只想临时覆盖某次 hook 运行的模式，可以在启动 Codex 前设置环境变量：

```powershell
$env:PPKM_CODEX_SESSION_START_MODE = "file"
codex
```

环境变量只接受 `inline`、`file`、`silent`；非法值会被忽略，继续使用 hook 命令里的 `-Mode`。

### 直接运行 hook 脚本

排查或手动生成上下文时，可以直接运行 hook 脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-session-start.ps1 -Mode file
```

可选参数：

| 参数 | 说明 |
|---|---|
| `-Cwd` | 指定项目目录；不传时优先读取 Codex hook payload 中的 cwd，最后回退到当前工作目录 |
| `-Project` | 指定知识库项目名；不传时按 cwd 自动识别 |
| `-Query` | 传给上下文构建逻辑的查询词，用于带问题加载相关上下文 |
| `-Mode` | 输出模式：`inline`、`file`、`silent` |

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-session-start.ps1 -Cwd "E:\Projects\personal-project-knowledge-mcp" -Project "personal-project-knowledge-mcp" -Mode inline
```

如果提示 `Run npm run build`，说明 `dist/scripts/hook-load.js` 或 `dist/scripts/hook-start.js` 不存在，需要先执行：

```powershell
npm run build
```

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
- `get_storage_info`：查看 dataRoot、文档目录、记忆目录、备份目录和默认导入路径。
- `build_context`：构建自动载入上下文。
- `list_semantic_types`：列出语义分类、默认加载策略、搜索策略和记录数量。
- `list_loaded_memory`：查看当前项目会自动载入的短记忆和长索引。
- `write_memory`：写短记忆或长记忆索引。
- `search_memory` / `get_memory`：搜索和读取记忆。
- `write_doc` / `search_docs` / `read_doc`：管理 Markdown 文档；`read_doc` 会返回相对路径和绝对路径。
- `resolve_doc_path` / `move_doc`：解析文档真实保存位置，并在 dataRoot 内移动已入库文档。
- `import_markdown_dir` / `migrate_markdown_file`：批量导入目录或迁移单个 Markdown 文件。
- `create_or_update_doc_index`：让文档生成可自动载入的长记忆索引。
- `demote_memory_to_doc`：把过长短记忆降级成文档 + 长索引。
- `extract_memory_candidates`：从对话文本启发式提取候选，不直接写入。
- `commit_memory_candidates`：提交候选，高风险类型默认需要确认。
- `record_session_artifacts`：记录会话文档并生成 long_index。
- `record_bug_report`：AI 使用 MCP 发现 MCP 自身 bug/不清晰行为时，记录为 `bug_report` 文档方便后续统一修复。
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
- Codex SessionStart hook：Codex adapter 安装后默认自动注入当前项目短记忆和长记忆索引。
- Prompt `use_personal_project_knowledge`：载入默认指南 + 当前项目短记忆 + 长记忆索引，可传 `project`、`cwd`、`query`。
- Resource `guide://personal-project-knowledge/usage`：默认使用指南，说明应优先用本 MCP 管理记忆和文档。
- Resource `storage://personal-project-knowledge/locations`：dataRoot、文档目录、记忆目录和路径规则。
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
- 查看 dataRoot、文档目录、默认导入目录等存储位置。
- 构建自动载入上下文。
- 搜索、新增、废弃记忆。
- 搜索、读取、新增文档并创建 `long_index`。
- 查看高频统计和高频候选。
- 按 `semantic_type` 分类浏览记忆和文档，并标记“默认加载 / 仅搜索”。
- 分类内搜索支持索引、命中片段和全文返回模式。
- 导入现有 Markdown 目录。
- 迁移单个 Markdown 文件。
- 移动已入库文档并同步索引。
- 记录 MCP bug/反馈为 `bug_report`。
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
- Codex adapter 默认安装会话启动 hook 自动注入记忆；非 Codex 客户端仍需通过 MCP instructions、tools/resources/prompts 或通用 skill/plugin 获取上下文。
