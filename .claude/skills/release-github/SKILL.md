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
  Tant que `repository` n'est pas défini, l'updater est inerte (`repoSlug` renvoie `null`,
  `checkForUpdate` sort tôt) — aucun crash, juste pas d'auto-update.

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
