# build-run.ps1 — driver de l'overlay RL.
# Flow : kill l'overlay en cours -> compile (electron-packager) -> supprime les
# vieux artefacts de dist -> (option) zip -> relance l'exe packagé directement.
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File .claude\skills\run-rl-overlay\build-run.ps1
#   ... -NoZip        # saute la création du zip (itération rapide)
#   ... -NoLaunch     # build seulement, ne relance pas l'exe
#
# electron-builder n'est PAS utilisé : il télécharge winCodeSign qui exige le
# privilège de création de symlink (Mode Développeur/admin) et échoue sinon.
# @electron/packager n'a pas cette dépendance -> build fiable hors admin.

param(
  [switch]$NoZip,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'

# Racine projet = 3 niveaux au-dessus du dossier du skill.
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location $root
Write-Host "[build-run] projet: $root" -ForegroundColor Cyan

$AppName  = 'RL Overlay'
$PackDir  = Join-Path $root 'dist-pack'
$AppOut   = Join-Path $PackDir "$AppName-win32-x64"
$PackExe  = Join-Path $AppOut "$AppName.exe"
$DistDir  = Join-Path $root 'dist'
$Zip      = Join-Path $DistDir 'RL-Overlay-win-x64.zip'
$RunDir   = Join-Path $DistDir 'app'                 # zip extrait ici
$RunExe   = Join-Path $RunDir "$AppName.exe"

# 1) Kill l'overlay s'il tourne (sinon les .dll/.exe sont verrouillés et
#    --overwrite échoue). ProcessName = nom sans .exe.
$running = Get-Process -Name $AppName -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "[build-run] kill $($running.Count) instance(s) en cours..." -ForegroundColor Yellow
  $running | Stop-Process -Force
  Start-Sleep -Milliseconds 700
}

# 2) Compile (repackage propre). --overwrite remplace dist-pack.
Write-Host "[build-run] packaging..." -ForegroundColor Cyan
# --asar.unpack=*.mp3 : les sons restent des vrais fichiers (app.asar.unpacked),
# sinon <audio> ne sait pas les lire depuis l'asar.
& npx --yes @electron/packager . "$AppName" --platform=win32 --arch=x64 --out=dist-pack --overwrite --asar.unpack=*.mp3 --ignore="(dist|dist-pack|node_modules/.cache)"
if (-not (Test-Path $PackExe)) { throw "exe introuvable apres packaging: $PackExe" }

# 3) Supprime les vieux artefacts de dist (on garde dist-pack qui contient le
#    build courant). On reconstruit le dossier dist proprement.
if (Test-Path $DistDir) {
  Get-ChildItem $DistDir -Force | ForEach-Object {
    try { Remove-Item $_.FullName -Recurse -Force -ErrorAction Stop; Write-Host "  - supprime dist\$($_.Name)" -ForegroundColor DarkGray }
    catch { Write-Host "  ! verrouille, ignore: dist\$($_.Name)" -ForegroundColor DarkYellow }
  }
} else {
  New-Item -ItemType Directory -Path $DistDir | Out-Null
}

# 4) Zip + dézip : on valide l'artefact distribué (le zip), pas le build brut.
#    Sans -NoZip : zip -> extrait dans dist\app -> on lancera CET exe-là.
#    Avec -NoZip : on lance directement l'exe de dist-pack (pas de zip/dézip).
$LaunchExe = $PackExe
if (-not $NoZip) {
  Write-Host "[build-run] zip -> $Zip" -ForegroundColor Cyan
  if (Test-Path $Zip) { Remove-Item $Zip -Force }
  Compress-Archive -Path (Join-Path $AppOut '*') -DestinationPath $Zip -CompressionLevel Optimal
  $mb = [math]::Round((Get-Item $Zip).Length / 1MB, 1)
  Write-Host "[build-run] zip pret ($mb MB)" -ForegroundColor Green

  Write-Host "[build-run] dezip -> $RunDir" -ForegroundColor Cyan
  if (Test-Path $RunDir) { Remove-Item $RunDir -Recurse -Force }
  Expand-Archive -Path $Zip -DestinationPath $RunDir -Force
  if (-not (Test-Path $RunExe)) { throw "exe introuvable apres dezip: $RunExe" }
  $LaunchExe = $RunExe
}

# 5) Relance l'exe (extrait du zip, ou packagé brut si -NoZip).
if (-not $NoLaunch) {
  Write-Host "[build-run] lancement: $LaunchExe" -ForegroundColor Green
  Start-Process -FilePath $LaunchExe
  Start-Sleep -Milliseconds 800
  $p = Get-Process -Name $AppName -ErrorAction SilentlyContinue
  if ($p) { Write-Host "[build-run] OK - en cours (pid $($p[0].Id)). Overlay visible quand Rocket League a le focus." -ForegroundColor Green }
  else    { Write-Host "[build-run] ! process introuvable apres lancement (verifie config / log userData)." -ForegroundColor Red }
}

Write-Host "[build-run] termine." -ForegroundColor Cyan
