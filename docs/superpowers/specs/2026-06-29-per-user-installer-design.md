# Design — Installeur per-user (NSIS) + intégration release

Date : 2026-06-29
Statut : validé (build NSIS testé OK) → implémentation

## But
Distribuer RL Overlay via un **installeur .exe per-user** (→ `%LOCALAPPDATA%\Programs\
RL Overlay`, writable, **zéro admin**) au lieu d'un zip que l'utilisateur dézippe (souvent
dans Program Files → auto-update cassé sans admin). Règle le problème à la racine.

## Validé
`electron-builder --win nsis`, `perMachine:false`, signature désactivée
(`CSC_IDENTITY_AUTO_DISCOVERY=false`, `signAndEditExecutable:false`) → produit
`dist/RL-Overlay-Setup-<version>.exe` (~84 Mo), oneClick, raccourcis + désinstalleur, sans
admin, sans winCodeSign. Build confirmé sur cette machine.

## Composants
1. **package.json `build`** : target `nsis`, `nsis.perMachine:false`, `oneClick:true`,
   `deleteAppDataOnUninstall:false` (garde config/historique), `artifactName` =
   `RL-Overlay-Setup-${version}.exe`. `files` exclut dist/dist-pack/docs/test/.claude.
2. **release.ps1** : après le zip (build-run.ps1, inchangé pour l'auto-update), build aussi
   le setup NSIS (`CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win nsis`) et
   **attache les DEUX** au `gh release` (zip + setup.exe).
3. **Updater (APPLY_UPDATE_PS)** : ajouter `/XF "Uninstall *.exe"` au robocopy /MIR pour ne
   PAS supprimer le désinstalleur NSIS lors d'une maj (sinon /MIR le retire car absent du zip).

## Distribution
- **Nouveaux** : téléchargent `RL-Overlay-Setup-x.y.z.exe` → install per-user, maj auto OK.
- **Auto-update** : inchangé — télécharge le `zip`, swap robocopy dans le dossier d'install
  (désormais toujours writable). Le setup n'intervient qu'à la 1re install.
- **Installs Program Files existantes** : élévation UAC (v1.2.2) ou réinstall via le setup.

## Compat updater ↔ install NSIS
Layout NSIS = `RL Overlay.exe` + `resources/` + dll à la racine (= sortie @electron/packager
du zip) → robocopy /MIR compatible. Seul l'`Uninstall RL Overlay.exe` est propre au NSIS →
préservé via `/XF`.

## Hors-scope
- Code-signing (certificat payant) — SmartScreen affichera un avertissement (normal, doc).
- Migration auto des installs Program Files (l'utilisateur réinstalle via le setup s'il veut).

## Vérification
1. `electron-builder --win nsis` produit le setup.exe (fait).
2. `node --test` vert.
3. Manuel (utilisateur) : lancer le setup → install dans LocalAppData → lance → maj auto.
