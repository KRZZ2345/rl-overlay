---
name: debug-overlay
description: Diagnostiquer un bug runtime de l'overlay RL (Electron) — crash au boot, overlay invisible, IPC muet, config/session corrompue, Discord RPC. Utiliser pour "l'overlay crashe", "rien ne s'affiche", "ça plante au lancement", "le HUD est figé", "où sont les logs". Mots-clés : "overlay.log", "userData", "IPC", "globalShortcut", "crash boot", "config.json".
---

# Debug Overlay (runtime)

Pour tout bug runtime, suivre `superpowers:systematic-debugging`. Ce skill = les emplacements et réflexes spécifiques à l'overlay.

## Emplacements (app packagée)

Tout en **userData** = `%APPDATA%\RL Overlay\` (pas le dossier projet) :
- `overlay.log` — **premier endroit à lire** si crash boot.
- `config.json` — pseudo/plateforme/playlist/placement.
- `session.json` — W/L de session.
- `history.json` — events MMR (state du pipeline).

En `npm start` (sources) : userData reste le même chemin `%APPDATA%\RL Overlay\`.

## Arbre de diagnostic

| Symptôme | Cause probable | Fix |
|---|---|---|
| exe lancé, `Get-Process "RL Overlay"` vide | crash boot main.js | lire `overlay.log` |
| overlay jamais visible | caché sauf RL au focus (attendu) | lancer RL en Borderless, ou `Ctrl+Alt+H` |
| HUD figé / chiffres vides | scrape tracker.gg KO | skill `tracker-api`, vérifier log + config |
| chiffres faux | logique pipeline | skill `stats-pipeline` + tests |
| config ignorée | lue depuis userData, pas le projet | éditer `%APPDATA%\RL Overlay\config.json` |
| 1er lancement → fenêtre config | pas de pseudo | normal, voir `setup.html` |
| Discord RPC absent | `discord.clientId` vide | renseigner clientId (README) |

## Process

- Electron = **~11 process "RL Overlay"** (main + renderers + GPU + watcher PowerShell). Normal.
- Le watcher PowerShell lit `GetForegroundWindow` chaque seconde → décide visibilité.
- Hotkeys via `globalShortcut` (main.js). Si une hotkey ne répond pas : conflit global Windows, ou app pas au premier plan au boot.

## Réflexes

1. Reproduire, lire `overlay.log` AVANT de toucher au code.
2. Renderer figé → ouvrir DevTools du renderer (vérifier erreurs JS / IPC).
3. Config suspecte → la valider/réinitialiser dans userData, pas dans le repo.
4. Ne jamais commit `config.json`/`session.json` (gitignore + exclus du build).
