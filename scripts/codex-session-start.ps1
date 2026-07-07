param(
  [string]$Cwd = (Get-Location).Path,
  [string]$Query = ""
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root
try {
  $json = npx tsx src/scripts/hook-start.ts --cwd="$Cwd" --query="$Query" | ConvertFrom-Json
  if ($json.context_path -and (Test-Path -LiteralPath $json.context_path)) {
    Get-Content -LiteralPath $json.context_path -Encoding UTF8 -Raw
  }
  else {
    Write-Output "personal-project-knowledge hook: context file was not generated."
  }
}
catch {
  Write-Output "personal-project-knowledge hook failed: $($_.Exception.Message)"
}
finally {
  Pop-Location
}
