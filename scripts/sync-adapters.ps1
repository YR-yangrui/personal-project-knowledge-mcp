# Sync generated client adapters from portable plugin/skill sources.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$GenericSkill = Join-Path $Root "skills\personal-project-knowledge"
$CodexSkill = Join-Path $Root "codex-plugin\personal-project-knowledge\skills\personal-project-knowledge"

if (-not (Test-Path -LiteralPath $GenericSkill)) {
  throw "Generic skill source not found: $GenericSkill"
}
if (-not (Test-Path -LiteralPath $CodexSkill)) {
  New-Item -ItemType Directory -Force -Path $CodexSkill | Out-Null
}

# Keep Codex UI metadata if present, but make the actual workflow files portable.
Copy-Item -LiteralPath (Join-Path $GenericSkill "SKILL.md") -Destination (Join-Path $CodexSkill "SKILL.md") -Force
$GenericRefs = Join-Path $GenericSkill "references"
$CodexRefs = Join-Path $CodexSkill "references"
if (Test-Path -LiteralPath $CodexRefs) {
  Remove-Item -LiteralPath $CodexRefs -Recurse -Force
}
Copy-Item -LiteralPath $GenericRefs -Destination $CodexRefs -Recurse -Force
Write-Host "Synced generic skill into Codex adapter."
