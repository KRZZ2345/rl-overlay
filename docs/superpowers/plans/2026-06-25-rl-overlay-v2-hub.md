# RL Overlay V2 — Hub plein écran (Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le Hub plein écran lecture seule (spec §7 intégral) : une fenêtre `hub.html` lazy ouverte par `Ctrl+Alt+Space`, peignant un view-model étendu poussé par `main.js`.

**Architecture:** Deux nouveaux modules purs (`lib/daily.js`, `lib/goals.js`) ; extension de `lib/viewmodel.js` (`buildHudViewModel` → `buildViewModel`) pour produire le contrat §3 complet (records, insights, heuristics, daily, goals, rank, session) ; une `BrowserWindow` focusable lazy + `hub-preload.js` + `hub.html` dans `main.js`. Les renderers ne calculent rien.

**Tech Stack:** Electron 31, Node `node:test` (tests unitaires des modules purs), CSS pur (skin partagé `theme-v2.css`). Aucune nouvelle dépendance npm.

## Global Constraints

- Aucune nouvelle dépendance npm (modules purs en CommonJS, `'use strict'`).
- Tests = `node --test` (`npm test`). Seuls les modules `lib/*` purs sont testés en unitaire. Les fichiers Electron (`main.js`, `hub.html`, `hub-preload.js`) ne sont PAS testables en `node:test` → vérifiés via le skill projet `run-rl-overlay`.
- Renderers = bête d'affichage : `require('./lib/...')` INTERDIT dans `hub.html`. Aucun calcul métier côté renderer.
- Hub = lecture seule : aucun IPC retour renderer→main hormis la fermeture (`hub-close`). Pas d'édition d'objectifs.
- Skin : `hub.html` inclut `theme-v2.css` (source de vérité unique). État chaud = classe `body.hot` pilotée par le champ `hot`.
- Raccourci Hub = `CommandOrControl+Alt+Space`. Fermeture = re-press OU `Échap` (focus Hub).
- Fenêtre Hub lazy : créée au toggle d'ouverture, **détruite** à la fermeture (footprint RAM nul en match).
- Format clé de jour = `YYYY-MM-DD` local (identique à `main.js` `today()` et `lib/insights` `dayKeyOf`).
- `DIV_SIZE = 100` (déjà figé dans `lib/promotion`). `MAX_EVENTS = 500` (déjà figé dans `lib/history`).

---

### Task 1: `lib/daily.js` — défi du jour (pur)

**Files:**
- Create: `lib/daily.js`
- Test: `test/daily.test.js`

**Interfaces:**
- Consumes: rien (module autonome).
- Produces:
  - `DAILY_TEMPLATES` : tableau de `{ id, label, target, metric }` où `metric ∈ {'mmrGain','wins','winrate','noTilt'}`.
  - `dailyChallenge(dayKey, ctx) -> { id, label, target, value, pct, done }`
    - `dayKey` : string `'YYYY-MM-DD'` (sert de seed déterministe).
    - `ctx` : `{ todayGain:number, sessionWins:number, sessionLosses:number, tilted:boolean }`.
    - Sélection déterministe : `index = scommeCodesChar(dayKey) % DAILY_TEMPLATES.length`.
    - `value` selon `metric` ; `pct = clamp(round(value/target*100), 0, 100)` ; `done = value >= target`.

- [ ] **Step 1: Write the failing test**

```js
// test/daily.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { dailyChallenge, DAILY_TEMPLATES } = require('../lib/daily');

const ctx = { todayGain: 0, sessionWins: 0, sessionLosses: 0, tilted: false };

test('même jour => même défi (déterministe)', () => {
  const a = dailyChallenge('2026-06-25', ctx);
  const b = dailyChallenge('2026-06-25', ctx);
  assert.strictEqual(a.id, b.id);
});

test('jours différents peuvent changer de défi (couvre tout le pool sur 30 jours)', () => {
  const ids = new Set();
  for (let d = 1; d <= 30; d++) ids.add(dailyChallenge(`2026-06-${String(d).padStart(2, '0')}`, ctx).id);
  assert.ok(ids.size >= 2, 'le pool doit tourner, ids vus: ' + ids.size);
});

test('défi mmrGain : value=todayGain, done quand atteint', () => {
  const tpl = DAILY_TEMPLATES.find((t) => t.metric === 'mmrGain');
  // force ce template via un dayKey dont l'index tombe dessus
  const idx = DAILY_TEMPLATES.indexOf(tpl);
  const key = forceKey(idx);
  const c = dailyChallenge(key, { ...ctx, todayGain: tpl.target });
  assert.strictEqual(c.value, tpl.target);
  assert.strictEqual(c.done, true);
  assert.strictEqual(c.pct, 100);
});

test('winrate : value = pourcentage de victoires de session', () => {
  const tpl = DAILY_TEMPLATES.find((t) => t.metric === 'winrate');
  const c = dailyChallenge(forceKey(DAILY_TEMPLATES.indexOf(tpl)), { ...ctx, sessionWins: 3, sessionLosses: 1 });
  assert.strictEqual(c.value, 75);
});

test('noTilt : value=1 si pas tilt, done', () => {
  const tpl = DAILY_TEMPLATES.find((t) => t.metric === 'noTilt');
  const c = dailyChallenge(forceKey(DAILY_TEMPLATES.indexOf(tpl)), { ...ctx, tilted: false });
  assert.strictEqual(c.value, 1);
  assert.strictEqual(c.done, true);
});

test('pct borné à 100 même si value dépasse target', () => {
  const tpl = DAILY_TEMPLATES.find((t) => t.metric === 'mmrGain');
  const c = dailyChallenge(forceKey(DAILY_TEMPLATES.indexOf(tpl)), { ...ctx, todayGain: tpl.target * 5 });
  assert.strictEqual(c.pct, 100);
});

// Construit une clé dont la somme des codes char % pool == idx (suffixe variable).
function forceKey(idx) {
  for (let n = 0; n < 1000; n++) {
    const key = '2026-06-25#' + n;
    let s = 0;
    for (const ch of key) s += ch.charCodeAt(0);
    if (s % DAILY_TEMPLATES.length === idx) return key;
  }
  throw new Error('clé introuvable pour idx ' + idx);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/daily.test.js`
