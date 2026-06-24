# RL Overlay V2 — Plan 2 : HUD in-game (form Premium) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter au HUD click-through une nouvelle form riche **`f5` "Premium"** (Rank Shield, MMR géant, barre promotion, Momentum-10, barre élan, pied W/L + temps + streak), alimentée par un view-model dérivé des modules `lib/` du Plan 1, et en faire la forme par défaut au premier lancement.

**Architecture:** L'assemblage des métriques dérivées est extrait dans une **fonction pure `lib/viewmodel.js`** (testable en `node:test`), qui consomme `lib/momentum` + `lib/promotion` (Plan 1). `main.js` l'appelle dans `poll()` et ajoute ses champs au payload IPC existant. Le renderer (`index.html`) gagne une form `f5` et un skin partagé (`theme-v2.css`) ; il reste une bête d'affichage. Aucune dépendance npm nouvelle.

**Tech Stack:** Node.js CommonJS, `node:test` + `node:assert`, Electron (existant), CSS/HTML pur côté renderer.

## Global Constraints

- Aucune dépendance npm nouvelle. Modules `lib/` = JS pur, pas de `require('electron')`. (zero-dependency.)
- CommonJS (`module.exports` / `require`), cohérent avec `main.js`, `lib/history.js`.
- **Dépend du Plan 1** (`lib/history`, `lib/momentum`, `lib/promotion`) : Plan 1 implémenté avant celui-ci.
- Renderer = aucun calcul métier ; il consomme le view-model poussé par `main`. Pas de `require('./lib/...')` dans `index.html`.
- Skin partagé extrait dans `theme-v2.css` (réutilisé par le Hub au Plan 3). Tokens = spec V2 §5.
- La form `f5` utilise son **propre skin fixe** (froid/minimal + Octane), indépendant des 8 thèmes cyclables (`Ctrl+Alt+T` ne la recolore pas — voulu).
- Octane orange = signal "chaud" uniquement ; au repos la form reste froide.
- Les formes existantes f0-f4 restent intactes et disponibles dans le cycle `Ctrl+Alt+F`.

---

## File Structure

- `lib/viewmodel.js` — **Create.** `buildHudViewModel(input)` pur : dérive deltaSession, promotion, momentum, boost, hot, streak, timeMs. Seul endroit qui compose les métriques HUD.
- `test/viewmodel.test.js` — **Create.** Tests unitaires de `buildHudViewModel`.
- `theme-v2.css` — **Create.** Tokens de skin V2 (spec §5) + styles de la form `f5` + animations "chaud". Scopé sous `.f5` pour ne pas toucher f0-f4.
- `index.html` — **Modify.** `<link>` vers `theme-v2.css` ; template `f5` dans `FORMS` ; entrée `LAYOUT_NAMES` ; champs `f5` dans `paint()` ; capture des nouveaux champs du view-model dans `onUpdate`.
- `main.js` — **Modify.** Import `buildHudViewModel` ; `sessionStart` ; appel dans `poll()` et fusion au payload ; `LAYOUT_COUNT = 6` ; `DEFAULT_CONFIG.overlay.layout = 5`.

---

### Task 1: `lib/viewmodel.js` — view-model HUD pur (TDD)

**Files:**
- Create: `lib/viewmodel.js`
- Test: `test/viewmodel.test.js`

**Interfaces:**
- Consumes (Plan 1) : `momentum(events, n)` de `lib/momentum` → `{ results, wins, losses, form, label }` ; `promotion(mmr, avgGain)` + `avgWinGain(events, fallback)` de `lib/promotion` → `{ mmrToNext, pct, matchesNeeded }`.
- Produces :
  - `buildHudViewModel(input) -> Vm`
    où `input = { mmr:number|null, startMmr:number|null, events:Event[], gameStreak:number|null, session:{wins,losses,streak}, sessionStart:number, now:number }`
    et `Vm = { deltaSession:number, promotion:{mmrToNext,pct,matchesNeeded}, momentum:{results,wins,losses,form,label}, boost:number(0..100), hot:boolean, streak:number, timeMs:number }`.
  - Règles : `deltaSession = (mmr!=null && startMmr!=null) ? mmr-startMmr : 0`. `streak = gameStreak ?? session.streak ?? 0`. `boost = round(momentum.wins / max(1, momentum.results.length) * 100)`. `hot = streak >= 3 || momentum.form === 'hot'`. `timeMs = sessionStart ? now - sessionStart : 0`. Si `mmr == null` → `promotion = { mmrToNext:0, pct:0, matchesNeeded:0 }` (garde-fou).

