param(
  [ValidateSet('patch','minor','major')] [string]$Bump = 'patch',
  [string]$Version
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."  # racine projet rl-overlay
Set-Location $root

# 1. Garde-fous
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "gh CLI absent. winget install GitHub.cli" }
gh auth status *> $null; if ($LASTEXITCODE -ne 0) { throw "gh non authentifie. gh auth login" }
if (git status --porcelain) { throw "Arbre git non propre. Commit/stash d'abord." }
if (-not (git remote get-url origin 2>$null)) { throw "Pas de remote 'origin'. Voir SKILL.md (setup)." }

# 2. Bump version package.json
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
if ($Version) {
  $new = $Version
} else {
  $p = $pkg.version.Split('.') | ForEach-Object { [int]$_ }
  switch ($Bump) {
    'major' { $p[0]++; $p[1] = 0; $p[2] = 0 }
    'minor' { $p[1]++; $p[2] = 0 }
    'patch' { $p[2]++ }
  }
  $new = "$($p[0]).$($p[1]).$($p[2])"
}
$pkg.version = $new
($pkg | ConvertTo-Json -Depth 20) | Set-Content package.json -Encoding utf8
Write-Host "Version -> $new"

# 3. Build le zip distribuable (kill instance + package + zip, pas de relance)
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-rl-overlay\build-run.ps1" -NoLaunch
$zip = "dist\RL-Overlay-win-x64.zip"
if (-not (Test-Path $zip)) { throw "Zip introuvable: $zip" }

# 4. Git commit + tag + push
git add package.json
git commit -m "release: v$new"
git tag "v$new"
git push --follow-tags

# 5. GitHub Release (notes auto-generees)
gh release create "v$new" $zip --title "v$new" --generate-notes
Write-Host "Release v$new publiee."
