---
name: test-suite
description: Lancer et écrire les tests de l'overlay RL (node:test natif). Utiliser pour "lance les tests", "npm test", "ajoute un test", faire du TDD sur lib/, ou diagnostiquer un test rouge. Mots-clés : "node --test", "test runner", "couverture lib", "tester momentum/goals/insights".
---

# Test Suite

Runner : **node:test natif** (`node --test`, aucun framework externe). `package.json` → `"test": "node --test"`. Tests dans `test/*.test.js`, ciblent les modules purs de `lib/`.

## Lancer

```bash
npm test                          # toute la suite
node --test test/momentum.test.js # un fichier
node --test --test-name-pattern="winrate"  # par nom
```

## Carte test → module

| Test | Couvre |
|---|---|
| `smoke.test.js` | sanity du runner |
| `momentum.test.js` | `lib/momentum.js` |
| `promotion.test.js` | `lib/promotion.js` |
| `heuristics.test.js` | consistency/confidence/tilt |
| `insights.test.js` | phrases auto + `dayKeyOf` |
| `daily.test.js` | défi quotidien seedé |
| `goals.test.js` | objectifs |
| `history.test.js` / `history-records.test.js` | `recordSample`, records |
| `history-store.test.js` | load/save JSON, BOM, validation |
| `viewmodel.test.js` | agrégation finale |

## Forme d'un test

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { momentum } = require('../lib/momentum');

test('7 wins sur 10 => hot', () => {
  const events = Array.from({length:10}, (_,i)=>({win: i<7, delta: 5, ts: i, mmr: 1000}));
  assert.strictEqual(momentum(events).form, 'hot');
});
```

## TDD (obligatoire pour nouvelle logique lib/)

Voir aussi skill `superpowers:test-driven-development`.
1. Écrire le test rouge.
2. Code minimal → vert.
3. Refactor, suite verte.

## Gotchas

- Modules lib/ **purs** → pas besoin de mocker Electron. Si un nouveau module require `electron`, il sort de la zone testable : le garder pur.
- Construire les `events` à la main dans les tests (`{ts, mmr, win, delta}`), ne pas dépendre de tracker.gg.
- `dayKeyOf` est en heure **locale** : un test qui hardcode une date UTC peut flotter selon le fuseau — tester via timestamps relatifs.