- [ ] **Step 1: Écrire les tests**

Create `test/viewmodel.test.js` :

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildHudViewModel } = require('../lib/viewmodel');

const ev = (win, delta) => ({ ts: 0, mmrBefore: 0, mmrAfter: 0, delta, win });
const base = {
  mmr: 1075, startMmr: 1033, events: [], gameStreak: null,
  session: { wins: 0, losses: 0, streak: 0 }, sessionStart: 0, now: 0
};

test('deltaSession = mmr - startMmr', () => {
  const vm = buildHudViewModel({ ...base });
  assert.strictEqual(vm.deltaSession, 42);
});

test('deltaSession = 0 si mmr ou startMmr manquant', () => {
  assert.strictEqual(buildHudViewModel({ ...base, startMmr: null }).deltaSession, 0);
  assert.strictEqual(buildHudViewModel({ ...base, mmr: null }).deltaSession, 0);
});

test('promotion calculée depuis le mmr', () => {
  const vm = buildHudViewModel({ ...base, mmr: 1075 });
  assert.strictEqual(vm.promotion.mmrToNext, 25);
  assert.strictEqual(vm.promotion.pct, 75);
});

test('mmr null => promotion à zéro (garde-fou)', () => {
  const vm = buildHudViewModel({ ...base, mmr: null });
  assert.deepStrictEqual(vm.promotion, { mmrToNext: 0, pct: 0, matchesNeeded: 0 });
});

test('momentum exposé (7W/10 = hot)', () => {
  const events = [true,true,false,true,true,false,true,true,false,true].map((w) => ev(w, w ? 10 : -9));
  const vm = buildHudViewModel({ ...base, events });
  assert.strictEqual(vm.momentum.wins, 7);
  assert.strictEqual(vm.momentum.form, 'hot');
  assert.strictEqual(vm.boost, 70);
});

test('boost = 0 sans events', () => {
  assert.strictEqual(buildHudViewModel({ ...base }).boost, 0);
});

test('streak prend gameStreak en priorité, sinon session', () => {
  assert.strictEqual(buildHudViewModel({ ...base, gameStreak: 4 }).streak, 4);
  assert.strictEqual(buildHudViewModel({ ...base, gameStreak: null, session: { wins: 0, losses: 0, streak: 2 } }).streak, 2);
});

test('hot si streak >= 3 même momentum froid', () => {
  const vm = buildHudViewModel({ ...base, gameStreak: 3 });
  assert.strictEqual(vm.momentum.form, 'struggling');
  assert.strictEqual(vm.hot, true);
});

test('pas hot au repos', () => {
  assert.strictEqual(buildHudViewModel({ ...base }).hot, false);
});

