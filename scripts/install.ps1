param(
  [string]$CodexConfig = "$env:USERPROFILE\.codex\config.toml",
  [string]$ServerName = "personal-project-knowledge",
  [switch]$SkipBuild,
  [switch]$SkipPlugin
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistIndex = Join-Path $Root "dist\index.js"
$SessionHook = Join-Path $Root "scripts\codex-session-start.ps1"
$PluginSource = Join-Path $Root "codex-plugin\personal-project-knowledge"
$PluginDest = Join-Path $env:USERPROFILE "plugins\personal-project-knowledge"
$SkillDest = Join-Path $env:USERPROFILE ".codex\skills\personal-project-knowledge"
$MarketplacePath = Join-Path $env:USERPROFILE ".agents\plugins\marketplace.json"
$Node = (Get-Command node -ErrorAction Stop).Source

Write-Host "[1/5] Preparing project..."
Push-Location $Root
try {
  npm install
  if (-not $SkipBuild) {
    Write-Host "[2/5] Building..."
    npm run build
  }
  else {
    Write-Host "[2/5] Build skipped."
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $DistIndex)) {
  throw "Built MCP entry not found: $DistIndex"
}

Write-Host "[3/5] Updating Codex MCP config..."
$CodexDir = Split-Path -Parent $CodexConfig
New-Item -ItemType Directory -Force -Path $CodexDir | Out-Null
if (Test-Path -LiteralPath $CodexConfig) {
  $backup = "$CodexConfig.bak-ppkm-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item -LiteralPath $CodexConfig -Destination $backup -Force
  Write-Host "Backup: $backup"
  $content = Get-Content -LiteralPath $CodexConfig -Raw
}
else {
  $content = ""
}

$nodeToml = $Node.Replace("\", "/")
$entryToml = $DistIndex.Replace("\", "/")
$block = @"
[mcp_servers.$ServerName]
command = "$nodeToml"
args = ["$entryToml"]
startup_timeout_sec = 120

"@

$hookToml = $SessionHook.Replace("\", "\\")
$hookBlock = @"
# >>> personal-project-knowledge SessionStart >>>
[[hooks.SessionStart]]
matcher = "startup|resume|clear|compact"

[[hooks.SessionStart.hooks]]
type = "command"
command = 'powershell -NoProfile -ExecutionPolicy Bypass -File "$hookToml"'
# <<< personal-project-knowledge SessionStart <<<

"@

$pattern = "(?ms)^\[mcp_servers\.$([regex]::Escape($ServerName))\]\r?\n.*?(?=^\[|\z)"
if ([regex]::IsMatch($content, $pattern)) {
  $content = [regex]::Replace($content, $pattern, $block)
}
else {
  if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
    $content += "`r`n"
  }
  $content += "`r`n$block"
}

$hookPattern = "(?ms)^# >>> personal-project-knowledge SessionStart >>>.*?# <<< personal-project-knowledge SessionStart <<<\r?\n?"
if ([regex]::IsMatch($content, $hookPattern)) {
  $content = [regex]::Replace($content, $hookPattern, $hookBlock)
}
else {
  if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
    $content += "`r`n"
  }
  $content += "`r`n$hookBlock"
}

Set-Content -LiteralPath $CodexConfig -Value $content -Encoding UTF8

Write-Host "[4/5] Installing Codex plugin and skill..."
if (-not $SkipPlugin -and (Test-Path -LiteralPath $PluginSource)) {
  if (Test-Path -LiteralPath $PluginDest) {
    Remove-Item -LiteralPath $PluginDest -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PluginDest) | Out-Null
  Copy-Item -LiteralPath $PluginSource -Destination $PluginDest -Recurse -Force

  $installedMcp = Join-Path $PluginDest ".mcp.json"
  $installedMcpConfig = [ordered]@{
    mcpServers = [ordered]@{
      $ServerName = [ordered]@{
        command = $nodeToml
        args = @($entryToml)
        startup_timeout_sec = 120
      }
    }
  }
  # The plugin is copied from source, then its MCP entry is rewritten to the
  # current install path so packaged copies do not keep a stale developer path.
  [System.IO.File]::WriteAllText($installedMcp, ($installedMcpConfig | ConvertTo-Json -Depth 10), $Utf8NoBom)

  $skillSource = Join-Path $PluginDest "skills\personal-project-knowledge"
  if (Test-Path -LiteralPath $skillSource) {
    if (Test-Path -LiteralPath $SkillDest) {
      Remove-Item -LiteralPath $SkillDest -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SkillDest) | Out-Null
    Copy-Item -LiteralPath $skillSource -Destination $SkillDest -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $MarketplacePath) | Out-Null
  if (Test-Path -LiteralPath $MarketplacePath) {
    $marketplace = Get-Content -LiteralPath $MarketplacePath -Raw | ConvertFrom-Json
  }
  else {
    $marketplace = [pscustomobject]@{
      name = "personal"
      interface = [pscustomobject]@{ displayName = "Personal" }
      plugins = @()
    }
  }

  $plugins = @($marketplace.plugins | Where-Object { $_.name -ne "personal-project-knowledge" })
  $plugins += [pscustomobject]@{
    name = "personal-project-knowledge"
    source = [pscustomobject]@{ source = "local"; path = "./plugins/personal-project-knowledge" }
    policy = [pscustomobject]@{ installation = "AVAILABLE"; authentication = "ON_INSTALL" }
    category = "Productivity"
  }
  $marketplace.plugins = $plugins
  [System.IO.File]::WriteAllText($MarketplacePath, ($marketplace | ConvertTo-Json -Depth 10), $Utf8NoBom)
}
elseif ($SkipPlugin) {
  Write-Host "Plugin install skipped."
}
else {
  Write-Host "Plugin source not found: $PluginSource"
}

Write-Host "[5/5] Installed."
Write-Host "Server: $ServerName"
Write-Host "Command: $nodeToml"
Write-Host "Args: $entryToml"
Write-Host "SessionStart hook: $SessionHook"
if (-not $SkipPlugin) {
  Write-Host "Plugin: $PluginDest"
  Write-Host "Skill: $SkillDest"
}
Write-Host "Restart Codex to load the MCP server."
