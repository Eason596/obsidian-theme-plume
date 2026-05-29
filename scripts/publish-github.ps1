# Publish obsidian-theme-plume to a new GitHub repository.
# Prerequisites: GitHub CLI (`gh`) installed and logged in (`gh auth login`).

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: gh auth login" -ForegroundColor Yellow
  exit 1
}

$RepoName = if ($args[0]) { $args[0] } else { "obsidian-theme-plume" }

gh repo create $RepoName `
  --public `
  --source . `
  --remote origin `
  --description "Obsidian plugin: VuePress Theme Plume markdown containers. Ported from vuepress-theme-plume with AI-assisted migration." `
  --push

Write-Host "Done. Repository URL:" -ForegroundColor Green
gh repo view --json url -q .url
