param(
  [string]$CodexConfig = "$env:USERPROFILE\.codex\config.toml",
  [string]$ServerName = "personal-project-knowledge",
  [switch]$KeepPlugin,
  [switch]$KeepSkill,
  [switch]$KeepMarketplaceEntry
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$PluginDest = Join-Path $env:USERPROFILE "plugins\personal-project-knowledge"
$SkillDest = Join-Path $env:USERPROFILE ".codex\skills\personal-project-knowledge"
$MarketplacePath = Join-Path $env:USERPROFILE ".agents\plugins\marketplace.json"

Write-Host "[1/4] Removing Codex MCP config..."
if (Test-Path -LiteralPath $CodexConfig) {
  $backup = "$CodexConfig.bak-ppkm-uninstall-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item -LiteralPath $CodexConfig -Destination $backup -Force
  Write-Host "Backup: $backup"
  $content = Get-Content -LiteralPath $CodexConfig -Raw

  $serverPattern = "(?ms)^\[mcp_servers\.$([regex]::Escape($ServerName))\]\r?\n.*?(?=^\[|\z)"
  $content = [regex]::Replace($content, $serverPattern, "")

  # Remove obsolete SessionStart hook leftovers from older versions.
  $hookPattern = "(?ms)^# >>> personal-project-knowledge SessionStart >>>.*?# <<< personal-project-knowledge SessionStart <<<\r?\n?"
  $content = [regex]::Replace($content, $hookPattern, "")
  $orphanHookPattern = "(?ms)^\[\[hooks\.SessionStart\]\]\r?\nmatcher = ""startup\|resume\|clear\|compact""\r?\n\s*\[\[hooks\.SessionStart\.hooks\]\]\r?\ntype = ""command""\r?\ncommand = 'powershell -NoProfile -ExecutionPolicy Bypass -File ""[^""]*codex-session-start\.ps1""'\r?\n# <<< personal-project-knowledge SessionStart <<<\r?\n?"
  $content = [regex]::Replace($content, $orphanHookPattern, "")

  [System.IO.File]::WriteAllText($CodexConfig, $content, $Utf8NoBom)
}
else {
  Write-Host "Codex config not found: $CodexConfig"
}

Write-Host "[2/4] Removing Codex plugin adapter..."
if (-not $KeepPlugin -and (Test-Path -LiteralPath $PluginDest)) {
  Remove-Item -LiteralPath $PluginDest -Recurse -Force
  Write-Host "Removed: $PluginDest"
}
elseif ($KeepPlugin) {
  Write-Host "Plugin kept: $PluginDest"
}
else {
  Write-Host "Plugin not found: $PluginDest"
}

Write-Host "[3/4] Removing Codex skill copy..."
if (-not $KeepSkill -and (Test-Path -LiteralPath $SkillDest)) {
  Remove-Item -LiteralPath $SkillDest -Recurse -Force
  Write-Host "Removed: $SkillDest"
}
elseif ($KeepSkill) {
  Write-Host "Skill kept: $SkillDest"
}
else {
  Write-Host "Skill not found: $SkillDest"
}

Write-Host "[4/4] Updating personal marketplace..."
if (-not $KeepMarketplaceEntry -and (Test-Path -LiteralPath $MarketplacePath)) {
  $marketplace = Get-Content -LiteralPath $MarketplacePath -Raw | ConvertFrom-Json
  $marketplace.plugins = @($marketplace.plugins | Where-Object { $_.name -ne "personal-project-knowledge" })
  [System.IO.File]::WriteAllText($MarketplacePath, ($marketplace | ConvertTo-Json -Depth 10), $Utf8NoBom)
  Write-Host "Removed marketplace entry: personal-project-knowledge"
}
elseif ($KeepMarketplaceEntry) {
  Write-Host "Marketplace entry kept."
}
else {
  Write-Host "Marketplace not found: $MarketplacePath"
}

Write-Host "Codex adapter uninstall complete. Restart Codex/client to unload the MCP server."
