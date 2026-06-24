# RL Overlay V2 — Plan 1 : Couche données Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter l'overlay d'un store d'historique persistant (event log, snapshots quotidiens, records) et des modules de métriques dérivées (momentum, promotion, heuristiques, insights), entièrement testés, sans aucune dépendance externe.

**Architecture:** Modules de **logique pure** sous `lib/`, sans dépendance Electron, opérant sur des objets d'état JS simples (faciles à tester). Une fine couche de persistance lit/écrit un fichier `history.json` dans `userData`. Le poll existant (`main.js`) appellera ces modules ; cette intégration est la dernière tâche. Couche 1 = aucune UI.

**Tech Stack:** Node.js (CommonJS, comme le reste du projet), test runner intégré `node:test` + `node:assert` (zéro dépendance). Electron déjà présent.

## Global Constraints

- Aucune dépendance npm nouvelle. Modules `lib/` = JS pur, pas de `require('electron')`. (Verbatim spec : "aucune nouvelle source de données", projet "zero-dependency").
- CommonJS (`module.exports` / `require`), cohérent avec `main.js`, `tracker.js`, `discord-rpc.js`.
- Fichiers runtime jamais commités/packagés : `history.json` doit rejoindre `.gitignore` aux côtés de `session.json`.
- Périmètre historique = **playlist sélectionnée uniquement**.
- Pas de backfill : tout démarre à l'installation.
- Détection d'un "match" = transition de MMR entre deux polls (réutilise la logique `main.js:221-231`).
- Seuils MMR de division = **constantes approximatives** assumées (la division RL ne fait pas exactement 100 MMR partout ; on documente l'approximation).

---

## File Structure

- `lib/history.js` — état du store + `recordSample` (détection match, event log borné, snapshots quotidiens, records). Pur.
- `lib/momentum.js` — analyse des N derniers events (résultats + forme). Pur.
- `lib/promotion.js` — math de promotion (MMR restant, %, matchs estimés). Pur.
- `lib/heuristics.js` — consistency, confidence, tilt. Pur, étiquetés heuristiques.
- `lib/insights.js` — génération des phrases Smart Insights priorisées. Pur.
- `lib/history-store.js` — persistance fine : `loadHistory(filePath)` / `saveHistory(filePath, state)`. Seul module touchant `fs`.
- `main.js` — intégration : brancher `recordSample` dans le flux de poll.
- `test/*.test.js` — un fichier de test par module pur.
- `package.json` — script `test`.
- `.gitignore` — ajouter `history.json`.

---

### Task 1: Test runner + squelette

**Files:**
- Modify: `package.json` (ajout script `test`)
- Modify: `.gitignore` (ajout `history.json`)
- Create: `test/smoke.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: commande `npm test` fonctionnelle via `node --test`.

- [ ] **Step 1: Écrire un test smoke**

Create `test/smoke.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');

test('node:test runner fonctionne', () => {
  assert.strictEqual(1 + 1, 2);
});
```

- [ ] **Step 2: Ajouter le script test à package.json**

Dans `package.json`, dans `"scripts"`, ajouter la ligne `test` :

```json
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win zip",
    "test": "node --test"
  },
```

- [ ] **Step 3: Ajouter history.json au .gitignore**

Dans `.gitignore`, sous la ligne `session.json`, ajouter :

```
history.json
```

- [ ] **Step 4: Lancer le test**

Run: `npm test`
Expected: PASS — 1 test passing, "tests 1", "pass 1".

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore test/smoke.test.js
git commit -m "chore: add node:test runner and history.json gitignore"
```

---

### Task 2: `lib/history.js` — état vide + détection de match

**Files:**
- Create: `lib/history.js`
- Test: `test/history.test.js`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `emptyState(playlist: string) -> State`
    où `State = { version:1, playlist, lastMmr:null, events:[], daily:{}, records:{ peakMmr:null, peakTs:null, bestStreak:0, bestDayGain:0 } }`
    et `Event = { ts:number, mmrBefore:number, mmrAfter:number, delta:number, win:boolean }`
  - `recordSample(state, mmr, ts, dayKey) -> { state:State, event:Event|null }`
    Détecte un changement de MMR vs `state.lastMmr`. Premier échantillon : pose `lastMmr` sans créer d'event. Bornes : event log gardé aux **500 derniers**.

- [ ] **Step 1: Écrire les tests de base**

