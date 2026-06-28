---
name: release-build
description: Packager et distribuer l'overlay RL (zip Windows distribuable). Utiliser pour "fais une release", "génère le zip", "package l'app", "build distribuable", "prépare la distribution", bump de version. Mots-clés : "electron-builder", "@electron/packager", "dist", "zip", "winCodeSign", "release".
---

# Release Build

But : produire le **zip distribuable** vérifié dans `dist\`. Le cycle build+run complet est piloté par le skill **`run-rl-overlay`** (driver `.claude\skills\run-rl-overlay\build-run.ps1`). Ce skill = focus distribution/release.

## Build distribuable

```powershell
# release complète : kill, package, zip, re-dézip (validation), relance
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-rl-overlay\build-run.ps1"
```

Produit : `dist\RL-Overlay-win-x64.zip` (~114 MB) + `dist\app\` (extraction vérifiée).

## Checklist release

1. `npm test` vert (skill `test-suite`).
2. Bump `version` dans `package.json`.
3. Run du driver SANS `-NoZip` (zip + ré-extraction = valide l'artefact réel).
4. Lancer l'exe **extrait du zip** (`dist\app\RL Overlay.exe`), pas le build brut → confirme ce qu'on distribue.
5. Confirmer process vivant + aucune fenêtre d'erreur.

## Ce qui est exclu du package

`package.json > build.files` exclut `dist/**`, `config.json`, `session.json`. Vérifier qu'aucun secret/perso (pseudo, config) ne fuite dans le zip.

## Gotchas (critiques)

- **electron-builder cassé hors admin.** `npm run build` plante sur winCodeSign : `Cannot create symbolic link : Le client ne dispose pas d'un privilège nécessaire`. → utiliser le driver (`@electron/packager`, pas de winCodeSign), ou activer le Mode Développeur Windows.
- **Kill AVANT de packager.** Une instance en cours verrouille `app.asar`/`*.dll` → `--overwrite` échoue. Le driver kill d'abord.
- Le zip fait ~114 MB (Electron complet) — attendu, pas un problème.
- Toujours tester l'exe **dézippé**, pas `dist-pack` brut, pour attraper les soucis d'empaquetage.
