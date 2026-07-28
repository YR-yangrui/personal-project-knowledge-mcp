param(
  [string]$Version = "",
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$PackageName = "personal-project-knowledge-mcp"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = $Stamp
}

$ReleaseRoot = Join-Path $Root "release"
$Stage = Join-Path $ReleaseRoot "$PackageName-$Version"
$ZipPath = Join-Path $ReleaseRoot "$PackageName-$Version.zip"

function Invoke-CheckedNative {
  param(
    [string]$Command,
    [string[]]$Arguments
  )

  # Windows PowerShell does not turn a native command's non-zero exit code into
  # a terminating error, so enforce it before continuing the release pipeline.
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE"
  }
}

Write-Host "[1/6] Preparing release directory..."
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null
if (Test-Path -LiteralPath $Stage) {
  Remove-Item -LiteralPath $Stage -Recurse -Force
}
if (Test-Path -LiteralPath $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

Write-Host "[2/6] Installing dependencies..."
Push-Location $Root
try {
  Invoke-CheckedNative "npm" @("install")

  Write-Host "[3/6] Building TypeScript..."
  Invoke-CheckedNative "npm" @("run", "build")

  if (-not $SkipVerify) {
    Write-Host "[4/6] Running verification..."
    Invoke-CheckedNative "npm" @("run", "verify")
    Invoke-CheckedNative "npm" @("run", "verify:web")
  }
  else {
    Write-Host "[4/6] Verification skipped."
  }

  Write-Host "[5/6] Staging files..."
  New-Item -ItemType Directory -Force -Path $Stage | Out-Null
  $Include = @(
    "dist",
    "public",
    "docs",
    "scripts",
    "skills",
    "plugin",
    "codex-plugin",
    "manifest.json",
    "README.md",
    "package.json",
    "package-lock.json",
    "tsconfig.json"
  )
  foreach ($item in $Include) {
    $src = Join-Path $Root $item
    if (Test-Path -LiteralPath $src) {
      Copy-Item -LiteralPath $src -Destination $Stage -Recurse -Force
    }
  }

  Write-Host "[6/6] Creating zip..."
  Compress-Archive -LiteralPath $Stage -DestinationPath $ZipPath -Force
  Write-Host "Package created: $ZipPath"
}
finally {
  Pop-Location
}
