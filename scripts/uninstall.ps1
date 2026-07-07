param(
  [string]$DataRoot = "$env:USERPROFILE\.personal-project-knowledge-mcp",
  [switch]$RemoveCodexAdapter,
  [switch]$RemoveData,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if ($RemoveCodexAdapter) {
  & (Join-Path $PSScriptRoot "uninstall-codex.ps1")
}
else {
  Write-Host "Codex adapter kept. Use -RemoveCodexAdapter to remove Codex config/plugin/skill."
}

if ($RemoveData) {
  if (-not $Force) {
    throw "Refusing to remove data root without -Force: $DataRoot"
  }
  if (Test-Path -LiteralPath $DataRoot) {
    Remove-Item -LiteralPath $DataRoot -Recurse -Force
    Write-Host "Removed data root: $DataRoot"
  }
  else {
    Write-Host "Data root not found: $DataRoot"
  }
}
else {
  Write-Host "Data root kept: $DataRoot"
  Write-Host "Use -RemoveData -Force only if you intentionally want to delete memories and documents."
}

Write-Host "Generic uninstall complete. Project files are not deleted by this script."