Expected: FAIL — `Cannot find module '../lib/daily'`.

- [ ] **Step 3: Write minimal implementation**

```js
// lib/daily.js
'use strict';

// Pool de défis quotidiens. metric pilote le calcul de la progression.
const DAILY_TEMPLATES = [
  { id: 'mmr15',  label: '+15 MMR aujourd’hui', target: 15, metric: 'mmrGain' },
  { id: 'win3',   label: '3 victoires',            target: 3,  metric: 'wins' },
  { id: 'wr50',   label: 'Winrate > 50%',          target: 50, metric: 'winrate' },
  { id: 'notilt', label: 'Pas de tilt aujourd’hui', target: 1, metric: 'noTilt' }
];

function seedIndex(dayKey) {
  let s = 0;
  for (const ch of String(dayKey)) s += ch.charCodeAt(0);
  return s % DAILY_TEMPLATES.length;
}

function metricValue(metric, ctx) {
  switch (metric) {
    case 'mmrGain': return Math.max(0, ctx.todayGain || 0);
    case 'wins':    return ctx.sessionWins || 0;
    case 'winrate': {
      const total = (ctx.sessionWins || 0) + (ctx.sessionLosses || 0);
      return total === 0 ? 0 : Math.round(((ctx.sessionWins || 0) / total) * 100);
    }
    case 'noTilt':  return ctx.tilted ? 0 : 1;
    default:        return 0;
  }
}

// Défi du jour, déterministe par dayKey. Pur.
function dailyChallenge(dayKey, ctx = {}) {
  const tpl = DAILY_TEMPLATES[seedIndex(dayKey)];
  const value = metricValue(tpl.metric, ctx);
  const pct = Math.max(0, Math.min(100, Math.round((value / tpl.target) * 100)));
  return { id: tpl.id, label: tpl.label, target: tpl.target, value, pct, done: value >= tpl.target };
}

module.exports = { DAILY_TEMPLATES, dailyChallenge };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/daily.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/daily.js test/daily.test.js
git commit -m "feat: lib/daily — date-seeded daily challenge (pure)"
```

---

### Task 2: `lib/goals.js` — objectifs long terme (pur)

**Files:**
- Create: `lib/goals.js`
- Test: `test/goals.test.js`

**Interfaces:**
- Consumes: rien (module autonome).
- Produces:
  - `DEFAULT_GOALS` : tableau de `{ label, type, target }`, `type ∈ {'reachMmr','winrate','mmrWeek','winsDay'}`.
  - `evaluateGoals(goals, ctx) -> [{ label, type, target, value, pct, done }]`
    - `ctx` : `{ mmr:number|null, winratePct:number, mmrWeek:number, winsToday:number }`.
    - Pour chaque goal : `value` issu de `ctx` selon `type` ; `pct = clamp(round(value/target*100),0,100)` ; `done = value >= target`.
    - `goals` null/undefined → utilise `DEFAULT_GOALS`.

- [ ] **Step 1: Write the failing test**

```js
// test/goals.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateGoals, DEFAULT_GOALS } = require('../lib/goals');

const ctx = { mmr: 1000, winratePct: 0, mmrWeek: 0, winsToday: 0 };

test('null => DEFAULT_GOALS, même nombre de lignes', () => {
  assert.strictEqual(evaluateGoals(null, ctx).length, DEFAULT_GOALS.length);
});

test('reachMmr : value=mmr courant, done si >= target', () => {
  const goals = [{ label: 'Diamond', type: 'reachMmr', target: 1110 }];
  assert.strictEqual(evaluateGoals(goals, { ...ctx, mmr: 1110 })[0].done, true);
  assert.strictEqual(evaluateGoals(goals, { ...ctx, mmr: 1000 })[0].done, false);
});

test('winrate : value=winratePct', () => {
  const goals = [{ label: 'WR 60', type: 'winrate', target: 60 }];
  const r = evaluateGoals(goals, { ...ctx, winratePct: 60 })[0];
  assert.strictEqual(r.value, 60);
  assert.strictEqual(r.done, true);
});

test('mmrWeek : value=mmrWeek, pct partiel', () => {
  const goals = [{ label: '+100/sem', type: 'mmrWeek', target: 100 }];
  const r = evaluateGoals(goals, { ...ctx, mmrWeek: 50 })[0];
  assert.strictEqual(r.value, 50);
  assert.strictEqual(r.pct, 50);
  assert.strictEqual(r.done, false);
});

test('winsDay : value=winsToday', () => {
  const goals = [{ label: '10 wins', type: 'winsDay', target: 10 }];
  assert.strictEqual(evaluateGoals(goals, { ...ctx, winsToday: 10 })[0].pct, 100);
});

test('mmr null => value 0, jamais NaN', () => {
  const goals = [{ label: 'Diamond', type: 'reachMmr', target: 1110 }];
  const r = evaluateGoals(goals, { ...ctx, mmr: null })[0];
  assert.strictEqual(r.value, 0);
  assert.ok(!Number.isNaN(r.pct));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/goals.test.js`
