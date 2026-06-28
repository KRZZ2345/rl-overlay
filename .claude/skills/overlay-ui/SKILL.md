---
name: overlay-ui
description: Éditer le rendu de l'overlay RL (index.html) — formes HUD, thèmes, layouts, hotkeys, animations win/rank-up. Utiliser pour "change l'apparence", "ajoute une forme HUD", "modifie le thème", "le HUD affiche mal X", "déplace/redimensionne un élément", "ajoute une animation". Mots-clés : "theme", "layout", "forme", "Esports HUD", "click-through", "anchor".
---

# Overlay UI (index.html)

L'overlay = `index.html` (renderer Electron, ~37 ko, HTML+CSS+JS inline) + `theme-v2.css`. Reçoit le ViewModel via IPC (`preload.js`), zéro framework. Fenêtre transparente, click-through, posée au-dessus de RL.

## Anatomie

- `index.html` : structure HUD + CSS des thèmes/layouts + JS de rendu du ViewModel.
- `theme-v2.css` : styles partagés v2.
- `preload.js` : pont IPC main↔renderer (expose le ViewModel au DOM).
- Config de placement : `config.overlay = {anchor, marginX, marginY, x, y, clickThrough, theme, layout}` (voir `DEFAULT_CONFIG` dans `main.js`).

## Concepts

- **5 formes HUD** (`layout` 0-4 selon DEFAULT) : Minimal · Compact · Compétitif · Dashboard · Boost. Cyclées en jeu par `Ctrl+Alt+F`.
- **8 thèmes** (`theme` index) : `Ctrl+Alt+T`.
- **Boost form** : le ring se centre sur la jauge de boost RL → le placement (`Ctrl+Alt+Flèches`) compte.
- Animations : preview WIN (`Ctrl+Alt+W`), rank-up (`Ctrl+Alt+G`), easter egg son défaite (`Ctrl+Alt+E`).

## Workflow d'édition

1. Itérer vite : `npm start` (sources, pas de rebuild) — voir skill `run-rl-overlay`.
2. L'overlay est **caché sauf si RocketLeague.exe a le focus**. Pour voir le rendu hors jeu : hotkey `Ctrl+Alt+H` (force l'affichage).
3. Modifier index.html, recharger (relancer `npm start` ou DevTools reload).
4. Valider le rendu (screenshot via skill `run-rl-overlay`).

## Gotchas

- **Source de vérité du data = ViewModel** (`lib/viewmodel.js`). Pour afficher un nouveau chiffre, l'ajouter d'abord au ViewModel (skill `stats-pipeline`), pas le calculer dans le HTML.
- **Click-through** : la fenêtre laisse passer les clics. Tester en jeu, pas juste sur le bureau.
- CSS/JS **inline** dans index.html → pas de hot-reload auto, recharger le renderer.
- Garder les index `theme`/`layout` cohérents avec les bornes de cycle des hotkeys (sinon `Ctrl+Alt+F/T` saute ou crash le modulo).
- Ne pas casser les sélecteurs lus par le JS de rendu en renommant des ids/classes.