Create `test/history.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { emptyState, recordSample } = require('../lib/history');

test('emptyState renvoie une structure vide cohérente', () => {
  const s = emptyState('ranked-doubles');
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.playlist, 'ranked-doubles');
  assert.strictEqual(s.lastMmr, null);
  assert.deepStrictEqual(s.events, []);
  assert.deepStrictEqual(s.daily, {});
  assert.strictEqual(s.records.peakMmr, null);
  assert.strictEqual(s.records.bestStreak, 0);
});

test('premier échantillon ne crée pas d_event mais pose lastMmr', () => {
  let { state, event } = recordSample(emptyState('x'), 1000, 1000, '2026-06-24');
  assert.strictEqual(event, null);
  assert.strictEqual(state.lastMmr, 1000);
  assert.strictEqual(state.events.length, 0);
});

test('hausse de MMR crée un event win', () => {
  let { state } = recordSample(emptyState('x'), 1000, 1000, '2026-06-24');
  const r = recordSample(state, 1012, 2000, '2026-06-24');
  assert.strictEqual(r.event.win, true);
  assert.strictEqual(r.event.delta, 12);
  assert.strictEqual(r.event.mmrBefore, 1000);
  assert.strictEqual(r.event.mmrAfter, 1012);
  assert.strictEqual(r.state.events.length, 1);
  assert.strictEqual(r.state.lastMmr, 1012);
});

test('baisse de MMR crée un event loss', () => {
  let { state } = recordSample(emptyState('x'), 1000, 1000, '2026-06-24');
  const r = recordSample(state, 991, 2000, '2026-06-24');
  assert.strictEqual(r.event.win, false);
  assert.strictEqual(r.event.delta, -9);
});

test('MMR identique ne crée pas d_event', () => {
  let { state } = recordSample(emptyState('x'), 1000, 1000, '2026-06-24');
  const r = recordSample(state, 1000, 2000, '2026-06-24');
  assert.strictEqual(r.event, null);
  assert.strictEqual(r.state.events.length, 0);
});

test('event log borné à 500', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 0, '2026-06-24'));
  for (let i = 1; i <= 520; i++) {
    ({ state } = recordSample(state, 1000 + i, i, '2026-06-24'));
  }
  assert.strictEqual(state.events.length, 500);
  // le plus ancien gardé doit correspondre au 21e changement
  assert.strictEqual(state.events[0].mmrAfter, 1021);
  assert.strictEqual(state.events[499].mmrAfter, 1520);
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — "Cannot find module '../lib/history'".

- [ ] **Step 3: Implémenter le minimum**

Create `lib/history.js` :

```js
'use strict';

const MAX_EVENTS = 500;

function emptyState(playlist) {
  return {
    version: 1,
    playlist,
    lastMmr: null,
    events: [],
    daily: {},
    records: { peakMmr: null, peakTs: null, bestStreak: 0, bestDayGain: 0 }
  };
}

// Détecte un changement de MMR vs state.lastMmr. Pur : renvoie un nouvel état.
function recordSample(state, mmr, ts, dayKey) {
  const next = {
    ...state,
    events: state.events.slice(),
    daily: { ...state.daily },
    records: { ...state.records }
  };

  if (mmr == null) return { state: next, event: null };

  let event = null;
  if (next.lastMmr != null && mmr !== next.lastMmr) {
    event = {
      ts,
      mmrBefore: next.lastMmr,
      mmrAfter: mmr,
      delta: mmr - next.lastMmr,
      win: mmr > next.lastMmr
    };
    next.events.push(event);
    if (next.events.length > MAX_EVENTS) {
      next.events = next.events.slice(next.events.length - MAX_EVENTS);
    }
  }

  next.lastMmr = mmr;
  return { state: next, event };
}

module.exports = { emptyState, recordSample, MAX_EVENTS };
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npm test`
Expected: PASS — tous les tests history passent.

- [ ] **Step 5: Commit**

```bash
git add lib/history.js test/history.test.js
git commit -m "feat: history store with match detection and bounded event log"
```

---

### Task 3: `lib/history.js` — records + snapshots quotidiens

**Files:**
- Modify: `lib/history.js`
- Test: `test/history-records.test.js`

**Interfaces:**
- Consumes: `emptyState`, `recordSample` (Task 2).
- Produces: `recordSample` met désormais aussi à jour :
  - `state.records.peakMmr` / `peakTs` (max MMR jamais vu)
  - `state.records.bestStreak` (plus longue série de wins consécutifs vue)
  - `state.daily[dayKey] = { start, end }` (MMR de début et fin de journée)
  - `state.records.bestDayGain` (meilleur `end-start` sur une journée)

- [ ] **Step 1: Écrire les tests records/daily**

Create `test/history-records.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { emptyState, recordSample } = require('../lib/history');