Expected: FAIL — `Cannot find module '../lib/goals'`.

- [ ] **Step 3: Write minimal implementation**

```js
// lib/goals.js
'use strict';

const DEFAULT_GOALS = [
  { label: 'Atteindre Diamond', type: 'reachMmr', target: 1110 },
  { label: 'Winrate 60%',       type: 'winrate',  target: 60 },
  { label: '+100 MMR / semaine', type: 'mmrWeek', target: 100 },
  { label: '10 victoires / jour', type: 'winsDay', target: 10 }
];

function goalValue(type, ctx) {
  switch (type) {
    case 'reachMmr': return ctx.mmr != null ? ctx.mmr : 0;
    case 'winrate':  return ctx.winratePct || 0;
    case 'mmrWeek':  return ctx.mmrWeek || 0;
    case 'winsDay':  return ctx.winsToday || 0;
    default:         return 0;
  }
}

// Évalue chaque objectif contre le contexte courant. Pur.
function evaluateGoals(goals, ctx = {}) {
  const list = Array.isArray(goals) && goals.length ? goals : DEFAULT_GOALS;
  return list.map((g) => {
    const value = goalValue(g.type, ctx);
    const pct = Math.max(0, Math.min(100, Math.round((value / g.target) * 100)));
    return { label: g.label, type: g.type, target: g.target, value, pct, done: value >= g.target };
  });
}

module.exports = { DEFAULT_GOALS, evaluateGoals };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/goals.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/goals.js test/goals.test.js
git commit -m "feat: lib/goals — default goals + pure progress eval"
```

---

### Task 3: `lib/viewmodel.js` — étendre au contrat §3 complet (`buildViewModel`)

**Files:**
- Modify: `lib/viewmodel.js`
- Modify: `lib/insights.js` (exporter `dayKeyOf`)
- Modify: `test/viewmodel.test.js` (rename + tests des nouveaux champs)

**Interfaces:**
- Consumes: `lib/momentum`, `lib/promotion`, `lib/heuristics` (`consistencyScore`, `confidence`, `tilt`), `lib/insights` (`generateInsights`, `dayKeyOf`), `lib/daily` (`dailyChallenge`), `lib/goals` (`evaluateGoals`, `DEFAULT_GOALS`).
- Produces:
  - `buildViewModel(input) -> vm` où `input` ajoute aux champs HUD existants : `state` (état history complet ou `null`), `rank` (`{tier,division,playlist}` ou `null`), `dayKey` (string), `goalsCfg` (array ou `null`).
  - `vm` ajoute aux champs HUD existants :
    - `rank` (echo de l'input)
    - `session: { timeMs, wins, losses, mmrNet }`
    - `records: { peak, gap, daysSince }` (peak depuis `state.records.peakMmr` ; `gap = mmr - peak` ; `daysSince = floor((now - peakTs)/86400000)`)
    - `insights: [{icon,text}]`
    - `heuristics: { confidence:number, consistency:{score,grade}, tilt:{tilted,reason} }`
    - `daily: {...}` (Task 1)
    - `goals: [...]` (Task 2)
  - L'ancien nom `buildHudViewModel` est SUPPRIMÉ (remplacé par `buildViewModel`).

- [ ] **Step 1: Exporter `dayKeyOf` depuis `lib/insights.js`**

Modifier la dernière ligne de `lib/insights.js` :

```js
module.exports = { generateInsights, dayKeyOf };
```

- [ ] **Step 2: Réécrire `test/viewmodel.test.js` (rename + nouveaux champs)**

Remplacer tout le contenu de `test/viewmodel.test.js` par :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildViewModel } = require('../lib/viewmodel');

const ev = (win, delta, ts = 0) => ({ ts, mmrBefore: 0, mmrAfter: 0, delta, win });
const base = {
  mmr: 1075, startMmr: 1033, events: [], gameStreak: null,
  session: { wins: 0, losses: 0, streak: 0 }, sessionStart: 0, now: 0,
  state: null, rank: null, dayKey: '2026-06-25', goalsCfg: null
};

test('deltaSession = mmr - startMmr', () => {
  assert.strictEqual(buildViewModel({ ...base }).deltaSession, 42);
});

test('promotion calculée depuis le mmr', () => {
  const vm = buildViewModel({ ...base, mmr: 1075 });
  assert.strictEqual(vm.promotion.mmrToNext, 25);
  assert.strictEqual(vm.promotion.pct, 75);
});

