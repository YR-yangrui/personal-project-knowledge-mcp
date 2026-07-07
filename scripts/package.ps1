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
  npm install

  Write-Host "[3/6] Building TypeScript..."
  npm run build

  if (-not $SkipVerify) {
    Write-Host "[4/6] Running verification..."
    npm run verify
    npm run verify:web
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