test('peak suit le MMR maximum vu', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 1, 'd1'));
  ({ state } = recordSample(state, 1030, 2, 'd1'));
  ({ state } = recordSample(state, 1010, 3, 'd1'));
  assert.strictEqual(state.records.peakMmr, 1030);
  assert.strictEqual(state.records.peakTs, 2);
});

test('daily enregistre start et end de la journée', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 1, 'd1')); // start jour 1
  ({ state } = recordSample(state, 1012, 2, 'd1'));
  ({ state } = recordSample(state, 1025, 3, 'd1')); // end jour 1
  ({ state } = recordSample(state, 1030, 4, 'd2')); // start jour 2
  assert.strictEqual(state.daily.d1.start, 1000);
  assert.strictEqual(state.daily.d1.end, 1025);
  assert.strictEqual(state.daily.d2.start, 1030);
  assert.strictEqual(state.daily.d2.end, 1030);
});

test('bestDayGain = meilleur gain net sur une journée', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 1, 'd1'));
  ({ state } = recordSample(state, 1040, 2, 'd1')); // +40 sur d1
  ({ state } = recordSample(state, 1030, 3, 'd2'));
  ({ state } = recordSample(state, 1030, 4, 'd2'));
  assert.strictEqual(state.records.bestDayGain, 40);
});

test('bestStreak suit la plus longue série de wins', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 0, 'd1'));
  ({ state } = recordSample(state, 1010, 1, 'd1')); // W (streak 1)
  ({ state } = recordSample(state, 1020, 2, 'd1')); // W (streak 2)
  ({ state } = recordSample(state, 1030, 3, 'd1')); // W (streak 3)
  ({ state } = recordSample(state, 1020, 4, 'd1')); // L (reset)
  ({ state } = recordSample(state, 1030, 5, 'd1')); // W (streak 1)
  assert.strictEqual(state.records.bestStreak, 3);
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — assertions peak/daily/bestDayGain/bestStreak échouent (valeurs `null`/`0`).

- [ ] **Step 3: Étendre recordSample**

Dans `lib/history.js`, remplacer le corps de `recordSample` par cette version étendue (le reste du fichier inchangé) :

```js
function recordSample(state, mmr, ts, dayKey) {
  const next = {
    ...state,
    events: state.events.slice(),
    daily: { ...state.daily },
    records: { ...state.records }
  };

  if (mmr == null) return { state: next, event: null };

  let event = null;
  if (next.lastMmr != null && mmr !== next.lastMmr) {
    event = {
      ts,
      mmrBefore: next.lastMmr,
      mmrAfter: mmr,
      delta: mmr - next.lastMmr,
      win: mmr > next.lastMmr
    };
    next.events.push(event);
    if (next.events.length > MAX_EVENTS) {
      next.events = next.events.slice(next.events.length - MAX_EVENTS);
    }
  }

  // Snapshot quotidien (start/end).
  const day = next.daily[dayKey];
  if (!day) next.daily[dayKey] = { start: mmr, end: mmr };
  else next.daily[dayKey] = { start: day.start, end: mmr };

  // Records.
  if (next.records.peakMmr == null || mmr > next.records.peakMmr) {
    next.records.peakMmr = mmr;
    next.records.peakTs = ts;
  }
  const d = next.daily[dayKey];
  const dayGain = d.end - d.start;
  if (dayGain > next.records.bestDayGain) next.records.bestDayGain = dayGain;

  // bestStreak = plus longue série de wins consécutifs dans l'event log.
  let cur = 0, best = next.records.bestStreak;
  for (const e of next.events) {
    if (e.win) { cur += 1; if (cur > best) best = cur; }
    else cur = 0;
  }
  next.records.bestStreak = best;

  next.lastMmr = mmr;
  return { state: next, event };
}
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npm test`
Expected: PASS — tous les tests (history + history-records) passent.

- [ ] **Step 5: Commit**

```bash
git add lib/history.js test/history-records.test.js
git commit -m "feat: track peak, daily snapshots, best streak and best day gain"
```

---

### Task 4: `lib/momentum.js` — momentum + analyse de forme

**Files:**
- Create: `lib/momentum.js`
- Test: `test/momentum.test.js`