test('momentum exposé (7W/10 = hot) + boost', () => {
  const events = [true,true,false,true,true,false,true,true,false,true].map((w) => ev(w, w ? 10 : -9));
  const vm = buildViewModel({ ...base, events });
  assert.strictEqual(vm.momentum.wins, 7);
  assert.strictEqual(vm.momentum.form, 'hot');
  assert.strictEqual(vm.boost, 70);
});

test('hot si streak >= 3', () => {
  assert.strictEqual(buildViewModel({ ...base, gameStreak: 3 }).hot, true);
});

test('session expose timeMs/wins/losses/mmrNet', () => {
  const vm = buildViewModel({ ...base, sessionStart: 1000, now: 61000, session: { wins: 4, losses: 2, streak: 1 } });
  assert.strictEqual(vm.session.timeMs, 60000);
  assert.strictEqual(vm.session.wins, 4);
  assert.strictEqual(vm.session.losses, 2);
  assert.strictEqual(vm.session.mmrNet, 42);
});

test('records dérivés du state (peak, gap, daysSince)', () => {
  const state = {
    version: 1, playlist: 'x', lastMmr: 1075, events: [], daily: {},
    records: { peakMmr: 1120, peakTs: 0, bestStreak: 0, bestDayGain: 0 }
  };
  const vm = buildViewModel({ ...base, mmr: 1075, state, now: 2 * 86400000 });
  assert.strictEqual(vm.records.peak, 1120);
  assert.strictEqual(vm.records.gap, -45);
  assert.strictEqual(vm.records.daysSince, 2);
});

test('records à zéro quand state null (garde-fou)', () => {
  const vm = buildViewModel({ ...base, state: null });
  assert.deepStrictEqual(vm.records, { peak: null, gap: 0, daysSince: 0 });
});

test('heuristics exposées', () => {
  const events = Array.from({ length: 10 }, () => ev(true, 10));
  const vm = buildViewModel({ ...base, events });
  assert.strictEqual(vm.heuristics.confidence, 100);
  assert.strictEqual(vm.heuristics.consistency.grade, 'A+');
  assert.strictEqual(vm.heuristics.tilt.tilted, false);
});

test('insights vides quand state null', () => {
  assert.deepStrictEqual(buildViewModel({ ...base, state: null }).insights, []);
});

test('daily et goals présents', () => {
  const vm = buildViewModel({ ...base });
  assert.ok(vm.daily && typeof vm.daily.id === 'string');
  assert.ok(Array.isArray(vm.goals) && vm.goals.length >= 1);
});

