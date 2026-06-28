# Auto-update GitHub + skill release — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'overlay détecte une nouvelle release GitHub publique au boot, télécharge + stage le zip en fond, et l'applique au prochain lancement ; plus un skill `release-github` qui publie une release en une commande.

**Architecture:** Logique de version pure dans `lib/updater.js` (testée `node:test`). `main.js` orchestre les I/O : check API au 1er poll, download+extraction (PowerShell `Expand-Archive`), staging dans `userData\update\`, puis au boot suivant spawn d'un helper PowerShell détaché qui `robocopy` le staged sur le dossier d'install et relance l'exe. Publication via `gh` CLI piloté par `release.ps1`.

**Tech Stack:** Node.js CommonJS, `node:test` + `node:assert`, Electron 31 (`fetch` global, `child_process.spawn`), PowerShell (Expand-Archive, robocopy), `gh` CLI.

## Global Constraints

- **Aucune dépendance npm nouvelle.** `lib/` = JS pur, pas de `require('electron')` dans `lib/updater.js`.
- CommonJS (`module.exports` / `require`), cohérent avec `main.js` / `lib/*`.
- Plateforme **Windows uniquement** (Expand-Archive, robocopy, PowerShell, `.exe`).
- Repo GitHub **public**. Pas de token, pas d'auth pour le download.
- Asset de release nommé **exactement `RL-Overlay-win-x64.zip`** ; sa racine contient `RL Overlay.exe` (sortie de `build-run.ps1`).
- Updater actif **seulement si `app.isPackaged`** (en dev `npm start`, no-op : le dossier d'install = `node_modules/electron`).
- Check **au boot uniquement** (pas de polling périodique). Toute erreur réseau/FS = **échec silencieux** loggé dans `overlay.log`, jamais bloquant.
- Owner/repo lus depuis `package.json` `repository` (jamais codés en dur).

---

### Task 1: `lib/updater.js` — logique de version pure + tests

**Files:**
- Create: `lib/updater.js`
- Test: `test/updater.test.js`

**Interfaces:**
- Produces:
  - `parseVersion(s: string) → {major:number, minor:number, patch:number}` (tolère préfixe `v`, ignore suffixe pre-release après `-`)
  - `compareVersions(a: string, b: string) → -1 | 0 | 1`
  - `isNewer(remoteTag: string, currentVersion: string) → boolean`
  - `pickAsset(release: {assets?: Array<{name:string, browser_download_url:string}>}, assetName: string) → asset | null`
  - `repoSlug(pkg: {repository?: string|{url?:string}}) → string | null` (ex. `"owner/repo"`)

- [ ] **Step 1: Write the failing test**

Create `test/updater.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { parseVersion, compareVersions, isNewer, pickAsset, repoSlug } = require('../lib/updater');

test('parseVersion tolère v et pre-release', () => {
  assert.deepStrictEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3 });
  assert.deepStrictEqual(parseVersion('1.2.3-beta.1'), { major: 1, minor: 2, patch: 3 });
  assert.deepStrictEqual(parseVersion('2.0.0'), { major: 2, minor: 0, patch: 0 });
});

test('compareVersions ordonne correctement', () => {
  assert.strictEqual(compareVersions('1.0.0', '1.0.1'), -1);
  assert.strictEqual(compareVersions('1.2.0', '1.1.9'), 1);
  assert.strictEqual(compareVersions('1.0.0', '1.0.0'), 0);
  assert.strictEqual(compareVersions('2.0.0', '1.9.9'), 1);
});

test('isNewer : remote strictement supérieur seulement', () => {
  assert.strictEqual(isNewer('v1.1.0', '1.0.0'), true);
  assert.strictEqual(isNewer('1.0.0', '1.0.0'), false);
  assert.strictEqual(isNewer('v0.9.0', '1.0.0'), false);
});

test('pickAsset trouve par nom exact', () => {
  const rel = { assets: [
    { name: 'RL-Overlay-win-x64.zip', browser_download_url: 'http://x/z.zip' },
    { name: 'autre.txt', browser_download_url: 'http://x/a.txt' }
  ] };
  assert.strictEqual(pickAsset(rel, 'RL-Overlay-win-x64.zip').browser_download_url, 'http://x/z.zip');
  assert.strictEqual(pickAsset(rel, 'absent.zip'), null);
  assert.strictEqual(pickAsset({}, 'RL-Overlay-win-x64.zip'), null);
});

test('repoSlug parse les formats GitHub courants', () => {
  assert.strictEqual(repoSlug({ repository: 'github:foo/rl-overlay' }), 'foo/rl-overlay');
  assert.strictEqual(repoSlug({ repository: 'https://github.com/foo/rl-overlay.git' }), 'foo/rl-overlay');
  assert.strictEqual(repoSlug({ repository: { url: 'git@github.com:foo/rl-overlay.git' } }), 'foo/rl-overlay');
  assert.strictEqual(repoSlug({}), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/updater.test.js`
Expected: FAIL (`Cannot find module '../lib/updater'`).

- [ ] **Step 3: Write minimal implementation**

Create `lib/updater.js` :

```js
'use strict';

// Logique de version pure (pas d'I/O, pas d'Electron) -> testable node:test.

function parseVersion(s) {
  const clean = String(s).trim().replace(/^v/i, '').split('-')[0];
  const [major = 0, minor = 0, patch = 0] = clean.split('.').map((n) => parseInt(n, 10) || 0);
  return { major, minor, patch };
}

function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  for (const k of ['major', 'minor', 'patch']) {
    if (x[k] > y[k]) return 1;
    if (x[k] < y[k]) return -1;
  }
  return 0;
}

function isNewer(remoteTag, currentVersion) {
  return compareVersions(remoteTag, currentVersion) > 0;
}

function pickAsset(release, assetName) {
  const assets = (release && release.assets) || [];
  return assets.find((a) => a.name === assetName) || null;
}

function repoSlug(pkg) {
  let r = pkg && pkg.repository;
  if (!r) return null;
  if (typeof r === 'object') r = r.url || '';
  const m = String(r).match(/github(?::|\.com[/:])([\w.-]+\/[\w.-]+?)(?:\.git)?$/i);
  return m ? m[1] : null;
}

module.exports = { parseVersion, compareVersions, isNewer, pickAsset, repoSlug };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/updater.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/updater.js test/updater.test.js
git commit -m "feat: pure version/release logic in lib/updater"
```

---

### Task 2: `main.js` — appliquer un update en attente au boot

**Files:**
- Modify: `main.js` (ajout d'une constante helper + fonction `applyPendingUpdate`, branchée en tête de `app.whenReady`, `main.js:710`)

**Interfaces:**
- Consumes: `app`, `fs`, `path`, `spawn` (déjà importés en haut de `main.js`), `logFocus` (`main.js:498`).
- Produces: `applyPendingUpdate() → boolean` (true = un swap a été lancé, l'app doit quitter).

- [ ] **Step 1: Ajouter le contenu du helper PowerShell + la fonction**

Dans `main.js`, juste avant le bloc `// Empêche les doublons d'overlay` (`main.js:705`), insérer :

```js
// Helper de swap : attend la fin de l'app, mirroir le staged sur l'install, relance.
// robocopy /MIR : 0-7 = succès. On ne purge le staged/pending qu'après succès
// -> si le swap échoue, l'ancienne version survit et retentera au prochain boot.
const APPLY_UPDATE_PS = `param([int]$ParentPid,[string]$Staged,[string]$Install,[string]$Exe)
try { Wait-Process -Id $ParentPid -Timeout 30 -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Milliseconds 600
robocopy $Staged $Install /MIR /NFL /NDL /NJH /NJS /NC /NS | Out-Null
if ($LASTEXITCODE -lt 8) {
  $upd = Split-Path $Staged
  Remove-Item -Recurse -Force $Staged -ErrorAction SilentlyContinue
  Remove-Item -Force (Join-Path $upd 'pending.json') -ErrorAction SilentlyContinue
}
Start-Process -FilePath $Exe
`;

// Si un update est stagé, lance le helper détaché et signale qu'il faut quitter.
function applyPendingUpdate() {
  try {
    if (!app.isPackaged) return false; // en dev, l'install = node_modules/electron
    const dir = path.join(app.getPath('userData'), 'update');
    const pendingPath = path.join(dir, 'pending.json');
    if (!fs.existsSync(pendingPath)) return false;
    const { stagedDir } = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    const helper = path.join(dir, 'apply-update.ps1');
    if (!fs.existsSync(helper) || !stagedDir || !fs.existsSync(stagedDir)) return false;
    const exe = app.getPath('exe');
    const installDir = path.dirname(exe);
    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', helper,
      '-ParentPid', String(process.pid), '-Staged', stagedDir, '-Install', installDir, '-Exe', exe
    ], { detached: true, stdio: 'ignore' });
    child.unref();
    logFocus('applyPendingUpdate: helper lancé, quit pour swap');
    return true;
  } catch (e) {
    logFocus('applyPendingUpdate error: ' + e.message);
    return false;
  }
}
```

- [ ] **Step 2: Brancher en tête de whenReady**

Dans `main.js`, dans `app.whenReady().then(() => {` (`main.js:710`), insérer comme **toute première instruction** du callback (avant `if (process.platform === 'win32' ...`) :

```js
  // Avant tout : si un update est prêt, on le pose et on quitte (l'helper relance).
  if (applyPendingUpdate()) { app.quit(); return; }
```

- [ ] **Step 3: Vérifier le démarrage (dev = no-op)**

Run: `npm start`
Expected : l'app démarre normalement (en dev `app.isPackaged` est false → `applyPendingUpdate` retourne false immédiatement, aucun changement de comportement). Aucune erreur de syntaxe/module. Fermer avec Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add main.js
git commit -m "feat: apply staged update at boot via detached PS helper"
```

---

### Task 3: `main.js` — check + download + staging au 1er poll

**Files:**
- Modify: `main.js` (import `lib/updater` près des autres `require` `main.js:8` ; ajout `checkForUpdate`/`downloadAndStage`/`extractZip` ; appel en fin de `poll()` succès `main.js:279`)

**Interfaces:**
- Consumes: `isNewer`, `pickAsset`, `repoSlug` (Task 1) ; `fetch` (global Electron 31) ; `spawn`, `fs`, `path`, `app`, `logFocus`.
- Produces: écrit `userData\update\staged\`, `userData\update\apply-update.ps1`, `userData\update\pending.json` (consommés par Task 2).

- [ ] **Step 1: Importer le module updater**

Dans `main.js`, après `const { buildViewModel } = require('./lib/viewmodel');` (`main.js:9`), ajouter :

```js
const { isNewer, pickAsset, repoSlug } = require('./lib/updater');
```

- [ ] **Step 2: Ajouter les fonctions de check/download/staging**

Dans `main.js`, juste après la fonction `logFocus` (`main.js:505`), insérer :

```js
// ---- Auto-update (check au 1er poll, staging en fond, swap au prochain boot) ----
let updateChecked = false;

function extractZip(zip, dest) {
  return new Promise((resolve, reject) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`], { stdio: 'ignore' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('unzip exit ' + c))));
    p.on('error', reject);
  });
}

async function downloadAndStage(url, version) {
  const dir = path.join(app.getPath('userData'), 'update');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, `RL-Overlay-${version}.zip`);
  const res = await fetch(url, { headers: { 'User-Agent': 'rl-overlay' } });
  if (!res.ok) throw new Error('download ' + res.status);
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  const stagedDir = path.join(dir, 'staged');
  await extractZip(zipPath, stagedDir);
  if (!fs.existsSync(path.join(stagedDir, 'RL Overlay.exe'))) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error('staged exe manquant');
  }
  fs.writeFileSync(path.join(dir, 'apply-update.ps1'), APPLY_UPDATE_PS);
  fs.writeFileSync(path.join(dir, 'pending.json'), JSON.stringify({ version, stagedDir }));
  logFocus('update stagé: ' + version);
}

async function checkForUpdate() {
  if (updateChecked || !app.isPackaged) return;
  updateChecked = true;
  try {
    const pkg = require('./package.json');
    const slug = repoSlug(pkg);
    if (!slug) return;
    const res = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'rl-overlay' }
    });
    if (!res.ok) return;
    const rel = await res.json();
    if (!isNewer(rel.tag_name, pkg.version)) return;
    const asset = pickAsset(rel, 'RL-Overlay-win-x64.zip');
    if (!asset) return;
    await downloadAndStage(asset.browser_download_url, rel.tag_name.replace(/^v/i, ''));
  } catch (e) {
    logFocus('checkForUpdate: ' + e.message);
  }
}
```

- [ ] **Step 3: Déclencher au 1er poll réussi**

Dans `main.js`, dans `poll()`, juste après `saveHistory(HISTORY_PATH, history);` (`main.js:279`), ajouter :

```js
      checkForUpdate(); // une seule fois, en fond, jamais bloquant
```

- [ ] **Step 4: Vérifier le démarrage**

Run: `npm start`
Expected : démarre sans erreur. En dev `checkForUpdate` retourne immédiatement (`!app.isPackaged`). Aucune requête réseau, aucun fichier `update\`. Fermer avec Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat: check GitHub releases and stage update on first poll"
```

---

### Task 4: Skill `release-github` + setup repo public

**Files:**
- Create: `.claude/skills/release-github/release.ps1`
- Create: `.claude/skills/release-github/SKILL.md`
- Modify: `package.json` (champ `repository`, défini au setup)
- Delete: `.claude/skills/release-build/SKILL.md` (remplacé ; voir Step 6)

**Interfaces:**
- Consumes: `build-run.ps1` (`.claude/skills/run-rl-overlay/build-run.ps1`), `gh` CLI, `git`.
- Produces: une GitHub Release `vX.Y.Z` avec l'asset `RL-Overlay-win-x64.zip`.

- [ ] **Step 1: Écrire le driver release.ps1**

Create `.claude/skills/release-github/release.ps1` :

```powershell
param(
  [ValidateSet('patch','minor','major')] [string]$Bump = 'patch',
  [string]$Version
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."  # racine projet rl-overlay
Set-Location $root

# 1. Garde-fous
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "gh CLI absent. winget install GitHub.cli" }
gh auth status *> $null; if ($LASTEXITCODE -ne 0) { throw "gh non authentifié. gh auth login" }
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

# 5. GitHub Release (notes auto-générées)
gh release create "v$new" $zip --title "v$new" --generate-notes
Write-Host "Release v$new publiée."
```

- [ ] **Step 2: Écrire SKILL.md**

Create `.claude/skills/release-github/SKILL.md` :

```markdown
---
name: release-github
description: Publie une release de l'overlay RL sur GitHub (bump version, build zip, tag, push, gh release) — alimente l'auto-update in-app. Utiliser pour "fais une release", "publie une nouvelle version", "release patch/minor/major", "déploie l'update". Mots-clés : "release", "gh release", "auto-update", "publier version", "tag".
---

# Release GitHub

Publie une release versionnée + l'asset `RL-Overlay-win-x64.zip`. L'overlay installé
la détecte au boot (cf. `lib/updater.js` + `main.js`) et l'applique au prochain lancement.

## Pré-requis (une fois)

- `winget install GitHub.cli` puis `gh auth login`.
- Repo **public** créé + remote `origin` :
  ```powershell
  gh repo create rl-overlay --public --source=. --remote=origin --push
  ```
- `package.json` champ `repository` = le slug créé (l'updater le lit) :
  ```powershell
  $slug = gh repo view --json nameWithOwner -q .nameWithOwner
  $pkg = Get-Content package.json -Raw | ConvertFrom-Json
  $pkg | Add-Member -NotePropertyName repository -NotePropertyValue "github:$slug" -Force
  ($pkg | ConvertTo-Json -Depth 20) | Set-Content package.json -Encoding utf8
  ```

## Publier

```powershell
powershell -ExecutionPolicy Bypass -File ".claude\skills\release-github\release.ps1" -Bump patch
```

`-Bump patch|minor|major` (défaut patch) **ou** `-Version X.Y.Z`. Le driver : garde-fous
(gh/auth/arbre propre/remote) → bump → build zip (`build-run.ps1 -NoLaunch`) → commit +
tag `vX.Y.Z` + push → `gh release create --generate-notes`.

## Gotchas

- **Nom d'asset figé** : `RL-Overlay-win-x64.zip`. L'updater matche ce nom exact ; ne pas renommer.
- **Racine du zip** = `RL Overlay.exe` directement (sortie `build-run.ps1`). L'updater vérifie sa présence avant de stager.
- **electron-builder évité** (winCodeSign/admin cassé). On reste sur `@electron/packager` + zip via `build-run.ps1`.
- **Repo public obligatoire** : l'updater télécharge sans auth.
- **Arbre git doit être propre** avant release (le driver refuse sinon).
- Tester l'auto-update : publier une version > l'installée, lancer l'exe packagé, vérifier `%APPDATA%\RL Overlay\update\pending.json`, relancer → nouvelle version.
```

- [ ] **Step 3: Setup repo (manuel, une fois)**

Exécuter les commandes de la section « Pré-requis » du SKILL.md (install gh, `gh auth login`, `gh repo create`, set `repository`). Vérifier :

Run: `gh repo view --json nameWithOwner -q .nameWithOwner`
Expected : affiche `<owner>/rl-overlay`.

Run: `node -p "require('./package.json').repository"`
Expected : `github:<owner>/rl-overlay`.

- [ ] **Step 4: Vérifier que les tests passent toujours**

Run: `npm test`
Expected : toute la suite verte (dont `test/updater.test.js`).

- [ ] **Step 5: Commit du skill + repository**

```bash
git add .claude/skills/release-github package.json
git commit -m "feat: release-github skill + repository field for updater"
```

- [ ] **Step 6: Retirer l'ancien skill release-build**

L'ancien `release-build` ne faisait que le zip local ; `release-github` le couvre et publie. Supprimer pour éviter le doublon :

```bash
git rm -r .claude/skills/release-build
git commit -m "chore: drop release-build skill (superseded by release-github)"
```

- [ ] **Step 7: Première release de validation**

```powershell
powershell -ExecutionPolicy Bypass -File ".claude\skills\release-github\release.ps1" -Bump patch
```

Expected : `Release vX.Y.Z publiée.` puis `gh release view vX.Y.Z` montre l'asset `RL-Overlay-win-x64.zip`.

---

## Notes d'exécution

- **Tâches 1-3** = code, testables/lancables en dev. **Tâche 4** = skill + actions GitHub réelles (création repo, publication) → nécessite `gh` et touche un service externe ; demander confirmation avant Step 7 (publication).
- Le flux complet d'auto-update (download/extract/swap réel) n'est validable qu'avec **deux releases packagées** (manuel, documenté dans le SKILL.md). Les parties pures sont couvertes par `test/updater.test.js`.