**Interfaces:**
- Consumes: `Event` (Task 2) — utilise `.win`.
- Produces:
  - `momentum(events: Event[], n=10) -> { results: boolean[], wins:number, losses:number, form:'hot'|'stable'|'struggling', label:string }`
    `results` = les N derniers `.win` (ordre chronologique). `form` : `wins>=7`→'hot', `wins>=5`→'stable', sinon 'struggling'. `label` : 'En feu' / 'Stable' / 'En difficulté'.

- [ ] **Step 1: Écrire les tests**

Create `test/momentum.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { momentum } = require('../lib/momentum');

const ev = (win) => ({ ts: 0, mmrBefore: 0, mmrAfter: 0, delta: 0, win });

test('liste vide = struggling, 0/0', () => {
  const m = momentum([], 10);
  assert.deepStrictEqual(m.results, []);
  assert.strictEqual(m.wins, 0);
  assert.strictEqual(m.form, 'struggling');
});

test('ne garde que les N derniers', () => {
  const events = Array.from({ length: 15 }, (_, i) => ev(i % 2 === 0));
  const m = momentum(events, 10);
  assert.strictEqual(m.results.length, 10);
});

test('7 wins sur 10 = hot / En feu', () => {
  const events = [true,true,false,true,true,false,true,true,false,true].map(ev);
  const m = momentum(events, 10);
  assert.strictEqual(m.wins, 7);
  assert.strictEqual(m.losses, 3);
  assert.strictEqual(m.form, 'hot');
  assert.strictEqual(m.label, 'En feu');
});

test('5 wins = stable', () => {
  const events = [true,false,true,false,true,false,true,false,true,false].map(ev);
  assert.strictEqual(momentum(events, 10).form, 'stable');
});

test('4 wins = struggling / En difficulté', () => {
  const events = [true,false,false,true,false,false,true,false,false,true].map(ev);
  const m = momentum(events, 10);
  assert.strictEqual(m.wins, 4);
  assert.strictEqual(m.form, 'struggling');
  assert.strictEqual(m.label, 'En difficulté');
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — "Cannot find module '../lib/momentum'".

- [ ] **Step 3: Implémenter**

Create `lib/momentum.js` :

```js
'use strict';

function momentum(events, n = 10) {
  const last = events.slice(Math.max(0, events.length - n));
  const results = last.map((e) => !!e.win);
  const wins = results.filter(Boolean).length;
  const losses = results.length - wins;

  let form, label;
  if (wins >= 7) { form = 'hot'; label = 'En feu'; }
  else if (wins >= 5) { form = 'stable'; label = 'Stable'; }
  else { form = 'struggling'; label = 'En difficulté'; }

  return { results, wins, losses, form, label };
}

module.exports = { momentum };
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/momentum.js test/momentum.test.js
git commit -m "feat: momentum analysis over last N matches"
```

---

### Task 5: `lib/promotion.js` — math de promotion

**Files:**
- Create: `lib/promotion.js`
- Test: `test/promotion.test.js`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `avgWinGain(events: Event[], fallback=9) -> number` — moyenne des `delta` des events `win` (arrondie), `fallback` si aucun win.
  - `promotion(mmr:number, avgGain:number, divSize=DIV_SIZE) -> { mmrToNext:number, pct:number, matchesNeeded:number }`
    Approximation : division = fenêtre fixe de `divSize` MMR. `mmrToNext` = MMR restant avant la prochaine frontière de division. `pct` = progression 0..100 dans la division courante. `matchesNeeded` = `ceil(mmrToNext / avgGain)`.
  - Constante exportée `DIV_SIZE = 100` (approximation documentée).

- [ ] **Step 1: Écrire les tests**

Create `test/promotion.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { avgWinGain, promotion, DIV_SIZE } = require('../lib/promotion');

const win = (delta) => ({ win: true, delta });
const loss = (delta) => ({ win: false, delta });

test('DIV_SIZE vaut 100 (approximation documentée)', () => {
  assert.strictEqual(DIV_SIZE, 100);
});

test('avgWinGain moyenne les gains des wins', () => {
  assert.strictEqual(avgWinGain([win(10), win(14), loss(-9)]), 12);
});

test('avgWinGain renvoie le fallback sans win', () => {
  assert.strictEqual(avgWinGain([loss(-9)], 9), 9);
});

test('promotion calcule restant/pct/matchs', () => {
  // mmr 1075, division courante = [1000,1100), restant = 25, pct = 75
  const p = promotion(1075, 12);
  assert.strictEqual(p.mmrToNext, 25);
  assert.strictEqual(p.pct, 75);
  assert.strictEqual(p.matchesNeeded, 3); // ceil(25/12)
});