test('rank est l’écho de l’input', () => {
  const rank = { tier: 'Diamond II', division: 'Division I', playlist: '2v2' };
  assert.deepStrictEqual(buildViewModel({ ...base, rank }).rank, rank);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- test/viewmodel.test.js`
Expected: FAIL — `buildViewModel is not a function` (export encore nommé `buildHudViewModel`).

- [ ] **Step 4: Réécrire `lib/viewmodel.js`**

Remplacer tout le contenu de `lib/viewmodel.js` par :

```js
'use strict';

const { momentum } = require('./momentum');
const { promotion, avgWinGain } = require('./promotion');
const { consistencyScore, confidence, tilt } = require('./heuristics');
const { generateInsights, dayKeyOf } = require('./insights');
const { dailyChallenge } = require('./daily');
const { evaluateGoals } = require('./goals');

const DAY_MS = 86400000;

// Records dérivés du store + MMR courant.
function recordsView(state, mmr, now) {
  if (!state || !state.records) return { peak: null, gap: 0, daysSince: 0 };
  const peak = state.records.peakMmr;
  const gap = peak != null && mmr != null ? mmr - peak : 0;
  const daysSince = state.records.peakTs ? Math.floor((now - state.records.peakTs) / DAY_MS) : 0;
  return { peak, gap, daysSince };
}

// MMR gagné sur ~7 derniers jours, depuis les snapshots quotidiens.
function mmrThisWeek(state, mmr, dayKey) {
  if (!state || !state.daily || mmr == null) return 0;
  const keys = Object.keys(state.daily).sort(); // 'YYYY-MM-DD' trie chronologiquement
  if (keys.length === 0) return 0;
  const cutoff = keys.slice(-7);
  const earliest = state.daily[cutoff[0]];
  return earliest ? mmr - earliest.start : 0;
}

// Victoires du jour, depuis l'event log filtré sur dayKey.
function winsToday(state, dayKey) {
  if (!state || !Array.isArray(state.events)) return 0;
  return state.events.filter((e) => dayKeyOf(e.ts) === dayKey && e.win).length;
}

// Compose le view-model COMPLET (contrat rendering-design §3) à partir d'un
// snapshot + de l'historique. Pur : aucune I/O, aucune dépendance Electron.
// HUD f5 pioche son sous-ensemble ; le Hub consomme tout.
function buildViewModel(input) {
  const {
    mmr = null, startMmr = null, events = [], gameStreak = null,
    session = { wins: 0, losses: 0, streak: 0 }, sessionStart = 0, now = 0,
    state = null, rank = null, dayKey = '', goalsCfg = null
  } = input || {};

  const deltaSession = (mmr != null && startMmr != null) ? mmr - startMmr : 0;
  const mom = momentum(events, 10);
  const boost = Math.round((mom.wins / Math.max(1, mom.results.length)) * 100);
  const streak = gameStreak != null ? gameStreak : (session.streak || 0);
  const hot = streak >= 3 || mom.form === 'hot';
  const timeMs = sessionStart ? now - sessionStart : 0;

  const promo = mmr == null
    ? { mmrToNext: 0, pct: 0, matchesNeeded: 0 }
    : promotion(mmr, avgWinGain(events));

  const heuristics = {
    confidence: confidence(events),
    consistency: consistencyScore(events),
    tilt: tilt(events)
  };

  const insights = state ? generateInsights(state, { dayKey, mmr, max: 3 }) : [];

  const today = state && state.daily ? state.daily[dayKey] : null;
  const todayGain = today ? today.end - today.start : 0;

  const daily = dailyChallenge(dayKey, {
    todayGain,
    sessionWins: session.wins,
    sessionLosses: session.losses,
    tilted: heuristics.tilt.tilted
  });

  const totalWL = (session.wins || 0) + (session.losses || 0);
  const winratePct = totalWL === 0 ? 0 : Math.round(((session.wins || 0) / totalWL) * 100);
  const goals = evaluateGoals(goalsCfg, {
    mmr,
    winratePct,
    mmrWeek: mmrThisWeek(state, mmr, dayKey),
    winsToday: winsToday(state, dayKey)
  });

  return {
    rank,
    mmr,
    deltaSession,
    promotion: promo,
    momentum: mom,
    boost,
    hot,
    streak,
    timeMs,
    session: { timeMs, wins: session.wins, losses: session.losses, mmrNet: deltaSession },
    records: recordsView(state, mmr, now),
    insights,
    heuristics,
    daily,
    goals
  };
}

module.exports = { buildViewModel };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- test/viewmodel.test.js`
Expected: PASS (11 tests).

- [ ] **Step 6: Run the full suite (no regression)**

Run: `npm test`
Expected: PASS — toute la suite (`lib/*` + smoke) verte.

- [ ] **Step 7: Commit**

```bash
git add lib/viewmodel.js lib/insights.js test/viewmodel.test.js
git commit -m "feat: buildViewModel — full §3 contract (records/insights/heuristics/daily/goals)"
```

---

### Task 4: Câbler `buildViewModel` + fenêtre Hub lazy dans `main.js`

**Files:**
- Modify: `main.js` (import ligne 9 ; appel ligne ~291 ; payload ; nouveau bloc fenêtre Hub ; nouveau raccourci)
- Create: `hub-preload.js`

**Interfaces:**
- Consumes: `buildViewModel` (Task 3), `lib/goals` `DEFAULT_GOALS` indirectement via config.
- Produces (dans `main.js`) : `hubWin` (var module), `openHub()`, `closeHub()`, `toggleHub()`, `pushHub()`, `lastVm` (dernier view-model poussé). IPC handler `'hub-close'`.

> **Note vérification :** `main.js` et `hub-preload.js` ne sont pas testables en `node:test`. Cette tâche se vérifie via le skill `run-rl-overlay` à la Task 5 (la fenêtre Hub n'a de sens qu'avec `hub.html`). Ici on câble ; le rendu se valide en Task 5.

- [ ] **Step 1: Remplacer l'import du view-model**

Dans `main.js`, remplacer la ligne 9 :

```js
const { buildHudViewModel } = require('./lib/viewmodel');
```

par :

```js
const { buildViewModel } = require('./lib/viewmodel');
```

- [ ] **Step 2: Déclarer l'état Hub**

Dans `main.js`, juste après `let sessionStart = 0; ...` (ligne 88), ajouter :

```js
let hubWin = null;   // fenêtre Hub plein écran (lazy : null tant que fermée)
let lastVm = null;   // dernier view-model complet (poussé au Hub à l'ouverture)
```

- [ ] **Step 3: Construire le view-model complet dans le poll**

Dans `main.js`, remplacer le bloc `const vm = buildHudViewModel({ ... });` (lignes ~291-297) par :

```js
    const cfgNow = loadConfig();
    const vm = buildViewModel({
      mmr, startMmr: ref.start,
      events: history ? history.events : [],
      gameStreak: m.streak ?? null,
      session: session.total,
      sessionStart, now: Date.now(),
      state: history || null,
      rank: { tier: m.tier || null, division: m.div || null, playlist: shortPlaylist(sel) },
      dayKey: today(),
      goalsCfg: Array.isArray(cfgNow.goals) ? cfgNow.goals : null
    });
    lastVm = vm;
```

- [ ] **Step 4: Pousser le view-model complet au Hub à chaque poll**

Dans `main.js`, juste après `sendUpdate(payload);` (ligne ~308, dans le poll), ajouter :

```js
    pushHub(); // met à jour le Hub s'il est ouvert
```

(Le `payload` HUD existant reste inchangé : `f5` continue de lire `promotion`, `momentum`, `boost`, `hot`, `sessionMs`, qui existent toujours sur `vm`.)

- [ ] **Step 5: Ajouter les fonctions Hub (fenêtre lazy + push)**

Dans `main.js`, juste après la fonction `sendUpdate` (après ligne 352), ajouter :

```js
// --- Hub plein écran (lazy, lecture seule) ---
function pushHub() {
  if (hubWin && !hubWin.isDestroyed() && lastVm) {
    hubWin.webContents.send('hub-update', lastVm);
  }
}

function openHub() {
  if (hubWin && !hubWin.isDestroyed()) { hubWin.focus(); return; }
  const work = screen.getPrimaryDisplay().workAreaSize;
  hubWin = new BrowserWindow({
    width: Math.min(1100, work.width - 80),
    height: Math.min(720, work.height - 80),
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0b0e', // = token --bg, évite le flash blanc
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'hub-preload.js'),
      contextIsolation: true
    }
  });
  hubWin.center();
  hubWin.once('ready-to-show', () => { hubWin.show(); hubWin.focus(); });
  // Pousse le dernier view-model connu dès que la page est prête (jamais de vide).
  hubWin.webContents.on('did-finish-load', () => pushHub());
  hubWin.on('closed', () => { hubWin = null; });
  hubWin.loadFile('hub.html');
}

function closeHub() {
  if (hubWin && !hubWin.isDestroyed()) hubWin.close();
}

function toggleHub() {
  if (hubWin && !hubWin.isDestroyed()) closeHub();
  else openHub();
}
```

- [ ] **Step 6: Enregistrer le raccourci + le handler de fermeture**

Dans `main.js`, dans le bloc d'enregistrement des raccourcis (près de la ligne 578, à côté des autres `globalShortcut.register`), ajouter :

```js
  globalShortcut.register('CommandOrControl+Alt+Space', () => toggleHub());
```

Et dans la zone des `ipcMain.handle` (chercher `ipcMain.handle('reset-session'` et ajouter à côté) :

```js
ipcMain.handle('hub-close', () => closeHub());
```

- [ ] **Step 7: Créer `hub-preload.js`**

```js
// hub-preload.js — pont IPC du Hub (lecture seule + fermeture).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hub', {
  onUpdate: (cb) => ipcRenderer.on('hub-update', (_e, vm) => cb(vm)),
  close: () => ipcRenderer.invoke('hub-close')
});
```

- [ ] **Step 8: Vérifier que l'app démarre sans erreur**

Run: `npm start`
Expected: l'app se lance, aucune exception dans la console au démarrage (le Hub ne s'ouvre pas tout seul). Fermer l'app ensuite.

> Note : `Ctrl+Alt+Space` ouvrira une fenêtre vide tant que `hub.html` n'existe pas (Task 5). Ne pas tester le rendu ici.

- [ ] **Step 9: Commit**

```bash
git add main.js hub-preload.js
git commit -m "feat: lazy Hub window + Ctrl+Alt+Space + full view-model push"
```

---

### Task 5: `hub.html` — rendu §7 intégral (lecture seule)

**Files:**
- Create: `hub.html`

**Interfaces:**
- Consumes: `window.hub.onUpdate(vm => ...)` et `window.hub.close()` (depuis `hub-preload.js`, Task 4) ; `theme-v2.css` (tokens + classe `body.hot`).
- Produces: rien (feuille terminale d'affichage).

**Contrat view-model reçu** (Task 3) :
`{ rank:{tier,division,playlist}, mmr, deltaSession, promotion:{pct,mmrToNext,matchesNeeded}, momentum:{results,wins,losses,form,label}, boost, hot, streak, timeMs, session:{timeMs,wins,losses,mmrNet}, records:{peak,gap,daysSince}, insights:[{icon,text}], heuristics:{confidence,consistency:{score,grade},tilt:{tilted,reason}}, daily:{id,label,target,value,pct,done}, goals:[{label,type,target,value,pct,done}] }`

- [ ] **Step 1: Créer `hub.html` (layout §7 + paint)**

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="theme-v2.css" />
<style>
  /* Layout propre au Hub (le skin/tokens viennent de theme-v2.css). */
  html, body { height: 100%; margin: 0; background: var(--bg); color: var(--txt);
    font-family: 'Segoe UI', system-ui, sans-serif; overflow: hidden; }
  .hub { display: flex; flex-direction: column; gap: 14px; height: 100%;
    box-sizing: border-box; padding: 22px 26px; }
  .label { color: var(--muted); text-transform: uppercase; letter-spacing: .14em; font-size: 11px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }

  /* Bande héros : domine visuellement. */
  .hero { display: grid; grid-template-columns: auto 1fr auto; gap: 26px; align-items: center; }
  .hero .mmr { font-weight: 300; font-size: 76px; line-height: .9;
    font-variant-numeric: tabular-nums; letter-spacing: -.03em; }
  .hero .delta { font-style: italic; color: var(--muted); margin-top: 4px; }
  .rankblock .tier { font-size: 22px; font-weight: 600; }
  .peak { text-align: right; }
  .promo { margin-top: 6px; }
  .bar { height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; }
  .bar > i { display: block; height: 100%; width: 0;
    background: linear-gradient(90deg, var(--aA), var(--aB)); }

  .row { display: grid; gap: 14px; }
  .row.r2 { grid-template-columns: 1fr 1fr; }
  .row.r3 { grid-template-columns: 1fr 1fr; }
  .widgets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .widget .big { font-size: 26px; font-weight: 600; margin-top: 4px; }

  /* Momentum-10. */
  .mom { display: flex; gap: 4px; margin-top: 8px; }
  .mom > span { flex: 1; height: 22px; border-radius: 4px; background: var(--line); }
  .mom > span.w { background: var(--good); }
  .mom > span.l { background: var(--loss); }

  .ins { margin: 6px 0 0; padding: 0; list-style: none; }
  .ins li { padding: 4px 0; color: var(--txt); }

  /* Ranked Journey. */
  .journey { display: flex; gap: 6px; margin-top: 10px; }
  .journey > span { flex: 1; text-align: center; font-size: 10px; color: var(--dim);
    padding-top: 14px; border-top: 3px solid var(--line); }
  .journey > span.on { color: var(--txt); border-top-color: var(--aB); }
  .journey > span.cur { color: var(--hot); border-top-color: var(--hot); }

  /* Tilt : caché par défaut. */
  #tilt { display: none; border-color: var(--loss); color: var(--loss); }
  body.tilted #tilt { display: block; }

  /* État chaud (token Octane), piloté par body.hot. */
  body.hot .pill { color: var(--bg); background: linear-gradient(90deg, var(--hot), var(--hot2)); }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 99px;
    background: var(--line); color: var(--muted); font-size: 13px; }

  .hint { position: fixed; bottom: 8px; right: 12px; color: var(--dim); font-size: 11px; }
</style>
</head>
<body>
  <div class="hub">
    <!-- Héros -->
    <section class="card hero">
      <div class="rankblock">
        <div class="tier" data-f="tier">—</div>
        <div class="label" data-f="playlist">—</div>
      </div>
      <div>
        <div class="mmr" data-f="mmr">—</div>
        <div class="delta"><span data-f="delta">—</span> · <span class="pill" data-f="streak">—</span></div>
        <div class="promo">
          <div class="label" data-f="promoLabel">—</div>
          <div class="bar"><i data-f="promoBar"></i></div>
        </div>
      </div>
      <div class="peak">
        <div class="label">Peak</div>
        <div class="big" data-f="peak">—</div>
        <div class="label" data-f="peakSince">—</div>
      </div>
    </section>

    <!-- Bande 2 : pouls de session -->
    <div class="row r2">
      <section class="card">
        <div class="label">Momentum-10 · <span data-f="momLabel">—</span></div>
        <div class="mom" data-f="mom"></div>
      </section>
      <section class="card">
        <div class="label">Session</div>
        <div class="big"><span data-f="sWins">0</span>W – <span data-f="sLosses">0</span>L · <span data-f="sNet">0</span> MMR</div>
        <div class="label">Confiance <span data-f="conf">0</span> / 100 · <span data-f="time">0:00</span></div>
      </section>
    </div>

    <!-- Bande 3 : journey + insights -->
    <div class="row r3">
      <section class="card">
        <div class="label">Ranked Journey</div>
        <div class="journey" data-f="journey"></div>
      </section>
      <section class="card">
        <div class="label">Insights</div>
        <ul class="ins" data-f="insights"></ul>
      </section>
    </div>

    <!-- Bande 4 : widgets -->
    <div class="widgets">
      <section class="card widget"><div class="label">Défi du jour</div><div class="big" data-f="dailyLabel">—</div><div class="bar"><i data-f="dailyBar"></i></div></section>
      <section class="card widget"><div class="label">Consistance</div><div class="big" data-f="consist">—</div></section>
      <section class="card widget"><div class="label">Boost / session</div><div class="big" data-f="heat">—</div></section>
      <section class="card widget"><div class="label">Objectif</div><div class="big" data-f="goalLabel">—</div><div class="bar"><i data-f="goalBar"></i></div></section>
    </div>

    <section class="card" id="tilt" data-f="tilt">⚠ —</section>
  </div>
  <div class="hint">Échap ou Ctrl+Alt+Espace pour fermer</div>

<script>
  const $ = (f) => document.querySelector(`[data-f="${f}"]`);
  const txt = (f, v) => { const el = $(f); if (el) el.textContent = v; };
  const TIERS = ['Bronze','Argent','Or','Platine','Diamant','Champion','GC','SSL'];
  // Mappe un tier API ('Diamond II', 'Grand Champion I', 'Supersonic Legend') vers l'index TIERS.
  function tierIndex(tier) {
    const t = (tier || '').toLowerCase();
    if (t.includes('supersonic')) return 7;
    if (t.includes('grand')) return 6;
    if (t.includes('champion')) return 5;
    if (t.includes('diamond')) return 4;
    if (t.includes('plat')) return 3;
    if (t.includes('gold')) return 2;
    if (t.includes('silver')) return 1;
    if (t.includes('bronze')) return 0;
    return -1;
  }
  function fmtTime(ms) {
    const s = Math.floor((ms || 0) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}` : `${m}:${String(s % 60).padStart(2,'0')}`;
  }

  function paint(vm) {
    if (!vm) return;
    document.body.classList.toggle('hot', !!vm.hot);
    document.body.classList.toggle('tilted', !!(vm.heuristics && vm.heuristics.tilt && vm.heuristics.tilt.tilted));

    // Héros.
    txt('tier', (vm.rank && vm.rank.tier) ? `${vm.rank.tier} ${vm.rank.division || ''}`.trim() : '—');
    txt('playlist', vm.rank && vm.rank.playlist ? vm.rank.playlist : '—');
    txt('mmr', vm.mmr != null ? vm.mmr : '—');
    txt('delta', (vm.deltaSession > 0 ? '▲ +' : vm.deltaSession < 0 ? '▼ ' : '') + (vm.deltaSession || 0));
    txt('streak', '🔥 ' + (vm.streak || 0));
    txt('promoLabel', `Vers la division suivante — ${vm.promotion.matchesNeeded} match(s) · ${vm.promotion.mmrToNext} MMR`);
    const pb = $('promoBar'); if (pb) pb.style.width = (vm.promotion.pct || 0) + '%';
    txt('peak', vm.records.peak != null ? vm.records.peak : '—');
    txt('peakSince', vm.records.peak != null ? `écart ${vm.records.gap} · ${vm.records.daysSince} j` : '—');

    // Momentum-10.
    const mom = $('mom');
    if (mom) {
      mom.innerHTML = '';
      (vm.momentum.results || []).forEach((w) => {
        const sp = document.createElement('span');
        sp.className = w ? 'w' : 'l';
        mom.appendChild(sp);
      });
    }
    txt('momLabel', vm.momentum.label || '—');

    // Session + confiance.
    txt('sWins', vm.session.wins); txt('sLosses', vm.session.losses);
    txt('sNet', (vm.session.mmrNet > 0 ? '+' : '') + vm.session.mmrNet);
    txt('conf', vm.heuristics.confidence);
    txt('time', fmtTime(vm.session.timeMs));

    // Journey.
    const j = $('journey');
    if (j) {
      const cur = tierIndex(vm.rank && vm.rank.tier);
      j.innerHTML = '';
      TIERS.forEach((name, i) => {
        const sp = document.createElement('span');
        sp.textContent = name;
        if (i < cur) sp.className = 'on';
        else if (i === cur) sp.className = 'cur';
        j.appendChild(sp);
      });
    }

    // Insights.
    const ul = $('insights');
    if (ul) {
      ul.innerHTML = '';
      (vm.insights || []).forEach((it) => {
        const li = document.createElement('li');
        li.textContent = `${it.icon} ${it.text}`;
        ul.appendChild(li);
      });
      if (!vm.insights || vm.insights.length === 0) ul.innerHTML = '<li class="label">Pas encore de données</li>';
    }

    // Widgets.
    txt('dailyLabel', vm.daily ? vm.daily.label : '—');
    const db = $('dailyBar'); if (db) db.style.width = (vm.daily ? vm.daily.pct : 0) + '%';
    txt('consist', vm.heuristics.consistency ? vm.heuristics.consistency.grade : '—');
    txt('heat', (vm.boost || 0) + '%');
    const g0 = (vm.goals && vm.goals[0]) || null;
    txt('goalLabel', g0 ? g0.label : '—');
    const gb = $('goalBar'); if (gb) gb.style.width = (g0 ? g0.pct : 0) + '%';

    // Tilt.
    if (vm.heuristics && vm.heuristics.tilt && vm.heuristics.tilt.tilted) {
      txt('tilt', '⚠ ' + vm.heuristics.tilt.reason);
    }
  }

  window.hub.onUpdate(paint);
  // Échap ferme le Hub (lecture seule : seul input autorisé).
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.hub.close(); });
</script>
</body>
</html>
```

- [ ] **Step 2: Vérifier le rendu via le skill projet**

Invoquer le skill `run-rl-overlay` (lance l'app de test). Une fois lancée :
1. Presser `Ctrl+Alt+Space` → le Hub s'ouvre centré, fond sombre (token `--bg`), layout 4 bandes visible (héros dominant, momentum/session, journey/insights, 4 widgets).
2. Sans Rocket League en cours, les valeurs sont à zéro/`—` (aucun poll) mais **la mise en page et le skin doivent s'afficher sans erreur console**.
3. Presser `Échap` → le Hub se ferme. Re-presser `Ctrl+Alt+Space` → ré-ouvre.
4. Vérifier dans la console du Hub (DevTools) qu'il n'y a aucune exception.

Expected: Hub s'ouvre/ferme proprement, layout et skin conformes, zéro exception. (Le remplissage complet des données se valide en session RL réelle.)

- [ ] **Step 3: Commit**

```bash
git add hub.html
git commit -m "feat: hub.html — full §7 read-only dashboard, shared theme-v2 skin"
```

---

## Notes de vérification finale

- Suite unitaire complète verte : `npm test`.
- Hub ouvre/ferme via `Ctrl+Alt+Space` et `Échap`, footprint nul tant que fermé (fenêtre détruite à la fermeture, `hubWin = null`).
- HUD `f5` inchangé (le `payload` HUD conserve ses champs ; `vm` porte les mêmes noms).
- Aucune nouvelle dépendance npm ; aucun `require('./lib/...')` dans `hub.html`.
