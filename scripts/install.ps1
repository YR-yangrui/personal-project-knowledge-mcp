param(
  [string]$DataRoot = "$env:USERPROFILE\.personal-project-knowledge-mcp",
  [switch]$SkipBuild,
  [switch]$SkipNpmInstall,
  [switch]$InstallCodexAdapter
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistIndex = Join-Path $Root "dist\index.js"
$ConfigPath = Join-Path $DataRoot "config.yaml"

Write-Host "[1/4] Preparing project dependencies..."
Push-Location $Root
try {
  if (-not $SkipNpmInstall) {
    npm install
  }
  else {
    Write-Host "npm install skipped."
  }

  if (-not $SkipBuild) {
    Write-Host "[2/4] Building TypeScript..."
    npm run build
  }
  else {
    Write-Host "[2/4] Build skipped."
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $DistIndex)) {
  throw "Built MCP entry not found: $DistIndex"
}

Write-Host "[3/4] Preparing data root..."
New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
if (-not (Test-Path -LiteralPath $ConfigPath)) {
  $escapedDataRoot = $DataRoot.Replace("\", "/")
  $config = @"
dataRoot: "$escapedDataRoot"
maxShortMemoryChars: 500
memorySizing:
  shortMaxChars: 500
  longToShortMaxChars: 300
  autoDemoteOverlongShort: true
  autoPromoteShortLongIndex: true
  demoteDocumentDir: archives
budgets:
  globalShortTokens: 800
  projectShortTokens: 1200
  longIndexTokens: 2000
  relatedTopK: 5
semanticTypes:
  bugfix:
    default_load_level: long_index
    default_scope: project
    description: "Bug 修复记录；默认仅搜索，不占启动上下文。"
    searchable: true
    auto_load_index: false
    show_in_context: false
    show_in_webui: true
"@
  [System.IO.File]::WriteAllText($ConfigPath, $config, $Utf8NoBom)
  Write-Host "Created config: $ConfigPath"
}
else {
  Write-Host "Config exists: $ConfigPath"
}

if ($InstallCodexAdapter) {
  Write-Host "[4/4] Installing Codex adapter..."
  & (Join-Path $PSScriptRoot "install-codex.ps1") -SkipBuild
}
else {
  Write-Host "[4/4] Generic install complete."
}

$node = (Get-Command node -ErrorAction Stop).Source.Replace("\", "/")
$entry = $DistIndex.Replace("\", "/")
Write-Host "MCP server command: $node"
Write-Host "MCP server args: $entry"
Write-Host "Data root: $DataRoot"
Write-Host "For Codex adapter install: powershell -ExecutionPolicy Bypass -File scripts/install-codex.ps1"