test('timeMs = now - sessionStart, 0 si sessionStart absent', () => {
  assert.strictEqual(buildHudViewModel({ ...base, sessionStart: 1000, now: 61000 }).timeMs, 60000);
  assert.strictEqual(buildHudViewModel({ ...base, sessionStart: 0, now: 61000 }).timeMs, 0);
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — "Cannot find module '../lib/viewmodel'".

- [ ] **Step 3: Implémenter**

Create `lib/viewmodel.js` :

```js
'use strict';

const { momentum } = require('./momentum');
const { promotion, avgWinGain } = require('./promotion');

// Compose le view-model du HUD à partir d'un snapshot + de l'historique (Plan 1).
// Pur : aucune I/O, aucune dépendance Electron.
function buildHudViewModel(input) {
  const {
    mmr = null, startMmr = null, events = [], gameStreak = null,
    session = { wins: 0, losses: 0, streak: 0 }, sessionStart = 0, now = 0
  } = input || {};

  const deltaSession = (mmr != null && startMmr != null) ? mmr - startMmr : 0;
  const mom = momentum(events, 10);
  const boost = Math.round((mom.wins / Math.max(1, mom.results.length)) * 100);
  const streak = gameStreak != null ? gameStreak : (session.streak || 0);
  const hot = streak >= 3 || mom.form === 'hot';

  const promo = mmr == null
    ? { mmrToNext: 0, pct: 0, matchesNeeded: 0 }
    : promotion(mmr, avgWinGain(events));

  return {
    deltaSession,
    promotion: promo,
    momentum: mom,
    boost,
    hot,
    streak,
    timeMs: sessionStart ? now - sessionStart : 0
  };
}

module.exports = { buildHudViewModel };
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npm test`
Expected: PASS — tous les tests viewmodel passent (en plus de ceux du Plan 1).

- [ ] **Step 5: Commit**

```bash
git add lib/viewmodel.js test/viewmodel.test.js
git commit -m "feat: pure HUD view-model (delta, promotion, momentum, boost, hot)"
```

---

### Task 2: `main.js` — câbler le view-model dans le payload du poll

**Files:**
- Modify: `main.js` (import après `main.js:8` ; `sessionStart` après `main.js:86` ; set/reset dans `setOverlayVisible` `main.js:445-454` ; appel + fusion payload dans `poll()` `main.js:288-295`)

**Interfaces:**
- Consumes: `buildHudViewModel` (Task 1) ; `history.events` (Plan 1) ; `session.total`, `ref.start`, `m.streak` (existants).
- Produces: le payload IPC du poll porte désormais `promotion`, `momentum`, `boost`, `hot`, `sessionMs`. Vérification **manuelle** (app Electron), pas de test unitaire.

- [ ] **Step 1: Importer le module**

Dans `main.js`, après la ligne `const { recordSample } = require('./lib/history');` (`main.js:8`), ajouter :

```js
const { buildHudViewModel } = require('./lib/viewmodel');
```

- [ ] **Step 2: Déclarer sessionStart**

Dans `main.js`, après la ligne `let history; // état du store d'historique persistant (playlist sélectionnée)` (`main.js:86`), ajouter :

```js
let sessionStart = 0; // début de la session de jeu en cours (pour le chrono HUD), indépendant de Discord
```

- [ ] **Step 3: Démarrer/arrêter le chrono avec la visibilité**

Dans `main.js`, dans `setOverlayVisible(v)`, dans la branche `if (v) {` juste après `win.showInactive();` (`main.js:446`), ajouter :

```js
    if (!sessionStart) sessionStart = Date.now(); // démarre le chrono de session
```

Puis dans la branche `else {` du même `setOverlayVisible`, juste après `win.hide();` (`main.js:451`), ajouter :

```js
    sessionStart = 0; // hors jeu : on arrête le chrono
```

- [ ] **Step 4: Construire le view-model et l'ajouter au payload**

Dans `main.js`, dans `poll()`, remplacer le bloc de construction du payload (`main.js:288-294`) :

```js
    const payload = {
      mmr, playlist: shortPlaylist(sel),
      startMmr: ref.start, goals, saves,
      rankTier: m.tier || null, rankDiv: m.div || null, rankIcon: m.icon || null,
      gameStreak: m.streak ?? null, rankup,
      ...session.total
    };
```

par :

```js
    // View-model HUD (métriques dérivées) — source unique, renderer = affichage.
    const vm = buildHudViewModel({
      mmr, startMmr: ref.start,
      events: history ? history.events : [],
      gameStreak: m.streak ?? null,
      session: session.total,
      sessionStart, now: Date.now()
    });

    const payload = {
      mmr, playlist: shortPlaylist(sel),
      startMmr: ref.start, goals, saves,
      rankTier: m.tier || null, rankDiv: m.div || null, rankIcon: m.icon || null,
      gameStreak: m.streak ?? null, rankup,
      promotion: vm.promotion, momentum: vm.momentum,
      boost: vm.boost, hot: vm.hot, sessionMs: vm.timeMs,
      ...session.total
    };
```

- [ ] **Step 5: Vérifier le démarrage et le payload**

Run: `npm start`
Attendu : l'app démarre sans erreur de module. Avec un pseudo configuré et l'overlay visible (RL au focus, ou `forceShow`), après ≥1 poll, aucun crash. Le payload n'est pas directement inspectable sans devtools ; cette étape valide surtout l'absence d'erreur d'import/exécution. Le rendu réel est validé en Task 4.

> Note : `buildHudViewModel` tolère `history` non encore initialisé (events vides) → momentum 'struggling', boost 0, pas de crash sur une install neuve.

- [ ] **Step 6: Commit**

```bash
git add main.js
git commit -m "feat: build HUD view-model in poll and push promotion/momentum/boost/hot"
```

---

### Task 3: `theme-v2.css` — skin partagé + styles de la form Premium

**Files:**
- Create: `theme-v2.css`
- Modify: `index.html` (ajout du `<link>` dans `<head>`, après `<meta charset>` `index.html:4`)

**Interfaces:**
- Consumes: rien (CSS pur). Sera réutilisé par `hub.html` au Plan 3.
- Produces: classes `.f5` (+ enfants) et l'état `.f5.hot`. Tokens du spec V2 §5. Vérification **visuelle** (la form n'est rendue qu'en Task 4 ; ici on vérifie juste que l'overlay charge toujours sans casse).

- [ ] **Step 1: Créer le fichier de skin**

Create `theme-v2.css` :

```css
/* ============================================================
   RL Overlay V2 — skin partagé (spec §5). Réutilisé par index.html
   (form Premium f5) et hub.html (Plan 3). Scopé sous .f5 pour ne
   pas perturber les formes f0-f4 ni les thèmes cyclables.
   ============================================================ */
.f5 {
  --bg: #0a0b0e;   --card: #0e0f13;  --line: #191b22;
  --txt: #f4f5f7;  --muted: #868d9c; --dim: #5c6270;
  --aA: #5b8cff;   --aB: #b489ff;                /* froid : bleu -> violet */
  --good: #3ad29f; --loss: #ff5d6c;
  --hot: #ff9e4d;  --hot2: #ffd36b;              /* Octane : RÉSERVÉ "chaud" */

  width: 240px; margin: 3px; color: var(--txt);
}
.f5 .card {
  position: relative; padding: 13px 14px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.55);
}
/* Halo froid discret en tête de carte. */
.f5 .card::before {
  content: ''; position: absolute; top: 0; left: 16px; right: 16px; height: 1px;
  background: linear-gradient(90deg, transparent, var(--aA), var(--aB), transparent);
  opacity: 0.7;
}

/* 1 — Rank Shield + tier + playlist */
.f5 .top { display: flex; align-items: center; gap: 9px; }
.f5 .shield { width: 30px; height: 30px; object-fit: contain;
  filter: drop-shadow(0 0 6px rgba(91,140,255,0.45)); }
.f5 .tier { font-size: 12px; font-weight: 700; letter-spacing: 1.2px;
  text-transform: uppercase; color: var(--txt); }
.f5 .pl5 { margin-left: auto; font-size: 10px; letter-spacing: 1px;
  text-transform: uppercase; color: var(--muted); }

/* 2 — MMR géant + delta */
.f5 .mmrrow { display: flex; align-items: baseline; gap: 10px; margin: 6px 0 2px; }
.f5 .big { font-size: 46px; font-weight: 300; line-height: 1;
  font-variant-numeric: tabular-nums; letter-spacing: -2px; color: var(--txt);
  text-shadow: 0 0 18px rgba(91,140,255,0.25); }
.f5 .dlt { font-size: 14px; font-weight: 600; font-style: italic;
  font-variant-numeric: tabular-nums; }
.f5 .dlt.up { color: var(--good); } .f5 .dlt.down { color: var(--loss); }
.f5 .dlt.flat { color: var(--dim); }

/* 3 — Barre promotion (froid bleu->violet, tête lumineuse) */
.f5 .promo { margin: 9px 0 4px; }
.f5 .ptrack { height: 6px; border-radius: 3px; background: #15171d; overflow: hidden; }
.f5 .pfill { height: 100%; width: 0%; border-radius: 3px;
  background: linear-gradient(90deg, var(--aA), var(--aB));
  box-shadow: 0 0 10px rgba(180,137,255,0.55);
  transition: width 0.6s cubic-bezier(.2,.8,.2,1); }
.f5 .plbl { margin-top: 4px; font-size: 9px; letter-spacing: 0.6px;
  text-transform: uppercase; color: var(--muted); }

/* 4 — Momentum-10 : 10 barres pleine largeur */
.f5 .mom { display: flex; gap: 3px; margin: 8px 0 6px; }
.f5 .mbar { flex: 1; height: 14px; border-radius: 2px; background: #1c1f27; }
.f5 .mbar.win { background: var(--good); }
.f5 .mbar.loss { background: var(--loss); }

/* 5 — Barre Boost / élan (orange, visible surtout en "chaud") */
.f5 .boost { margin: 6px 0 8px; }
.f5 .btrack { height: 5px; border-radius: 3px; background: #15171d; overflow: hidden; }
.f5 .bfill { height: 100%; width: 0%; border-radius: 3px;
  background: linear-gradient(90deg, var(--hot), var(--hot2));
  opacity: 0.35; transition: width 0.5s ease, opacity 0.4s ease; }
.f5 .blbl { margin-top: 3px; font-size: 8px; letter-spacing: 1px;
  text-transform: uppercase; color: var(--dim); }

/* 6 — Pied : W/L + temps de session + pill streak */
.f5 .foot5 { display: flex; align-items: center; gap: 10px; margin-top: 6px;
  font-variant-numeric: tabular-nums; }
.f5 .foot5 .w5 { color: var(--good); font-weight: 700; }
.f5 .foot5 .l5 { color: var(--loss); font-weight: 700; }
.f5 .foot5 .sep5 { color: var(--dim); }
.f5 .foot5 .time { color: var(--muted); font-size: 11px; }
.f5 .pill { margin-left: auto; font-size: 11px; font-weight: 700;
  padding: 2px 9px; border-radius: 10px;
  color: var(--dim); background: #15171d; }
.f5 .pill.win { color: #1a1205; background: linear-gradient(90deg, var(--hot), var(--hot2)); }
.f5 .pill.loss { color: #1a0606; background: rgba(255,93,108,0.18); }

/* ---- ÉTAT CHAUD : embrasement Octane (jamais au repos) ---- */
.f5.hot .card { border-color: rgba(255,158,77,0.35); }
.f5.hot .card::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 40px;
  border-radius: 0 0 14px 14px; pointer-events: none;
  background: linear-gradient(transparent, rgba(255,158,77,0.16));
  animation: ember 2.4s ease-in-out infinite;
}
.f5.hot .bfill { opacity: 1; animation: breathe 1.8s ease-in-out infinite; }
.f5.hot .pill.win { animation: pulse 1.8s ease-in-out infinite; }
.f5.hot .mbar.glow { box-shadow: 0 0 9px rgba(255,158,77,0.85);
  background: linear-gradient(180deg, var(--hot2), var(--hot)); }
.f5.hot .dlt.up { color: var(--hot2); }

@keyframes ember   { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes breathe { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.35); } }
@keyframes pulse   { 0%,100% { box-shadow: 0 0 0 rgba(255,158,77,0); } 50% { box-shadow: 0 0 12px rgba(255,158,77,0.8); } }
```

- [ ] **Step 2: Lier le skin dans index.html**

Dans `index.html`, dans `<head>`, juste après `<meta charset="utf-8" />` (`index.html:4`), ajouter :

```html
<link rel="stylesheet" href="theme-v2.css" />
```

- [ ] **Step 3: Vérifier que l'overlay charge toujours**

Run: `npm start`
Attendu : l'overlay s'affiche normalement avec la forme courante (f0-f4). Aucune régression visuelle (le `.f5` n'est pas encore rendu). Pas d'erreur 404 bloquante (le fichier existe et est servi par `loadFile`).

- [ ] **Step 4: Commit**

```bash
git add theme-v2.css index.html
git commit -m "feat: shared V2 skin (theme-v2.css) with Premium form styles"
```

---

### Task 4: `index.html` — template `f5`, rendu `paint()`, capture du view-model

**Files:**
- Modify: `index.html` (`state` `index.html:292-296` ; `FORMS` `index.html:316-370` ; `LAYOUT_NAMES` `index.html:373` ; `paint()` `index.html:415-479` ; `onUpdate` `index.html:601-637`)

**Interfaces:**
- Consumes: champs IPC `promotion`, `momentum`, `boost`, `hot`, `sessionMs` (Task 2) ; champs existants `mmr`, `startMmr`, `rankTier`, `rankDiv`, `rankIcon`, `playlist`, `wins`, `losses`, `gameStreak`, `streak`.
- Produces: form `f5` "Premium" rendue quand `curLayout === 5`. Vérification **visuelle** via `run-rl-overlay`.

- [ ] **Step 1: Étendre l'état renderer**

Dans `index.html`, dans l'objet `state` (`index.html:292-296`), remplacer :

```js
  const state = {
    mmr: null, playlist: '2v2', rankTier: null, rankDiv: null, rankIcon: null,
    startMmr: null, wins: 0, losses: 0, streak: 0, gameStreak: null,
    goals: null, saves: null, spotify: null
  };
```

par :

```js
  const state = {
    mmr: null, playlist: '2v2', rankTier: null, rankDiv: null, rankIcon: null,
    startMmr: null, wins: 0, losses: 0, streak: 0, gameStreak: null,
    goals: null, saves: null, spotify: null,
    // Form Premium (f5) — view-model dérivé (Plan 2).
    promoPct: 0, promoMatches: 0, momResults: [], boost: 0, sessionMs: 0, hot: false
  };
```

- [ ] **Step 2: Ajouter le template f5 dans FORMS**

Dans `index.html`, dans le tableau `FORMS`, après le template F4 (la fermeture `</div>\`` de l'élément F4, `index.html:369`) et la virgule, ajouter une 6e entrée :

```js
    ,
    // F5 — Premium : Rank Shield + MMR géant + promo + Momentum-10 + élan + pied
    () => `<div class="form f5">
        <div class="card">
          <div class="top">
            <img class="shield" data-f="shield5" style="display:none" alt="">
            <span class="tier" data-f="rank">—</span>
            <span class="pl5" data-f="pl">2v2</span>
          </div>
          <div class="mmrrow"><span class="big" data-f="mmr">—</span><span class="dlt flat" data-f="delta">—</span></div>
          <div class="promo"><div class="ptrack"><div class="pfill" data-f="promoFill"></div></div><div class="plbl" data-f="promoLbl">—</div></div>
          <div class="mom" data-f="momentum"></div>
          <div class="boost"><div class="btrack"><div class="bfill" data-f="boostFill"></div></div><div class="blbl">⚡ élan</div></div>
          <div class="foot5">
            <span><b class="w5" data-f="wins">0</b> <span class="sep5">·</span> <b class="l5" data-f="losses">0</b></span>
            <span class="time" data-f="sessTime">0:00</span>
            <span class="pill" data-f="streakPill">—</span>
          </div>
          <div class="np" data-f="np"></div>
        </div>
      </div>`
```

- [ ] **Step 3: Ajouter le nom du layout**

Dans `index.html`, remplacer la ligne `LAYOUT_NAMES` (`index.html:373`) :

```js
  const LAYOUT_NAMES = ['Minimal', 'Compact', 'Compétitif', 'Dashboard', 'Boost'];
```

par :

```js
  const LAYOUT_NAMES = ['Minimal', 'Compact', 'Compétitif', 'Dashboard', 'Boost', 'Premium'];
```

- [ ] **Step 4: Peindre les champs spécifiques f5**

Dans `index.html`, dans `paint()`, juste avant la ligne `syncFx(); // recale la boîte FX si la taille de la forme a changé` (`index.html:478`), insérer :

```js
    // ---- Form Premium (f5) ----
    // Rank Shield (même source d'icône que f3).
    q('shield5').forEach((ic) => {
      if (s.rankIcon) {
        ic.onerror = () => { ic.onerror = null; ic.src = s.rankIcon; };
        ic.src = iconLocal(s.rankIcon); ic.style.display = '';
      } else { ic.style.display = 'none'; }
    });
    // Barre promotion.
    q('promoFill').forEach((e) => { e.style.width = (s.promoPct || 0) + '%'; });
    setText('promoLbl', s.promoMatches > 0 ? '▲ ' + s.promoMatches + ' victoire' + (s.promoMatches > 1 ? 's' : '') + ' vers promo' : 'Promotion');
    // Barre élan.
    q('boostFill').forEach((e) => { e.style.width = (s.boost || 0) + '%'; });
    // Momentum-10 : 10 barres, dernières victoires consécutives "glow" si chaud.
    q('momentum').forEach((el) => {
      const res = s.momResults || [];
      let trailing = 0;
      for (let i = res.length - 1; i >= 0 && res[i] === true; i--) trailing++;
      el.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const r = res[i];
        const b = document.createElement('span');
        b.className = 'mbar' + (r === true ? ' win' : r === false ? ' loss' : '');
        if (s.hot && r === true && i >= res.length - trailing) b.classList.add('glow');
        el.appendChild(b);
      }
    });
    // Temps de session mm:ss.
    const secs = Math.floor((s.sessionMs || 0) / 1000);
    setText('sessTime', Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));
    // Pill streak (réutilise la valeur de streak calculée plus bas via st).
    // Embrasement de la carte si état chaud.
    const f5 = stage.querySelector('.f5');
    if (f5) f5.classList.toggle('hot', !!s.hot);
```

Puis, toujours dans `paint()`, dans le bloc `q('streak')` qui gère la streak (`index.html:468-473`), juste après la boucle `q('streak').forEach(...)`, ajouter le rendu de la pill f5 (qui partage la valeur `st` déjà calculée à `index.html:467`) :

```js
    q('streakPill').forEach((e) => {
      e.classList.remove('win', 'loss');
      if (st > 0) { e.textContent = '🔥 ' + st; e.classList.add('win'); }
      else if (st < 0) { e.textContent = (-st) + 'L'; e.classList.add('loss'); }
      else { e.textContent = '—'; }
    });
```

- [ ] **Step 5: Capturer les nouveaux champs dans onUpdate**

Dans `index.html`, dans le handler `window.rl.onUpdate((d) => { ... })`, juste avant l'appel final `paint();` (`index.html:636`), insérer :

```js
    if (d.promotion) { state.promoPct = d.promotion.pct ?? 0; state.promoMatches = d.promotion.matchesNeeded ?? 0; }
    if (d.momentum) { state.momResults = d.momentum.results || []; }
    if (d.boost !== undefined) state.boost = d.boost;
    if (d.sessionMs !== undefined) state.sessionMs = d.sessionMs;
    if (d.hot !== undefined) state.hot = d.hot;
```

- [ ] **Step 6: Vérifier le rendu de la form Premium**

Utiliser le skill `run-rl-overlay` pour compiler et lancer l'overlay.

Procédure de vérification visuelle :
1. Lancer l'overlay (skill `run-rl-overlay`).
2. Si la form courante n'est pas Premium, appuyer `Ctrl+Alt+F` jusqu'au toast "🧩 Premium" (6e forme).
3. Attendre un poll (RL au focus, ou `forceShow` actif).

Attendu :
- Carte sombre arrondie, Rank Shield + tier en haut, MMR en gros chiffre fin, delta coloré.
- Barre promotion bleu→violet remplie selon le %, label "▲ N victoires vers promo" (ou "Promotion").
- 10 barres Momentum (grises au début sur install neuve, vert/rouge dès qu'il y a des events).
- Barre "⚡ élan" (faible au repos).
- Pied : W · L, temps mm:ss qui avance, pill streak.
- En état chaud (streak ≥ 3 ou ≥7 victoires/10) : bas de carte qui s'embrase orange, barre élan vive et "respire", pill orange pulsante.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: Premium HUD form (f5) — shield, momentum-10, promo & boost bars"
```

---

### Task 5: Faire de la form Premium le défaut au premier lancement

**Files:**
- Modify: `main.js` (`LAYOUT_COUNT` `main.js:194` ; `DEFAULT_CONFIG.overlay.layout` `main.js:24`)

**Interfaces:**
- Consumes: form `f5` (Task 4) ; `LAYOUT_NAMES` à 6 entrées (Task 4).
- Produces: le cycle `Ctrl+Alt+F` couvre 6 formes ; une install neuve démarre sur Premium. Vérification **manuelle**.

- [ ] **Step 1: Étendre le nombre de layouts**

Dans `main.js`, remplacer la ligne `const LAYOUT_COUNT = 5;` (`main.js:194`) par :

```js
const LAYOUT_COUNT = 6;
```

- [ ] **Step 2: Mettre Premium par défaut**

Dans `main.js`, dans `DEFAULT_CONFIG.overlay` (`main.js:24`), remplacer `layout: 0` par `layout: 5` :

```js
  overlay: { anchor: 'bottom-right', marginX: 320, marginY: 50, x: 20, y: 20, clickThrough: true, theme: 0, layout: 5 },
```

- [ ] **Step 3: Vérifier le cycle et le défaut**

Vérification cycle (config existante) :
Run: `npm start`
Appuyer `Ctrl+Alt+F` 6 fois : le toast doit défiler Minimal → Compact → Compétitif → Dashboard → Boost → Premium → (retour Minimal). Aucune forme vide.

Vérification défaut (install neuve) — simuler une première config :
1. Fermer l'overlay (`run-rl-overlay` gère le kill, ou Gestionnaire des tâches sur `RL Overlay.exe`).
2. Renommer/supprimer `config.json` :
   Run: `Rename-Item "$env:APPDATA\rl-overlay\config.json" config.bak.json`
3. Relancer, refaire la config (pseudo) dans la fenêtre de setup.
4. Attendu : l'overlay s'ouvre directement sur la form **Premium** (layout 5 du `DEFAULT_CONFIG`).
5. Restaurer l'ancienne config si besoin :
   Run: `Rename-Item "$env:APPDATA\rl-overlay\config.bak.json" config.json`

> Note : `loadConfig` fait un merge superficiel (`{ ...DEFAULT_CONFIG, ...raw }`) ; les utilisateurs existants gardent leur `overlay.layout` sauvegardé. Seules les configs neuves héritent du défaut Premium. (`main.js:32-39`.)

- [ ] **Step 4: Commit**

```bash
git add main.js
git commit -m "feat: default the HUD to the Premium form on fresh installs"
```

---

## Self-Review

**1. Spec coverage (addendum rendu §2 HUD + §3 view-model + §4 skin + §6 détails) :**
- HUD = `BrowserWindow` click-through inchangé, nouvelle form `f5` → Tasks 3-4. f5 défaut, f0-f4 conservées au cycle → Task 5. ✅
- View-model unique calculé côté `main`, push IPC, renderer = affichage → Task 1 (pur) + Task 2 (intégration). Aucun `require('./lib')` ajouté à `index.html`. ✅
- Champs view-model HUD du spec (rank/mmr/deltaSession/promotion/momentum/session/hot) : couverts (promotion, momentum, boost, hot, sessionMs poussés ; rank/mmr/delta/streak déjà présents). ✅
- Skin partagé `theme-v2.css` (tokens spec §5), inclus par `index.html`, prêt pour `hub.html` (Plan 3) → Task 3. État `hot` = embrasement Octane, froid au repos → CSS `.f5` / `.f5.hot`. ✅
- Form `f5` = 6 zones du spec §6 (Shield+tier+playlist, MMR géant+delta, barre promo, Momentum-10, barre élan, pied W/L+temps+pill streak) → Task 4 template + paint. ✅
- Détails tranchés §6 : label "élan" (Task 4, `<div class="blbl">⚡ élan</div>`). `Ctrl+Alt+Space` du Hub = **hors Plan 2** (Plan 3). ✅

**2. Placeholder scan :** aucun "TBD/TODO" ; chaque étape porte du code complet et des commandes exactes. Les tâches renderer/intégration sont explicitement marquées "vérification visuelle/manuelle" (pas de test unitaire possible sur le DOM Electron ; le seam testable — `buildHudViewModel` — est couvert en TDD Task 1). ✅

**3. Type consistency :**
- `buildHudViewModel` (Task 1) renvoie `{ promotion:{mmrToNext,pct,matchesNeeded}, momentum:{results,wins,losses,form,label}, boost, hot, ... }`. Task 2 pousse `promotion`, `momentum`, `boost`, `hot`, `sessionMs(=vm.timeMs)`. Task 4 lit `d.promotion.pct`, `d.promotion.matchesNeeded`, `d.momentum.results`, `d.boost`, `d.hot`, `d.sessionMs` → noms cohérents. ✅
- `promotion()`/`momentum()`/`avgWinGain()` consommés avec les signatures du Plan 1 (Tasks 4/5 du Plan 1). ✅
- `LAYOUT_NAMES` (6 entrées, Task 4) et `LAYOUT_COUNT = 6` (Task 5) alignés ; `FORMS` a bien 6 templates (Task 4). ✅
- `data-f` de f5 (`shield5`, `promoFill`, `promoLbl`, `momentum`, `boostFill`, `sessTime`, `streakPill`) distincts des `data-f` de f0-f4 (notamment `barFill`/`barNext` non réutilisés) → pas de collision dans `paint()`. ✅

> Hors périmètre Plan 2 (couverts Plan 3) : fenêtre Hub `hub.html`, raccourci `Ctrl+Alt+Space`, Ranked Journey, Objectifs, Daily Challenge, Consistency/Confidence/Tilt visuels, Smart Insights, Peak Tracker. Le Plan 2 ne touche que le HUD in-game et la couche view-model qui l'alimente.
