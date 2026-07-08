param(
  [string]$CodexConfig = "$env:USERPROFILE\.codex\config.toml",
  [string]$ServerName = "personal-project-knowledge",
  [switch]$SkipGitPull,
  [switch]$SkipNpmInstall,
  [switch]$SkipBuild,
  [switch]$SkipVerify,
  [switch]$SkipPlugin,
  [switch]$RestartWebUi,
  [int]$WebPort = 8787
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Action
}

function Test-CommandExists {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Stop-WebUiProcess {
  param([int]$Port)

  $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  $processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($processId in $processIds) {
    if (-not $processId) {
      continue
    }

    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
      continue
    }

    Write-Host "Stopping Web UI process $processId on port $Port..."
    Stop-Process -Id $processId -Force
  }
}

Push-Location $Root
try {
  Invoke-Step "Checking tools" {
    if (-not (Test-CommandExists "git")) {
      throw "git was not found in PATH."
    }
    if (-not (Test-CommandExists "node")) {
      throw "node was not found in PATH."
    }
    if (-not (Test-CommandExists "npm")) {
      throw "npm was not found in PATH."
    }
  }

  Invoke-Step "Pulling latest code" {
    if ($SkipGitPull) {
      Write-Host "git pull skipped."
      return
    }

    $isRepo = (& git rev-parse --is-inside-work-tree 2>$null)
    if ($LASTEXITCODE -ne 0 -or $isRepo.Trim() -ne "true") {
      throw "Current directory is not a git repository: $Root"
    }

    $upstream = (& git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)) {
      throw "No upstream branch is configured. Set upstream or run with -SkipGitPull."
    }

    $status = (& git status --porcelain)
    if (-not [string]::IsNullOrWhiteSpace(($status -join "`n"))) {
      Write-Host "Local changes detected; using git pull --autostash to protect the worktree."
    }

    # Keep updates fast-forward only so the update script never creates surprise merge commits.
    & git pull --ff-only --autostash
    if ($LASTEXITCODE -ne 0) {
      throw "git pull failed. Resolve git conflicts/state, then rerun this script."
    }
  }

  Invoke-Step "Installing dependencies" {
    if ($SkipNpmInstall) {
      Write-Host "npm install skipped."
      return
    }

    npm install
  }

  Invoke-Step "Syncing adapter assets" {
    & (Join-Path $PSScriptRoot "sync-adapters.ps1")
  }

  Invoke-Step "Building project" {
    if ($SkipBuild) {
      Write-Host "build skipped."
      return
    }

    npm run build
  }

  Invoke-Step "Running verification" {
    if ($SkipVerify) {
      Write-Host "verification skipped."
      return
    }

    npm run verify
  }

  Invoke-Step "Reinstalling Codex adapter" {
    $installArgs = @(
      "-ExecutionPolicy", "Bypass",
      "-File", (Join-Path $PSScriptRoot "install-codex.ps1"),
      "-CodexConfig", $CodexConfig,
      "-ServerName", $ServerName,
      "-SkipBuild",
      "-SkipNpmInstall"
    )

    if ($SkipPlugin) {
      $installArgs += "-SkipPlugin"
    }

    & powershell @installArgs
  }

  Invoke-Step "Restarting Web UI" {
    if (-not $RestartWebUi) {
      Write-Host "Web UI restart skipped. Pass -RestartWebUi to restart it."
      return
    }

    Stop-WebUiProcess -Port $WebPort
    $webScript = Join-Path $Root "dist\web.js"
    if (-not (Test-Path -LiteralPath $webScript)) {
      throw "Built Web UI entry not found: $webScript"
    }

    $argumentList = @($webScript)
    Start-Process -FilePath (Get-Command node -ErrorAction Stop).Source -ArgumentList $argumentList -WorkingDirectory $Root -WindowStyle Hidden
    Write-Host "Web UI started on http://127.0.0.1:$WebPort"
  }

  Write-Host ""
  Write-Host "Update complete."
  Write-Host "Restart Codex to reload the MCP server and installed skills."
}
finally {
  Pop-Location
}
