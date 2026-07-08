param(
  [string]$CodexConfig = "$env:USERPROFILE\.codex\config.toml",
  [string]$ServerName = "personal-project-knowledge",
  [switch]$SkipBuild,
  [switch]$SkipNpmInstall,
  [switch]$SkipPlugin
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistIndex = Join-Path $Root "dist\index.js"
$GenericSkillsSource = Join-Path $Root "skills"
$CodexPluginSource = Join-Path $Root "codex-plugin\personal-project-knowledge"
$PluginDest = Join-Path $env:USERPROFILE "plugins\personal-project-knowledge"
$SkillDest = Join-Path $env:USERPROFILE ".codex\skills\personal-project-knowledge"
$MarketplacePath = Join-Path $env:USERPROFILE ".agents\plugins\marketplace.json"
$Node = (Get-Command node -ErrorAction Stop).Source

Write-Host "[1/5] Preparing project..."
Push-Location $Root
try {
  if (-not $SkipNpmInstall) {
    npm install
  }
  else {
    Write-Host "npm install skipped."
  }

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
$content = [regex]::Replace($content, $hookPattern, "")
$orphanHookPattern = "(?ms)^\[\[hooks\.SessionStart\]\]\r?\nmatcher = ""startup\|resume\|clear\|compact""\r?\n\s*\[\[hooks\.SessionStart\.hooks\]\]\r?\ntype = ""command""\r?\ncommand = 'powershell -NoProfile -ExecutionPolicy Bypass -File ""[^""]*codex-session-start\.ps1""'\r?\n# <<< personal-project-knowledge SessionStart <<<\r?\n?"
$content = [regex]::Replace($content, $orphanHookPattern, "")

Set-Content -LiteralPath $CodexConfig -Value $content -Encoding UTF8

Write-Host "[4/5] Installing Codex plugin and skill..."
if (-not $SkipPlugin -and (Test-Path -LiteralPath $CodexPluginSource)) {
  if (Test-Path -LiteralPath $PluginDest) {
    Remove-Item -LiteralPath $PluginDest -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PluginDest) | Out-Null
  Copy-Item -LiteralPath $CodexPluginSource -Destination $PluginDest -Recurse -Force

  if (Test-Path -LiteralPath $GenericSkillsSource) {
    $adapterSkills = Join-Path $PluginDest "skills"
    New-Item -ItemType Directory -Force -Path $adapterSkills | Out-Null
    # Portable skills are the source of truth. The Codex plugin only adapts
    # placement/manifest shape for Codex without changing skill behavior.
    # Merge instead of clearing so adapter-only metadata is not deleted.
    foreach ($skill in Get-ChildItem -LiteralPath $GenericSkillsSource -Directory) {
      $targetSkill = Join-Path $adapterSkills $skill.Name
      New-Item -ItemType Directory -Force -Path $targetSkill | Out-Null
      foreach ($item in Get-ChildItem -LiteralPath $skill.FullName -Force) {
        Copy-Item -LiteralPath $item.FullName -Destination $targetSkill -Recurse -Force
      }
    }
  }

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

  $skillSourceRoot = Join-Path $PluginDest "skills"
  if (Test-Path -LiteralPath $skillSourceRoot) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SkillDest) | Out-Null
    foreach ($skillSource in Get-ChildItem -LiteralPath $skillSourceRoot -Directory) {
      $targetSkill = Join-Path (Split-Path -Parent $SkillDest) $skillSource.Name
      if (Test-Path -LiteralPath $targetSkill) {
        Remove-Item -LiteralPath $targetSkill -Recurse -Force
      }
      Copy-Item -LiteralPath $skillSource.FullName -Destination $targetSkill -Recurse -Force
    }
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
  Write-Host "Codex plugin adapter source not found: $CodexPluginSource"
}

Write-Host "[5/5] Installed."
Write-Host "Server: $ServerName"
Write-Host "Command: $nodeToml"
Write-Host "Args: $entryToml"
Write-Host "SessionStart hook: removed/not installed"
if (-not $SkipPlugin) {
  Write-Host "Plugin: $PluginDest"
  Write-Host "Skills: $(Split-Path -Parent $SkillDest)"
}
Write-Host "Restart Codex to load the MCP server."
