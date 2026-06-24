# RL Overlay V2 — Design / Spec : surfaces de rendu (HUD f5 + Hub)

Date : 2026-06-25
Statut : validé en brainstorming, prêt pour plans d'implémentation (Plan 2 = HUD, Plan 3 = Hub).

Addendum au spec `2026-06-24-rl-overlay-v2-design.md`. Ce document fige l'**architecture de câblage** des deux surfaces visuelles (le "comment construire", là où le spec V2 décrivait le "quoi afficher"). Il ne réécrit pas les features (cf. spec V2 §6 HUD, §7 Hub, §5 skin, §8 composants) ; il décide leur implémentation.

## 1. Dépendance

Les deux surfaces **dépendent du Plan 1** (couche données : `lib/history`, `lib/momentum`, `lib/promotion`, `lib/heuristics`, `lib/insights`, `lib/history-store`). Plan 1 s'implémente en premier. Plans 2 et 3 ne consomment que ces modules purs via le view-model (cf. §3).

## 2. Les deux surfaces — câblage fenêtre

### HUD in-game
- Réutilise le `BrowserWindow` click-through, always-on-top, visible seulement quand RL a le focus (`main.js:163`). **Inchangé.**
- Nouvelle form **`f5`** ajoutée dans `index.html` aux côtés de f0-f4.
- `f5` devient la **forme par défaut au premier lancement** (vitrine V2). f0-f4 restent disponibles via le cycle `Ctrl+Alt+F`.
- Persistance du layout choisi : mécanisme existant (`config.json` / cycle layout) — `f5` rejoint simplement la liste des layouts cyclables, valeur par défaut = `f5`.

### Hub plein écran
- **Nouveau `BrowserWindow` focusable** (pas click-through, pas always-on-top imposé) chargeant un fichier dédié **`hub.html`**.
- **Cycle de vie lazy** : créé au toggle d'ouverture, **détruit (`close`/`destroy`) à la fermeture**. Zéro coût RAM tant que non ouvert → footprint nul en plein match. Coût de création (~100-200 ms) acceptable car le Hub s'ouvre en menu / replay / fin de match, pas en jeu.
- **Toggle = `Ctrl+Alt+Space`** (raccourci global, pattern maison `Ctrl+Alt+<x>`). `Ctrl+Alt+R` **n'est pas** utilisable (déjà `resetCurrent()`, `main.js:563`). Space évite toute collision avec les quick-chats lettres.
- Fermeture : re-presser `Ctrl+Alt+Space`, ou `Échap` quand le Hub a le focus.

## 3. Flux de données — source unique

- `main.js` détient l'état `history` (Plan 1) et est le **seul** à appeler les modules `lib/`.
- À chaque cycle utile, `main.js` produit **un seul view-model** (objet JS plat) et le **push par IPC** vers **les fenêtres actuellement ouvertes** (HUD et/ou Hub).
- **Quand pousser** :
  - à chaque poll (15 s, RL au focus) → met à jour HUD et Hub si ouverts ;
  - **à l'ouverture du Hub** → push immédiat du dernier view-model connu, pour ne jamais afficher du vide en attendant le prochain poll.
- Les renderers (`index.html`, `hub.html`) sont des **bêtes d'affichage** : ils reçoivent le view-model et peignent. **Aucun calcul métier côté renderer.** Pas de `require('./lib/...')` dans les renderers → pas de duplication, pas de divergence.

### Forme du view-model (contrat main → renderers)

```js
{
  rank,                                  // { tier, division, playlist } pour Rank Shield + libellés
  mmr,                                   // MMR courant
  deltaSession,                          // +/- MMR depuis le début de session
  promotion: { pct, mmrToNext, matches },// lib/promotion
  momentum:  { results, wins, losses, form, label }, // lib/momentum (results = bool[] chrono)
  session:   { timeMs, wins, losses, mmrNet },        // session.json + deltas
  records:   { peak, gap, daysSince },   // lib/history records (gap = mmr - peak)
  insights,                              // lib/insights -> [{ icon, text }]
  heuristics:{ confidence, consistency, tilt }, // lib/heuristics (tilt = { tilted, reason })
  hot                                    // boolean : état "chaud" -> embrasement Octane
}
```

- **HUD f5** consomme le sous-ensemble glanceable (spec V2 §6) : `rank`, `mmr`, `deltaSession`, `promotion`, `momentum`, `session`, `hot`.
- **Hub** consomme **tout** (spec V2 §7, structure A "Profil vivant").
- `hot` est calculé une fois côté main (combinaison streak/forme/vélocité, cf. §8 spec) et piloté à l'identique sur les deux surfaces.

## 4. Skin partagé

- Tokens du spec V2 §5 extraits dans un **CSS commun `theme-v2.css`**, inclus par `index.html` **et** `hub.html`. Une seule source de vérité visuelle, zéro copier-coller de couleurs.
- L'état chaud = une **classe sur `<body>`** (ex. `body.hot`) pilotée par le champ `hot` du view-model, déclenchant l'embrasement / pulsation Octane (orange `--hot`→`--hot2`) sur les éléments concernés (pill streak, barre Boost, delta, bas de carte, dots). Au repos : classe absente → froid/minimal.
- Les animations restent **CSS pures** (spec V2 §9), respect du footprint sur le HUD.

## 5. Découpage en plans d'implémentation

- **Plan 2 — HUD V2** : `theme-v2.css` (skin partagé) + form `f5` dans `index.html` + émission du view-model HUD côté `main.js` + `f5` par défaut. Vérifiable via le skill `run-rl-overlay` (rendu en jeu).
- **Plan 3 — Hub** : `hub.html` + `BrowserWindow` lazy + raccourci `Ctrl+Alt+Space` + push view-model à l'ouverture + les bandes héros / pouls de session / journey / widgets (spec V2 §7-§8). Réutilise `theme-v2.css`.
- Ordre : **Plan 1 → Plan 2 → Plan 3**. Plan 3 réutilise le view-model et le skin posés en Plan 2.

## 6. Détails tranchés (clôture des hypothèses ouvertes spec V2 §12)

- Raccourci Hub : **`Ctrl+Alt+Space`** (et non `Alt+R`, en collision).
- Label barre orange : **"élan"** (défaut).
- Seuils MMR de division : `DIV_SIZE = 100` (approximation documentée) — figé en Plan 1 (`lib/promotion`).
- Bornes du store : event log **500**, snapshots quotidiens conservés (rétention 14 j exploitée pour les insights) — figé en Plan 1.

## 7. Hors périmètre (rappel)

Inchangé vs spec V2 §10 : pas de Clutch Index ni de métrique par-match, pas de backfill, historique = playlist sélectionnée seule. Les pistes V3 (spec V2 §11 : recap partageable, mode OBS, ghost/rival, sound design) restent hors V2.
