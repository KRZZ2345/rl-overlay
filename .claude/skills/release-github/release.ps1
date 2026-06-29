param(
  [ValidateSet('patch','minor','major')] [string]$Bump = 'patch',
  [string]$Version
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."  # racine projet rl-overlay
Set-Location $root

# 1. Garde-fous
$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) {
  $gh = @("$env:ProgramFiles\GitHub CLI\gh.exe", "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe",
          "$env:LOCALAPPDATA\Microsoft\WinGet\Links\gh.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $gh) { throw "gh CLI absent. winget install GitHub.cli" }
& $gh auth status *> $null; if ($LASTEXITCODE -ne 0) { throw "gh non authentifie. gh auth login" }
if (git status --porcelain) { throw "Arbre git non propre. Commit/stash d'abord." }
if (-not (git remote get-url origin 2>$null)) { throw "Pas de remote 'origin'. Voir SKILL.md (setup)." }

# 2. Bump version package.json (édition ciblée de la ligne version : préserve le
#    formatage ET écrit en UTF-8 SANS BOM — @electron/packager rejette un BOM).
$raw = Get-Content package.json -Raw
$cur = ([regex]'"version"\s*:\s*"([^"]+)"').Match($raw).Groups[1].Value
if ($Version) {
  $new = $Version
} else {
  $p = $cur.Split('.') | ForEach-Object { [int]$_ }
  switch ($Bump) {
    'major' { $p[0]++; $p[1] = 0; $p[2] = 0 }
    'minor' { $p[1]++; $p[2] = 0 }
    'patch' { $p[2]++ }
  }
  $new = "$($p[0]).$($p[1]).$($p[2])"
}
$raw = [regex]::Replace($raw, '("version"\s*:\s*")[^"]+(")', "`${1}$new`$2", 1)
[System.IO.File]::WriteAllText("$root\package.json", $raw)  # UTF-8 sans BOM
Write-Host "Version -> $new"

# 3. Build le zip distribuable (kill instance + package + zip, pas de relance).
#    On supprime un zip périmé AVANT pour qu'un build raté ne passe pas inaperçu.
$zip = "dist\RL-Overlay-win-x64.zip"
Remove-Item $zip -Force -ErrorAction SilentlyContinue
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-rl-overlay\build-run.ps1" -NoLaunch
if ($LASTEXITCODE -ne 0) { throw "Build échoué (build-run.ps1, code $LASTEXITCODE)" }
if (-not (Test-Path $zip)) { throw "Zip introuvable: $zip" }

# 3b. Installeur per-user NSIS (asset pour les NOUVEAUX ; le zip sert à l'auto-update).
#     Signature désactivée (pas de certif payant -> SmartScreen avertit, normal).
$setup = "dist\RL-Overlay-Setup-$new.exe"
Remove-Item $setup -Force -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win nsis
if (-not (Test-Path $setup)) { throw "Installeur NSIS introuvable: $setup" }

# 4. Git commit + tag (annoté, pour qu'il soit poussé par --follow-tags) + push
git add package.json
git commit -m "release: v$new"
git tag -a "v$new" -m "v$new"
git push --follow-tags

# 5. GitHub Release : zip (auto-update) + setup.exe (nouveaux installs)
& $gh release create "v$new" $zip $setup --title "v$new" --generate-notes
Write-Host "Release v$new publiee."
