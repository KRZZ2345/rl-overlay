# RL Overlay — Design / Spec : Auto-update GitHub + skill release

Date : 2026-06-28
Statut : validé en brainstorming, prêt pour plan d'implémentation.

## 0. Contexte & contraintes

- App = Electron portable, packagée via **`@electron/packager` + zip manuel** (`build-run.ps1`), **pas** electron-builder (cassé hors admin : winCodeSign exige le privilège symlink Windows).
- Donc `electron-updater` (standard) est écarté : il attend des artefacts electron-builder (`latest.yml`, NSIS/Squirrel). On fait un **updater custom**.
- Pas de remote git à ce jour. Repo cible **public** (à créer). `gh` CLI pas encore installé.
- Décisions brainstorming : repo **public** · updater **custom (API Releases + zip)** · update **auto silencieuse, swap au prochain lancement** · publication via **gh CLI** · notes de release **auto-générées** · check **au boot uniquement** (pas de polling périodique).

## 1. Versioning & artefacts de release

- Source de vérité version = `package.json` `version` (semver `X.Y.Z`).
- 1 release GitHub = tag **`vX.Y.Z`** + 1 asset zip nommé **exactement `RL-Overlay-win-x64.zip`** (identique à la sortie de `build-run.ps1`). L'updater dépend de ce nom fixe.
- Pas de `latest.yml`. L'updater lit l'API publique `GET /repos/{owner}/{repo}/releases/latest` → `tag_name` + URL `browser_download_url` de l'asset.
- `owner`/`repo` codés en constante dans `lib/updater.js` (ou lus depuis un champ `repository` de `package.json`).

## 2. Module updater

### 2.1 `lib/updater.js` — logique pure (testable `node:test`)

Aucune dépendance Electron, aucune I/O. Exporte :

- `parseVersion(s)` → `{major, minor, patch}` ; tolère le préfixe `v`, ignore le suffixe pre-release (`-beta` etc.).
- `compareVersions(a, b)` → `-1 | 0 | 1`.
- `isNewer(remoteTag, currentVersion)` → `bool` (true si remote strictement > courant).
- `pickAsset(release, assetName)` → l'objet asset matchant `RL-Overlay-win-x64.zip`, ou `null`.

### 2.2 Câblage `main.js` — orchestration I/O

- Déclenché **une fois**, peu après le 1er poll réussi (jamais avant que l'overlay soit fonctionnel). Check au boot uniquement.
- `fetch` API latest avec **timeout court** (~5 s). Toute erreur (réseau, rate-limit, JSON, pas d'asset) = **échec silencieux total** : log dans `overlay.log`, aucune incidence sur l'app.
- Si `isNewer(tag, currentVersion)` ET `pickAsset` non nul :
  1. Télécharge l'asset → `%APPDATA%\RL Overlay\update\RL-Overlay-<ver>.zip`.
  2. Extrait → `%APPDATA%\RL Overlay\update\staged\`.
  3. **Vérifie** l'extraction : présence de `RL Overlay.exe` à la racine du staged. Échec → purge `update\`, abandon silencieux.
  4. Écrit le helper `%APPDATA%\RL Overlay\update\apply-update.ps1` (contenu statique, écrit depuis une string dans `main.js`).
  5. Écrit `%APPDATA%\RL Overlay\update\pending.json` = `{ "version": "X.Y.Z", "stagedDir": "<abs path>" }` **en dernier** (sa présence = signal "prêt à swapper", donc écrit après que tout le reste est en place).
  6. **Ne touche à rien d'autre** pendant la session : zéro toast, zéro relance, zéro interruption.

## 3. Swap au prochain lancement (auto-silencieux)

Problème : l'app est un dossier portable ; l'exe en cours verrouille ses fichiers → auto-écrasement à chaud impossible.

Mécanisme :

- **Tout premier traitement au boot** de `main.js` (avant de créer les fenêtres) : si `update\pending.json` existe →
  1. spawn un helper PowerShell **détaché** (`spawn(..., { detached: true, stdio: 'ignore' }).unref()`),
  2. `app.quit()` immédiat.
- Le helper (`update\apply-update.ps1`, écrit lors du staging — cf. §2.2) :
  1. attend la fin du process parent (par PID, ou retry sur verrou de l'exe),
  2. `robocopy <stagedDir> <installDir> /MIR` où `installDir = dirname(process.execPath)`,
  3. supprime `staged\` + `pending.json`,
  4. relance `RL Overlay.exe`.
- **Atomicité du nettoyage** : `pending.json`/`staged` ne sont supprimés qu'**après** un robocopy réussi. Échec du swap → l'ancienne version reste intacte et retentera au prochain lancement (ou abandonnera proprement après N essais, à fixer dans le plan).

Effet utilisateur : il relance l'app → bref flash → la nouvelle version démarre. Jamais d'interruption en plein match (le swap n'arrive qu'au lancement, pas en session).

## 4. Skill release — `.claude/skills/release-github/`

Driver `release.ps1` (params `-Bump patch|minor|major` **ou** `-Version X.Y.Z`). Enchaîne :

1. **Garde-fous** : `gh` présent + `gh auth status` OK ; arbre git propre (`git status --porcelain` vide) ; remote `origin` présent.
2. **Bump** `package.json` (version).
3. **Build** le zip distribuable (chemin zip de `build-run.ps1`, `-NoLaunch`) → `dist\RL-Overlay-win-x64.zip`.
4. **Git** : `git commit -am "release: vX.Y.Z"` + `git tag vX.Y.Z` + `git push --follow-tags`.
5. **Release** : `gh release create vX.Y.Z "dist\RL-Overlay-win-x64.zip" --title "vX.Y.Z" --generate-notes`.

`SKILL.md` documente le flux, les pré-requis (gh, repo public), et les gotchas (nom d'asset figé, kill instance avant build, electron-builder évité). Ce skill **complète/remplace** le skill `release-build` existant (qui ne faisait que le zip local).

## 5. Setup une fois (hors code, manuel)

- `winget install GitHub.cli` → `gh auth login`.
- Créer le repo : `gh repo create <user>/rl-overlay --public --source=. --remote=origin --push`.
- `.gitignore` déjà correct (exclut `config.json`, `session.json`, `dist/`).

## 6. Tests

- `test/updater.test.js` (`node:test`) couvre `lib/updater.js` :
  - `parseVersion` : avec/sans `v`, suffixe pre-release ignoré.
  - `compareVersions` : égal, <, >, composantes multiples.
  - `isNewer` : remote >, =, < courant ; préfixe `v`.
  - `pickAsset` : asset présent / absent / nom non matchant.
- Download + extraction + swap = I/O réseau/FS → **vérification manuelle** documentée dans le skill (publier une vfausse release de test, lancer, confirmer le swap).

## 7. Hors périmètre (YAGNI)

- Pas de polling périodique en session (boot only).
- Pas de delta updates ni signature (zip complet, repo public).
- Pas d'UI de progression (silencieux).
- Pas de rollback automatique au-delà de "l'ancienne version survit si le swap échoue".
- Repo privé / tokens : exclu (repo public décidé).
