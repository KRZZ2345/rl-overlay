---
name: stats-pipeline
description: Comprendre et modifier le pipeline de stats de l'overlay RL (lib/). Utiliser pour toucher au calcul MMR/streak/momentum/insights/goals/daily, ajouter une métrique, déboguer un chiffre faux dans le HUD, ou comprendre comment un échantillon devient un ViewModel. Mots-clés : "momentum", "winrate", "promotion", "tilt", "consistency", "daily challenge", "goals", "viewmodel", "history".
---

# Stats Pipeline (lib/)

Tout le calcul vit dans `lib/`, pur JS sans Electron (testable hors app).
Flux : un échantillon MMR brut → `recordSample` → `state` persisté → `buildViewModel` → objet rendu par `index.html`.

## Flux de données

```
tracker.js (MMR brut)
  → main.js poll
  → lib/history.recordSample(state, {mmr, win, delta, ts})   // pousse event, maj daily/records, cap 500
  → lib/history-store.saveHistory(path, state)               // JSON dans userData
  → lib/viewmodel.buildViewModel(state, mmr, cfg)            // agrège tout
  → index.html (renderer) affiche
```

## Carte des modules

| Module | Rôle | Sortie clé |
|---|---|---|
| `history.js` | état + `recordSample` | `{events[], daily{}, records{peakMmr,bestStreak,bestDayGain}}`, cap `MAX_EVENTS=500` |
| `history-store.js` | load/save JSON (userData) | tolère BOM, valide `version:1` + playlist sinon `emptyState` |
| `momentum.js` | forme sur N derniers (déf 10) | `{form:'hot'\|'stable'\|'struggling', label, wins, losses}` |
| `promotion.js` | distance division | `DIV_SIZE=100`, `avgWinGain` (fallback 9), `promotion()` |
| `heuristics.js` | `consistencyScore`/`confidence`/`tilt` | écart-type des `delta` sur N |
| `insights.js` | phrases auto + `dayKeyOf(ts)` | clé jour locale `YYYY-MM-DD` |
| `daily.js` | défi du jour (seedé par date) | `DAILY_TEMPLATES`, metric pilote la progression |
| `goals.js` | objectifs long terme | `DEFAULT_GOALS`, `evaluateGoals(ctx)` |
| `viewmodel.js` | agrège tout le reste | ViewModel final |

## Règles

- **Tout module lib/ reste pur** (pas de `require('electron')`, pas d'I/O sauf history-store). C'est ce qui rend les tests rapides.
- **Un event** = `{ts, mmr, win, delta}`. `delta` peut être négatif. `daily[dayKey] = {start, end}`.
- **`dayKeyOf` doit matcher `today()` de main.js** (heure locale, pas UTC) sinon les défis daily se décalent.
- Modifier un seuil (ex. momentum `wins>=7`) → mettre à jour le test correspondant **avant** (voir skill `test-suite`).

## Ajouter une métrique

1. Écrire la fn pure dans le module adéquat (ou nouveau `lib/x.js`).
2. Test `test/x.test.js` d'abord (TDD, voir `test-suite`).
3. Brancher dans `viewmodel.js` (import + champ de sortie).
4. Consommer le champ dans `index.html`.
5. `npm test` vert.

## Gotchas

- `events` cappé à 500 → les records (`peakMmr`, `bestStreak`) sont sur le **state**, pas recalculables depuis `events` seuls. Ne pas les dériver à la volée.
- `promotion` suppose divisions de 100 MMR — **approximation** documentée, la vraie taille varie par rang.
- `history-store` retourne `emptyState` si la playlist du fichier ≠ playlist courante → changer de playlist repart de zéro (attendu).
