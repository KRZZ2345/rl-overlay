---
name: run-rl-overlay
description: Compile, nettoie les vieux artefacts, kill l'instance en cours et relance l'overlay Rocket League (.exe Electron). Utiliser pour "build/compile l'overlay RL", "relance l'overlay", "rebuild and run rl-overlay", "screenshot l'overlay", "kill et relance l'exe", "régénère le zip dans dist".
---

# Run RL Overlay

Overlay Electron transparent posé au-dessus de Rocket League (MMR, streak,
wins/losses, 5 formes Esports HUD, 8 thèmes). Pas d'injection : scrape l'API
publique Tracker.gg dans un Chromium caché.

Tout le cycle build+run passe par **un driver PowerShell unique** :
`.claude/skills/run-rl-overlay/build-run.ps1`. Il kill l'instance en cours,
recompile, supprime les vieux artefacts de `dist/`, régénère le zip, puis
relance l'exe packagé directement. Chemins ci-dessous relatifs à la racine
projet (`rl-overlay/`). Plateforme : **Windows** (l'app et le build sont Win32).

## Prérequis

- Node.js LTS + `npm` (electron 31 est en devDependency).
- `npm install` une fois dans `rl-overlay/`.
- Pas d'admin requis. **electron-builder est volontairement évité** (il télécharge
  winCodeSign qui exige le privilège symlink Windows et échoue hors Mode
  Développeur). Le driver utilise `@electron/packager` (récupéré via `npx`).

## Run (chemin agent) — driver

Depuis la racine projet :

```powershell
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-rl-overlay\build-run.ps1"
```

Fait, dans l'ordre :
1. `Stop-Process` sur toutes les instances `RL Overlay` (Electron = multi-process,
   ~11 process — normal).
2. `npx --yes @electron/packager . "RL Overlay" --platform=win32 --arch=x64 --out=dist-pack --overwrite` → `dist-pack\RL Overlay-win32-x64\RL Overlay.exe`.
3. Vide `dist/` des vieux artefacts (zips/dossiers périmés ; ignore ce qui est verrouillé).
4. Zip → `dist\RL-Overlay-win-x64.zip` (~114 MB).
5. **Dézip** le zip → `dist\app\` (valide l'artefact réellement distribué).
6. `Start-Process` de `dist\app\RL Overlay.exe` (l'exe **extrait du zip**, pas le build brut) + vérifie que le process tourne.

Options :
- `-NoZip` : saute zip + dézip ; lance directement `dist-pack\...\RL Overlay.exe` (itération rapide).
- `-NoLaunch` : build seulement, ne relance pas.

```powershell
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-rl-overlay\build-run.ps1" -NoZip
```

## Vérifier le rendu (screenshot)

L'overlay est **caché tant que Rocket League n'est pas la fenêtre au premier
plan** (watcher PowerShell qui lit `GetForegroundWindow` chaque seconde). Un
screenshot du bureau seul ne montre rien → c'est attendu, pas un bug.

Pour confirmer qu'il tourne sans crash :

```powershell
(Get-Process -Name "RL Overlay" -ErrorAction SilentlyContinue).Count   # > 0 = OK
```

Capture d'écran (overlay visible seulement si RL a le focus) :

```powershell
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$b=[System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height)
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.X,$b.Y,0,0,$bmp.Size)
$bmp.Save("$env:TEMP\rl_shot.png",[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); "$env:TEMP\rl_shot.png"
```

Vérifié cette session : RL au premier plan → l'overlay s'affiche en bas-droite
(MMR + W/L) près de la jauge de boost. Aucune fenêtre d'erreur Electron.

Hotkey de secours `Ctrl+Alt+H` : force l'affichage même si la détection RL échoue.

## Run (chemin humain)

`npm start` (= `electron .`) lance depuis les sources sans packager. Utile pour
itérer sur `index.html` sans rebuild. Garde la fenêtre vivante jusqu'à Ctrl-C.
Le driver, lui, teste l'exe **packagé** (ce qu'on distribue).

## Hotkeys en jeu

`Ctrl+Alt+F` cycle les 5 formes (Minimal · Compact · Compétitif · Dashboard ·
Boost) · `Ctrl+Alt+T` thème · `Ctrl+Alt+1/2/3` playlist · `Ctrl+Alt+Flèches`
déplace (centre le ring Boost sur la jauge) · `Ctrl+Alt+R` reset W/L ·
`Ctrl+Alt+W` preview WIN · `Ctrl+Alt+G` preview rank up · `Ctrl+Alt+E` déclenche l'easter egg (son de défaite).

## Gotchas

- **Kill AVANT de packager.** L'exe en cours verrouille `app.asar`/`*.dll` dans
  `dist-pack` → `--overwrite` échoue ("processus ne peut pas accéder au fichier").
  Le driver kill en premier pour ça.
- **electron-builder cassé hors admin.** `npm run build` (target zip) plante sur
  l'extraction winCodeSign : `Cannot create symbolic link : Le client ne dispose
  pas d'un privilège nécessaire`. Soit activer le Mode Développeur Windows
  (Paramètres → Confidentialité → Développeurs), soit rester sur le driver
  (`@electron/packager`, pas de winCodeSign).
- **~11 process "RL Overlay".** Normal : Electron = main + renderers + GPU + le
  watcher PowerShell. `Stop-Process` les prend tous via le nom.
- **Overlay invisible.** Pas un bug : caché sauf si RocketLeague.exe est au
  premier plan. Lance RL ou `Ctrl+Alt+H`.
- **Config/session en userData.** `config.json`/`session.json` lus depuis
  `%APPDATA%\RL Overlay\` quand packagé (pas le dossier projet). Premier
  lancement sans pseudo → fenêtre de config.

## Troubleshooting

| Symptôme | Fix |
|---|---|
| `Cannot create symbolic link ... privilège nécessaire` | C'est electron-builder. Utiliser le driver (packager) ou activer le Mode Développeur. |
| `--overwrite` / fichier verrouillé pendant le packaging | Une instance tourne encore. Le driver kill en premier ; sinon `Get-Process "RL Overlay" \| Stop-Process -Force`. |
| exe lancé mais `Get-Process` vide | main.js a crashé au boot — voir `%APPDATA%\RL Overlay\overlay.log`. |
| Overlay ne s'affiche jamais en jeu | Vérifier RL en **Plein écran fenêtré (Borderless)** ; tester `Ctrl+Alt+H`. |
