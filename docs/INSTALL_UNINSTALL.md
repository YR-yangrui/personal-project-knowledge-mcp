# 安装与卸载

## 通用安装

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

执行内容：

- 安装 npm 依赖。
- 构建 `dist/`。
- 初始化数据目录，默认是 `%USERPROFILE%\.personal-project-knowledge-mcp`。
- 创建默认 `config.yaml`。
- 不写入特定客户端配置。

可选参数：

| 参数 | 说明 |
|---|---|
| `-DataRoot <path>` | 指定数据目录 |
| `-SkipBuild` | 跳过构建 |
| `-SkipNpmInstall` | 跳过 npm install |
| `-InstallCodexAdapter` | 通用安装后继续安装 Codex adapter |

## Codex adapter 安装

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1
```

执行内容：

- 安装依赖并构建。
- 写入 `%USERPROFILE%\.codex\config.toml` 的 MCP server 配置。
- 安装 `C:\Users\<you>\plugins\personal-project-knowledge`。
- 安装 `C:\Users\<you>\.codex\skills\personal-project-knowledge`。
- 更新 `%USERPROFILE%\.agents\plugins\marketplace.json`。
- 清理旧版本残留的 personal-project-knowledge SessionStart hook。

不会安装新的 SessionStart hook。

## 通用卸载

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall.ps1
```

默认行为：

- 不删除项目文件。
- 不删除数据目录。
- 不移除 Codex adapter。

常用参数：

| 参数 | 说明 |
|---|---|
| `-RemoveCodexAdapter` | 调用 `uninstall-codex.ps1` 移除 Codex 配置、plugin、skill |
| `-RemoveData -Force` | 删除数据目录，包含记忆、文档、SQLite 数据库 |
| `-DataRoot <path>` | 指定要删除的数据目录 |

## Codex adapter 卸载

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall-codex.ps1
```

执行内容：

- 从 Codex config 移除 `[mcp_servers.personal-project-knowledge]`。
- 清理旧版本残留的 SessionStart hook。
- 删除个人 plugin 目录。
- 删除个人 skill 目录。
- 从 personal marketplace 删除插件条目。

保留项：

- 不删除数据目录 `%USERPROFILE%\.personal-project-knowledge-mcp`。
- 不删除当前项目仓库。

可选参数：

| 参数 | 说明 |
|---|---|
| `-KeepPlugin` | 保留个人 plugin 目录 |
| `-KeepSkill` | 保留个人 skill 目录 |
| `-KeepMarketplaceEntry` | 保留 marketplace 条目 |
