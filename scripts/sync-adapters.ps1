# Sync generated client adapters from portable plugin/skill sources.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$GenericSkills = Join-Path $Root "skills"
$CodexSkills = Join-Path $Root "codex-plugin\personal-project-knowledge\skills"

if (-not (Test-Path -LiteralPath $GenericSkills)) {
  throw "Generic skills source not found: $GenericSkills"
}
New-Item -ItemType Directory -Force -Path $CodexSkills | Out-Null

# Keep all portable skill folders available to Codex adapter.
foreach ($skill in Get-ChildItem -LiteralPath $GenericSkills -Directory) {
  $targetSkill = Join-Path $CodexSkills $skill.Name
  New-Item -ItemType Directory -Force -Path $targetSkill | Out-Null
  # Copy portable skill files into the adapter while preserving adapter-only
  # metadata such as agents/openai.yaml.
  foreach ($item in Get-ChildItem -LiteralPath $skill.FullName -Force) {
    Copy-Item -LiteralPath $item.FullName -Destination $targetSkill -Recurse -Force
  }
}
Write-Host "Synced generic skills into Codex adapter."
