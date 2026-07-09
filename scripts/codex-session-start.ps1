param(
  [string]$Cwd,
  [string]$Project,
  [string]$Query,
  [ValidateSet("inline", "file", "silent")]
  [string]$Mode = "inline"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$HookLoad = Join-Path $Root "dist\scripts\hook-load.js"
$HookStart = Join-Path $Root "dist\scripts\hook-start.js"

function Get-FirstStringValue {
  param(
    [object]$Source,
    [string[]]$Names
  )

  foreach ($name in $Names) {
    if ($null -ne $Source -and $Source.PSObject.Properties.Name -contains $name) {
      $value = $Source.$name
      if ($value -is [string] -and $value.Length -gt 0) {
        return $value
      }
    }
  }
  return $null
}

function Invoke-NodeChecked {
  param(
    [string]$Node,
    [string[]]$Arguments,
    [switch]$Capture
  )

  if ($Capture) {
    $output = & $Node @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ($output -join [Environment]::NewLine)
    }
    return $output
  }

  & $Node @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "node failed with exit code $LASTEXITCODE"
  }
}

try {
  if ($env:PPKM_CODEX_SESSION_START_MODE) {
    $envMode = ($env:PPKM_CODEX_SESSION_START_MODE).ToLowerInvariant()
    if (@("inline", "file", "silent") -contains $envMode) {
      $Mode = $envMode
    }
  }

  $payload = $null
  if ([Console]::IsInputRedirected) {
    $stdin = [Console]::In.ReadToEnd()
    if (-not [string]::IsNullOrWhiteSpace($stdin)) {
      try {
        $payload = $stdin | ConvertFrom-Json
      }
      catch {
        $payload = $null
      }
    }
  }

  if (-not $Cwd) {
    # Codex hook payload shapes can change between versions, so accept several
    # likely field names and fall back to the process working directory.
    $Cwd = Get-FirstStringValue $payload @("cwd", "working_directory", "workspace_path", "project_dir")
  }
  if (-not $Cwd) {
    $Cwd = (Get-Location).Path
  }

  if (-not (Test-Path -LiteralPath $HookLoad)) {
    if ($Mode -ne "silent") {
      Write-Output "Personal Project Knowledge: auto-load skipped; built hook script was not found: $HookLoad. Run npm run build."
    }
    exit 0
  }

  $node = (Get-Command node -ErrorAction Stop).Source
  $baseArgs = @("--cwd=$Cwd")
  if ($Project) {
    $baseArgs += "--project=$Project"
  }
  if ($Query) {
    $baseArgs += "--query=$Query"
  }

  switch ($Mode) {
    "inline" {
      Invoke-NodeChecked -Node $node -Arguments (@($HookLoad) + $baseArgs)
    }
    "file" {
      if (-not (Test-Path -LiteralPath $HookStart)) {
        Write-Output "Personal Project Knowledge: auto-load skipped; built hook session script was not found: $HookStart. Run npm run build."
        exit 0
      }

      # Ask Node to print the compact pointer directly. Avoid reparsing pretty
      # JSON in PowerShell because hook startup must tolerate shell encoding and
      # mixed-output quirks without dropping the whole context load.
      Invoke-NodeChecked -Node $node -Arguments (@($HookStart) + $baseArgs + @("--format=summary"))
    }
    "silent" {
      if (Test-Path -LiteralPath $HookStart) {
        # Silent mode intentionally writes only session artifacts. With command
        # hooks, suppressing stdout also means Codex cannot receive inline memory.
        Invoke-NodeChecked -Node $node -Arguments (@($HookStart) + $baseArgs) -Capture | Out-Null
      }
    }
  }
}
catch {
  if ($Mode -ne "silent") {
    Write-Output "Personal Project Knowledge: auto-load failed and was skipped to avoid blocking session startup. $($_.Exception.Message)"
  }
  exit 0
}