test('promotion à la frontière basse de division', () => {
  const p = promotion(1000, 10);
  assert.strictEqual(p.mmrToNext, 100);
  assert.strictEqual(p.pct, 0);
  assert.strictEqual(p.matchesNeeded, 10);
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — "Cannot find module '../lib/promotion'".

- [ ] **Step 3: Implémenter**

Create `lib/promotion.js` :

```js
'use strict';

// Approximation : on traite chaque division comme une fenêtre fixe de 100 MMR.
// La vraie taille varie selon le rang ; documenté comme estimation.
const DIV_SIZE = 100;

function avgWinGain(events, fallback = 9) {
  const wins = events.filter((e) => e.win);
  if (wins.length === 0) return fallback;
  const sum = wins.reduce((a, e) => a + e.delta, 0);
  return Math.round(sum / wins.length);
}

function promotion(mmr, avgGain, divSize = DIV_SIZE) {
  const into = ((mmr % divSize) + divSize) % divSize; // position dans la division
  const mmrToNext = into === 0 ? divSize : divSize - into;
  const pct = Math.round((into / divSize) * 100);
  const g = avgGain > 0 ? avgGain : 1;
  const matchesNeeded = Math.ceil(mmrToNext / g);
  return { mmrToNext, pct, matchesNeeded };
}

module.exports = { avgWinGain, promotion, DIV_SIZE };
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/promotion.js test/promotion.test.js
git commit -m "feat: promotion progress math (mmr-to-next, pct, matches)"
```

---

### Task 6: `lib/heuristics.js` — consistency, confidence, tilt

**Files:**
- Create: `lib/heuristics.js`
- Test: `test/heuristics.test.js`

**Interfaces:**
- Consumes: `Event` (Task 2).
- Produces (tous étiquetés heuristiques) :
  - `consistencyScore(events, n=20) -> { score:number(0..100), grade:string }`
    score = `100 - min(100, écart-type des delta)` sur les N derniers ; grade : ≥85 'A+', ≥70 'A', ≥55 'B', ≥40 'C', sinon 'D'.
  - `confidence(events, n=10) -> number(0..100)` = `round(winrate*70 + min(streakWins,5)/5*30)` sur les N derniers (streakWins = wins consécutifs en fin de liste).
  - `tilt(events, n=5) -> { tilted:boolean, reason:string }` : tilted si ≥3 pertes dans les N derniers ET le dernier event est une perte.

- [ ] **Step 1: Écrire les tests**

Create `test/heuristics.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { consistencyScore, confidence, tilt } = require('../lib/heuristics');

const ev = (win, delta) => ({ win, delta });

test('consistency haute quand les deltas sont stables', () => {
  const events = Array.from({ length: 10 }, () => ev(true, 10));
  const c = consistencyScore(events);
  assert.strictEqual(c.score, 100);
  assert.strictEqual(c.grade, 'A+');
});

test('consistency basse quand les deltas varient fort', () => {
  const events = [ev(true, 50), ev(false, -50), ev(true, 50), ev(false, -50)];
  const c = consistencyScore(events);
  assert.ok(c.score < 60, 'score should be low, got ' + c.score);
});

test('confidence max sur 10 wins d_affilée', () => {
  const events = Array.from({ length: 10 }, () => ev(true, 10));
  assert.strictEqual(confidence(events), 100);
});

test('confidence basse sur 10 pertes', () => {
  const events = Array.from({ length: 10 }, () => ev(false, -10));
  assert.strictEqual(confidence(events), 0);
});

test('tilt détecté sur 3 pertes récentes finissant par une perte', () => {
  const events = [ev(true, 10), ev(false, -9), ev(false, -10), ev(true, 8), ev(false, -9)];
  const t = tilt(events);
  assert.strictEqual(t.tilted, true);
});

test('pas de tilt si le dernier est un win', () => {
  const events = [ev(false, -9), ev(false, -10), ev(false, -9), ev(true, 12)];
  assert.strictEqual(tilt(events).tilted, false);
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — "Cannot find module '../lib/heuristics'".

- [ ] **Step 3: Implémenter**

Create `lib/heuristics.js` :

```js
'use strict';

function stdev(nums) {
  if (nums.length === 0) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function consistencyScore(events, n = 20) {
  const last = events.slice(Math.max(0, events.length - n));
  const sd = stdev(last.map((e) => e.delta));
  const score = Math.round(100 - Math.min(100, sd));
  let grade;
  if (score >= 85) grade = 'A+';
  else if (score >= 70) grade = 'A';
  else if (score >= 55) grade = 'B';
  else if (score >= 40) grade = 'C';
  else grade = 'D';
  return { score, grade };
}

function confidence(events, n = 10) {
  const last = events.slice(Math.max(0, events.length - n));
  if (last.length === 0) return 0;
  const wins = last.filter((e) => e.win).length;
  const winrate = wins / last.length;
  let streak = 0;
  for (let i = last.length - 1; i >= 0 && last[i].win; i--) streak++;
  return Math.round(winrate * 70 + (Math.min(streak, 5) / 5) * 30);
}

function tilt(events, n = 5) {
  const last = events.slice(Math.max(0, events.length - n));
  const losses = last.filter((e) => !e.win).length;
  const lastIsLoss = last.length > 0 && !last[last.length - 1].win;
  const tilted = losses >= 3 && lastIsLoss;
  return { tilted, reason: tilted ? `${losses} défaites récentes — fais une pause` : '' };
}

module.exports = { consistencyScore, confidence, tilt };
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/heuristics.js test/heuristics.test.js
git commit -m "feat: consistency, confidence and tilt heuristics"
```

---

### Task 7: `lib/insights.js` — génération des Smart Insights

**Files:**
- Create: `lib/insights.js`
- Test: `test/insights.test.js`

**Interfaces:**
- Consumes: `State` (Task 2/3), `momentum` (Task 4), `promotion`+`avgWinGain` (Task 5).
- Produces:
  - `generateInsights(state, opts) -> Array<{ icon:string, text:string }>` où
    `opts = { dayKey:string, mmr:number, max:number=3 }`. Règles priorisées (on garde les `max` premières non nulles) :
    1. 🎯 promotion : "Promotion probable dans N victoires" si `promotion(mmr, avg).matchesNeeded <= 5`.
    2. 📈 au-dessus de la moyenne : "Tu joues X MMR au-dessus de ta moyenne" si `mmr - moyenne(daily.end) >= 5`.
    3. ⚡ winrate du jour : "X% de winrate aujourd'hui" si ≥1 event aujourd'hui (ts non dispo → on s'appuie sur `momentum` global ; voir note).
    4. 🔥 plus haute progression 14j : "Plus haute progression des 14 derniers jours" si le gain du jour égale le max des gains journaliers des 14 derniers jours et > 0.

  Note : les events ne portent pas le dayKey ; le winrate "du jour" se calcule via le `daily[dayKey]` (gain) et le `momentum` récent. On reste sur des règles calculables depuis `state`.

- [ ] **Step 1: Écrire les tests**

Create `test/insights.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { emptyState, recordSample } = require('../lib/history');
const { generateInsights } = require('../lib/insights');

function build(samples) {
  let state = emptyState('x');
  for (const [mmr, ts, day] of samples) ({ state } = recordSample(state, mmr, ts, day));
  return state;
}

test('insight promotion quand proche', () => {
  // mmr 1090 -> mmrToNext 10, avg ~10 -> 1 match
  const state = build([[1080, 1, 'd1'], [1090, 2, 'd1']]);
  const out = generateInsights(state, { dayKey: 'd1', mmr: 1090, max: 3 });
  assert.ok(out.some((i) => i.text.includes('Promotion')), JSON.stringify(out));
});

test('insight au-dessus de la moyenne', () => {
  // moyennes journalières basses, mmr courant nettement au-dessus
  const state = build([[900, 1, 'd1'], [905, 2, 'd1'], [950, 3, 'd2']]);
  const out = generateInsights(state, { dayKey: 'd2', mmr: 1000, max: 3 });
  assert.ok(out.some((i) => i.text.includes('au-dessus de ta moyenne')), JSON.stringify(out));
});

test('jamais plus de max insights', () => {
  const state = build([[1080, 1, 'd1'], [1095, 2, 'd1']]);
  const out = generateInsights(state, { dayKey: 'd1', mmr: 1095, max: 2 });
  assert.ok(out.length <= 2);
});

test('état vide ne casse pas', () => {
  const out = generateInsights(emptyState('x'), { dayKey: 'd1', mmr: 1000, max: 3 });
  assert.ok(Array.isArray(out));
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — "Cannot find module '../lib/insights'".

- [ ] **Step 3: Implémenter**

Create `lib/insights.js` :

```js
'use strict';

const { promotion, avgWinGain } = require('./promotion');

function dailyGains(daily) {
  return Object.keys(daily).map((k) => ({ day: k, gain: daily[k].end - daily[k].start }));
}

function generateInsights(state, opts) {
  const { dayKey, mmr, max = 3 } = opts;
  const out = [];

  // 1. Promotion proche.
  const avg = avgWinGain(state.events);
  const promo = promotion(mmr, avg);
  if (promo.matchesNeeded <= 5) {
    out.push({ icon: '🎯', text: `Promotion probable dans ${promo.matchesNeeded} victoire${promo.matchesNeeded > 1 ? 's' : ''}` });
  }

  // 2. Au-dessus de la moyenne des fins de journée.
  const ends = Object.keys(state.daily).map((k) => state.daily[k].end);
  if (ends.length > 0) {
    const avgEnd = ends.reduce((a, b) => a + b, 0) / ends.length;
    const diff = Math.round(mmr - avgEnd);
    if (diff >= 5) out.push({ icon: '📈', text: `Tu joues ${diff} MMR au-dessus de ta moyenne` });
  }

  // 3. Plus haute progression des 14 derniers jours.
  const gains = dailyGains(state.daily);
  const today = state.daily[dayKey];
  if (today) {
    const todayGain = today.end - today.start;
    const recent = gains.slice(-14).map((g) => g.gain);
    const maxGain = recent.length ? Math.max(...recent) : 0;
    if (todayGain > 0 && todayGain >= maxGain) {
      out.push({ icon: '🔥', text: 'Plus haute progression des 14 derniers jours' });
    }
  }

  return out.slice(0, max);
}

module.exports = { generateInsights };
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/insights.js test/insights.test.js
git commit -m "feat: smart insights generation from history state"
```

---

### Task 8: `lib/history-store.js` — persistance fichier

**Files:**
- Create: `lib/history-store.js`
- Test: `test/history-store.test.js`

**Interfaces:**
- Consumes: `emptyState` (Task 2).
- Produces:
  - `loadHistory(filePath, playlist) -> State` — lit le JSON ; si absent/corrompu ou `playlist` différente du fichier, renvoie `emptyState(playlist)`.
  - `saveHistory(filePath, state) -> void` — écrit le JSON formaté (`JSON.stringify(state, null, 2)`).

- [ ] **Step 1: Écrire les tests (avec fichier temporaire)**

Create `test/history-store.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadHistory, saveHistory } = require('../lib/history-store');
const { emptyState, recordSample } = require('../lib/history');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rlh-')), 'history.json');
}

test('load sur fichier absent renvoie un état vide', () => {
  const s = loadHistory(tmpFile(), 'ranked-doubles');
  assert.strictEqual(s.playlist, 'ranked-doubles');
  assert.deepStrictEqual(s.events, []);
});

test('save puis load round-trip', () => {
  const f = tmpFile();
  let { state } = recordSample(emptyState('x'), 1000, 1, 'd1');
  ({ state } = recordSample(state, 1010, 2, 'd1'));
  saveHistory(f, state);
  const loaded = loadHistory(f, 'x');
  assert.strictEqual(loaded.events.length, 1);
  assert.strictEqual(loaded.lastMmr, 1010);
});

test('playlist différente = état vide (pas de mélange)', () => {
  const f = tmpFile();
  saveHistory(f, emptyState('ranked-duel'));
  const loaded = loadHistory(f, 'ranked-doubles');
  assert.strictEqual(loaded.playlist, 'ranked-doubles');
  assert.deepStrictEqual(loaded.events, []);
});

test('JSON corrompu = état vide', () => {
  const f = tmpFile();
  fs.writeFileSync(f, '{ pas du json');
  const loaded = loadHistory(f, 'x');
  assert.strictEqual(loaded.playlist, 'x');
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — "Cannot find module '../lib/history-store'".

- [ ] **Step 3: Implémenter**

Create `lib/history-store.js` :

```js
'use strict';

const fs = require('fs');
const { emptyState } = require('./history');

function loadHistory(filePath, playlist) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
    const s = JSON.parse(raw);
    if (!s || s.version !== 1 || s.playlist !== playlist || !Array.isArray(s.events)) {
      return emptyState(playlist);
    }
    return s;
  } catch {
    return emptyState(playlist);
  }
}

function saveHistory(filePath, state) {
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

module.exports = { loadHistory, saveHistory };
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/history-store.js test/history-store.test.js
git commit -m "feat: history persistence (load/save with playlist guard)"
```

---

### Task 9: Intégration dans le poll de `main.js`

**Files:**
- Modify: `main.js` (imports en tête ; init au démarrage ; appel dans `poll()` autour de `main.js:255-267`)

**Interfaces:**
- Consumes: `loadHistory`, `saveHistory` (Task 8) ; `recordSample` (Task 2).
- Produces: à chaque poll, le MMR de la **playlist sélectionnée** est enregistré dans `history.json` (`userData`). Aucune sortie UI (consommée au Plan 2/3). Cette tâche se vérifie manuellement (app Electron, pas de test unitaire).

- [ ] **Step 1: Ajouter les imports et le chemin du fichier**

Dans `main.js`, après la ligne `const { DiscordRPC } = require('./discord-rpc');` (`main.js:6`), ajouter :

```js
const { loadHistory, saveHistory } = require('./lib/history-store');
const { recordSample } = require('./lib/history');
```

Après `const SESSION_PATH = path.join(app.getPath('userData'), 'session.json');` (`main.js:14`), ajouter :

```js
const HISTORY_PATH = path.join(app.getPath('userData'), 'history.json');
```

- [ ] **Step 2: Déclarer l'état history**

Après la ligne `let session;` (`main.js:82`), ajouter :

```js
let history; // état du store d'historique persistant (playlist sélectionnée)
```

- [ ] **Step 3: Brancher recordSample dans poll()**

Dans `main.js`, dans `poll()`, juste après la ligne `if (mmr == null) return;` (`main.js:263`), insérer :

```js
    // Enregistre le MMR de la playlist suivie dans l'historique persistant.
    if (!history || history.playlist !== sel) history = loadHistory(HISTORY_PATH, sel);
    const recorded = recordSample(history, mmr, Date.now(), today());
    history = recorded.state;
    saveHistory(HISTORY_PATH, history);
```

- [ ] **Step 4: Vérifier le démarrage et l'écriture**

Run: `npm start`
Attendu : l'app démarre sans erreur de module. Avec un pseudo configuré et l'overlay visible (RL au focus, ou forcer la visibilité), après ≥1 poll, le fichier `history.json` apparaît dans le dossier userData.

Vérifier le fichier (PowerShell) :
Run: `Get-Content "$env:APPDATA\rl-overlay\history.json"`
Expected: un JSON avec `version:1`, `playlist` = la playlist config, `lastMmr` renseigné.

> Note : `userData` = `%APPDATA%\rl-overlay` (nom du package). Si le `productName` diffère, ajuster le chemin.

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat: record selected-playlist MMR into persistent history on each poll"
```

---

## Self-Review

**1. Spec coverage (section 4 du spec — couche données) :**
- Event log `{ts, playlist, mmrBefore, mmrAfter, delta, win}` → Task 2 (le `playlist` est porté par l'état, pas répété par event ; périmètre = playlist unique, donc OK et plus léger).
- Snapshots quotidiens → Task 3.
- Records (peak, bestStreak, bestDayGain) → Task 3.
- Détection match = transition MMR → Task 2 + intégration Task 9.
- Momentum-10 + forme → Task 4. Promotion math → Task 5. Heuristiques (confidence/tilt/consistency) → Task 6. Smart Insights → Task 7. Persistance jamais wipée + gitignore → Task 1 + Task 8.
- Périmètre playlist unique → garde-fou Task 8 + Task 9. Pas de backfill → état vide au départ, aucune fabrication. Clutch Index → absent (correct, hors périmètre).

**2. Placeholder scan :** aucun "TBD/TODO" ; chaque étape porte du code complet et des commandes exactes. ✅

**3. Type consistency :** `State`/`Event` définis Task 2, réutilisés tels quels (`.win`, `.delta`, `.events`, `.daily[k].end`, `.records.*`) Tasks 3-7. `avgWinGain`/`promotion` (Task 5) consommés par `insights` (Task 7) avec les mêmes signatures. `loadHistory(filePath, playlist)` / `saveHistory(filePath, state)` (Task 8) appelés à l'identique Task 9. ✅

> Hors périmètre Plan 1 (couverts par Plans 2 & 3) : rendu HUD V2, fenêtre Hub, Rank Shield, Journey, Objectifs, Daily Challenge, Session Heat visuel, animations, raccourci `Alt+R`. Le Plan 1 ne produit aucune UI — il expose des modules purs prêts à consommer.
