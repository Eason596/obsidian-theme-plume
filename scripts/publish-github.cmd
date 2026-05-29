@echo off
setlocal EnableExtensions

REM Publish obsidian-theme-plume to a new GitHub repository.
REM Prerequisites: GitHub CLI (gh) installed and logged in (gh auth login).
REM Usage: scripts\publish-github.cmd [repo-name]

cd /d "%~dp0.."
if errorlevel 1 (
  echo Failed to change directory to repository root.
  exit /b 1
)

where gh >nul 2>&1
if errorlevel 1 (
  echo GitHub CLI ^(gh^) not found. Install: winget install GitHub.cli
  exit /b 1
)

gh auth status >nul 2>&1
if errorlevel 1 (
  echo Not logged in. Run: gh auth login
  exit /b 1
)

if "%~1"=="" (
  set "REPO_NAME=obsidian-theme-plume"
) else (
  set "REPO_NAME=%~1"
)

echo Creating public repository: %REPO_NAME%
gh repo create "%REPO_NAME%" --public --source . --remote origin --description "Obsidian plugin: VuePress Theme Plume markdown containers. Ported from vuepress-theme-plume with AI-assisted migration." --push
if errorlevel 1 exit /b 1

echo.
echo Done. Repository URL:
gh repo view --json url -q .url
if errorlevel 1 exit /b 1

endlocal
exit /b 0
