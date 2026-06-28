# Setup 2 étapes (thème + aperçu) + page touches — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Au 1er lancement, après le pseudo, choisir son thème sur un 2e écran de setup avec aperçu live du panneau Premium ; puis ouvrir le Hub avec une page des touches thémée et minimaliste (auto une fois, puis bouton ?).

**Architecture:** `setup.html` devient un assistant 2 écrans ; l'écran 2 applique le thème au `<body>` (themes.css scope `body.tN`) pour recolorer un panneau `.f5` d'exemple. `main.js` persiste `config.overlay.theme`, et au tout premier setup ouvre le Hub en signalant `_showKeys`. `hub.html` gagne une surcouche page-touches thémée, un bouton `?`, et une gestion d'Échap (ferme la page touches sinon le Hub).

**Tech Stack:** Electron (existant), HTML/CSS/JS pur, themes.css + theme-v2.css (existants). Pas de dépendance nouvelle. Fonctionnalité GUI → vérification manuelle (pas de tests unitaires nouveaux).

## Global Constraints

- Aucune dépendance npm nouvelle. CommonJS côté main.
- **Ne JAMAIS forcer le HUD in-game visible** : aucun appel à `forceShow`/`setOverlayVisible(true)` ; seul le Hub s'affiche au 1er lancement.
- Thèmes : 6 (indices 0-5), `THEME_COUNT = 6`. Thème 0 = `:root` (pas de classe), 1-5 = `body.tN`. Tokens dans `themes.css`.
- Page touches **minimaliste** : touches debug `Ctrl+Alt+W/G/E` **non listées**.
- La suite `node:test` existante doit rester verte (64/64) — aucune logique `lib/` modifiée.

---

### Task 1: Setup 2 étapes + choix thème avec aperçu Premium

**Files:**
- Modify: `setup.html` (réécriture : 2 écrans + grille thèmes + aperçu `.f5`)
- Modify: `setup-preload.js` (exposer `getTheme`)
- Modify: `main.js` (`createSetupWindow` taille `main.js:458-466` ; `save-setup` ajout `theme` `main.js:438-452` ; handler `get-setup-theme`)

**Interfaces:**
- Consumes: `themes.css` (`:root` + `body.t1..t5`), `theme-v2.css` (`.f5` + enfants).
- Produces: payload `save-setup` = `{ platform, username, theme }` (theme: number 0-5). `config.overlay.theme` persisté. `window.setup.getTheme(): Promise<number>` (thème courant, pour préselectionner — évite de réinitialiser le thème lors d'une reconfiguration `Ctrl+Alt+P`).

- [ ] **Step 1: Agrandir la fenêtre de setup**

Dans `main.js`, `createSetupWindow` (`main.js:459-461`), remplacer :

```js
  setupWin = new BrowserWindow({
    width: 380, height: 440,
    resizable: false, frame: true, title: 'RL Overlay — Configuration',
```

par :

```js
  setupWin = new BrowserWindow({
    width: 470, height: 660,
    resizable: false, frame: true, title: 'RL Overlay — Configuration',
```

- [ ] **Step 2: Réécrire `setup.html` (2 écrans + aperçu thème)**

Remplacer **tout** le contenu de `setup.html` par :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="themes.css" />
<link rel="stylesheet" href="theme-v2.css" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: radial-gradient(120% 120% at 50% 0%, #14203c 0%, #0a0f1e 70%);
    color: #e9eefc; padding: 22px; height: 100vh; overflow: hidden;
  }
  .logo { display: flex; align-items: center; gap: 9px; margin-bottom: 6px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #ff7e1e; box-shadow: 0 0 10px #ff7e1e; }
  h1 { font-size: 17px; letter-spacing: 0.5px; }
  p.sub { font-size: 12px; color: #8794b8; margin-bottom: 18px; }
  label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8794b8; margin: 16px 0 6px; }
  select, input {
    width: 100%; padding: 11px 12px; font-size: 14px;
    background: rgba(255,255,255,0.06); color: #e9eefc;
    border: 1px solid rgba(120,160,255,0.25); border-radius: 8px; outline: none;
  }
  input:focus, select:focus { border-color: #6cc6ff; }
  select option { background: #14203c; }
  .hint { font-size: 10px; color: #6b7596; margin-top: 6px; }
  button.primary {
    width: 100%; margin-top: 24px; padding: 13px; font-size: 15px; font-weight: 700;
    color: #04130b; cursor: pointer; border: none; border-radius: 9px;
    background: linear-gradient(90deg, #4cf08a, #2fd673);
    box-shadow: 0 0 16px rgba(76,240,138,0.35); transition: transform 0.1s ease;
  }
  button.primary:hover { transform: translateY(-1px); }
  button.primary:disabled { background: #2a3550; color: #6b7596; box-shadow: none; cursor: default; transform: none; }
  .err { color: #ff6b6b; font-size: 12px; margin-top: 12px; min-height: 16px; }
  .back { background: none; border: none; color: #8794b8; font-size: 12px; cursor: pointer; margin-top: 14px; }
  .back:hover { color: #e9eefc; }

  /* étapes */
  #step2 { display: none; }
  body.s2 #step1 { display: none; }
  body.s2 #step2 { display: block; }

  /* grille de thèmes */
  .themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 6px; }
  .sw { cursor: pointer; border: 2px solid transparent; border-radius: 10px; padding: 8px; background: rgba(255,255,255,0.04); text-align: center; transition: .12s; }
  .sw:hover { background: rgba(255,255,255,0.08); }
  .sw.sel { border-color: #6cc6ff; box-shadow: 0 0 0 2px rgba(108,198,255,0.25); }
  .sw .name { font-size: 11px; font-weight: 600; margin-bottom: 6px; }
  .sw .dots { display: flex; gap: 3px; justify-content: center; }
  .sw .dots i { width: 16px; height: 10px; border-radius: 3px; }

  /* aperçu : stage neutre pour lire la translucidité */
  .prev-stage { margin: 14px 0 4px; border-radius: 12px; padding: 16px; display: flex; justify-content: center;
    background: repeating-linear-gradient(45deg, #2b2f37 0 14px, #262a31 14px 28px); }
</style>
</head>
<body>
  <div class="logo"><span class="dot"></span><h1>RL Overlay</h1></div>

  <!-- ÉTAPE 1 : profil -->
  <div id="step1">
    <p class="sub">Configure ton profil pour afficher tes stats Rocket League.</p>
    <label for="platform">Plateforme</label>
    <select id="platform">
      <option value="epic">Epic Games</option>
      <option value="steam">Steam</option>
      <option value="psn">PlayStation</option>
      <option value="xbl">Xbox</option>
      <option value="switch">Nintendo Switch</option>
    </select>
    <label for="username">Pseudo / ID</label>
    <input id="username" type="text" placeholder="Ton pseudo exact (ex: TonPseudo)" autofocus />
    <div class="hint">Le même que sur ton profil Tracker. Ton profil doit être public.</div>
    <button id="next" class="primary" disabled>Suivant</button>
  </div>

  <!-- ÉTAPE 2 : thème + aperçu -->
  <div id="step2">
    <p class="sub">Choisis ton thème. L'aperçu se met à jour en direct.</p>
    <div class="themes" id="themes"></div>
    <div class="prev-stage">
      <div id="preview">
        <div class="f5"><div class="card">
          <div class="top"><span class="tier">Diamond II</span><span class="pl5">2v2</span></div>
          <div class="mmrrow"><span class="big">1024</span><span class="dlt up">▲ +42</span></div>
          <div class="promo"><div class="ptrack"><div class="pfill" style="width:73%"></div></div><div class="plbl">▲ 2 victoires vers promo</div></div>
          <div class="mom">
            <span class="mbar win"></span><span class="mbar win"></span><span class="mbar loss"></span><span class="mbar win"></span><span class="mbar loss"></span>
            <span class="mbar win"></span><span class="mbar win"></span><span class="mbar win glow"></span><span class="mbar win glow"></span><span class="mbar win glow"></span>
          </div>
          <div class="boost"><div class="btrack"><div class="bfill" style="width:82%"></div></div><div class="blbl">⚡ élan</div></div>
          <div class="foot5">
            <span><b class="w5">6</b> <span class="sep5">·</span> <b class="l5">2</b></span>
            <span class="time">1:12</span>
            <span class="pill win">🔥 4</span>
          </div>
        </div></div>
      </div>
    </div>
    <button id="go" class="primary">Démarrer l'overlay</button>
    <button id="back" class="back">← Retour</button>
    <div class="err" id="err"></div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);
  const input = $('username'), next = $('next');
  const THEMES = [
    { name: 'Octane',   dots: ['#ff8a3d','#ffc24d','#46d39a'] },
    { name: 'Cryo',     dots: ['#39c5ff','#7af0e0','#37e0c0'] },
    { name: 'Synthwave',dots: ['#ff3db4','#8a5bff','#3df0c0'] },
    { name: 'Mono',     dots: ['#e8eaee','#9aa0aa','#cfd3da'] },
    { name: 'Acid',     dots: ['#b6ff3d','#5fd17a','#e6ff9c'] },
    { name: 'Crimson',  dots: ['#ff3b4e','#ff8a3d','#46d39a'] },
  ];
  let selTheme = 0;

  input.addEventListener('input', () => { next.disabled = input.value.trim().length === 0; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !next.disabled) next.click(); });
  next.addEventListener('click', () => { document.body.classList.add('s2'); });
  $('back').addEventListener('click', () => { document.body.classList.remove('s2'); });

  // grille de thèmes + sélection (applique body.tN -> recolore le .f5)
  const grid = $('themes');
  THEMES.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'sw' + (i === 0 ? ' sel' : '');
    el.innerHTML = `<div class="name">${t.name}</div><div class="dots">${t.dots.map(c => `<i style="background:${c}"></i>`).join('')}</div>`;
    el.addEventListener('click', () => {
      selTheme = i;
      document.querySelectorAll('.sw').forEach((s) => s.classList.remove('sel'));
      el.classList.add('sel');
      document.body.classList.remove('t1','t2','t3','t4','t5');
      if (i) document.body.classList.add('t' + i);
    });
    grid.appendChild(el);
  });

  // Préselectionne le thème courant (reconfiguration Ctrl+Alt+P : ne pas réinitialiser).
  if (window.setup.getTheme) {
    window.setup.getTheme().then((t) => {
      selTheme = ((t | 0) % 6 + 6) % 6;
      document.querySelectorAll('.sw').forEach((s, idx) => s.classList.toggle('sel', idx === selTheme));
      document.body.classList.remove('t1','t2','t3','t4','t5');
      if (selTheme) document.body.classList.add('t' + selTheme);
    }).catch(() => {});
  }

  $('go').addEventListener('click', async () => {
    $('go').disabled = true; $('err').textContent = '';
    try {
      await window.setup.save({ platform: $('platform').value, username: input.value.trim(), theme: selTheme });
    } catch (e) {
      $('err').textContent = 'Erreur : ' + e.message;
      $('go').disabled = false;
    }
  });
</script>
</body>
</html>
```

- [ ] **Step 3: Exposer `getTheme` dans le preload**

Remplacer tout `setup-preload.js` par :

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setup', {
  save: (data) => ipcRenderer.invoke('save-setup', data),
  getTheme: () => ipcRenderer.invoke('get-setup-theme')
});
```

- [ ] **Step 4: Handler `get-setup-theme` + persistance du thème dans `save-setup`**

Dans `main.js`, juste après `ipcMain.handle('hub-close', () => closeHub());` (`main.js:434`), ajouter :

```js
ipcMain.handle('get-setup-theme', () => (loadConfig().overlay.theme || 0));
```

Puis dans `save-setup` (`main.js:438-444`), après `cfg.username = newUser;` ajouter :

```js
  if (data.theme != null) {
    const t = parseInt(data.theme, 10);
    if (!Number.isNaN(t)) cfg.overlay.theme = ((t % THEME_COUNT) + THEME_COUNT) % THEME_COUNT;
  }
```

- [ ] **Step 5: Vérifier (manuel)**

```bash
# repartir d'une config vierge pour tomber sur le setup
powershell -NoProfile -Command "Remove-Item \"$env:APPDATA\rl-overlay\config.json\" -ErrorAction SilentlyContinue"
npm start
```
Attendu : fenêtre setup (470×660). Écran 1 = pseudo (bouton **Suivant** activé quand pseudo rempli). Clic Suivant → écran 2 : 6 swatches, l'aperçu Premium se **recolore** au clic d'un thème. « ← Retour » revient à l'écran 1. « Démarrer » ferme le setup et lance l'overlay. Vérifier `config.json` : `overlay.theme` = l'index choisi.

- [ ] **Step 6: Commit**

```bash
git add setup.html setup-preload.js main.js
git commit -m "feat: 2-step setup with theme picker + live Premium preview"
```

---

### Task 2: Page des touches dans le Hub (thémée, minimaliste, bouton ?)

**Files:**
- Modify: `hub.html` (CSS surcouche + bouton ; markup `#keys` + `#keys-toggle` ; JS toggle/Échap/`_showKeys`)

**Interfaces:**
- Consumes: champ `_showKeys` (booléen) du payload `hub-update` (produit par Task 3) ; tokens themes.css.
- Produces: surcouche `#keys` togglable via `body.show-keys`.

- [ ] **Step 1: Ajouter le CSS de la page touches**

Dans `hub.html`, dans le `<style>`, juste avant `.hint { ... }` (`hub.html:73`), insérer :

```css
  /* Bouton ? (rouvre la page touches) */
  #keys-toggle { position: fixed; top: 12px; right: 14px; width: 30px; height: 30px; border-radius: 50%;
    border: 1px solid var(--line); background: var(--card); color: var(--aA); font-size: 15px; font-weight: 800;
    cursor: pointer; z-index: 60; box-shadow: 0 4px 14px rgba(0,0,0,0.5); }
  #keys-toggle:hover { border-color: var(--aA); }

  /* Surcouche page touches */
  #keys { position: fixed; inset: 0; z-index: 70; display: none;
    background: color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter: blur(6px);
    padding: 40px 48px; overflow: auto; }
  body.show-keys #keys { display: block; }
  #keys h2 { font-size: 20px; font-weight: 800; letter-spacing: -.3px; margin-bottom: 4px; }
  #keys .ksub { color: var(--muted); font-size: 13px; margin-bottom: 22px; }
  #keys .kgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 28px; max-width: 760px; }
  #keys .kgroup .gh { font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--aA); margin-bottom: 8px; }
  #keys .krow { display: flex; align-items: center; gap: 10px; padding: 5px 0; }
  #keys .keycap { font-size: 11px; font-weight: 700; white-space: nowrap; color: var(--txt);
    background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px; }
  #keys .kdesc { font-size: 13px; color: var(--txt); }
  #keys .kclose { position: absolute; top: 24px; right: 28px; font-size: 13px; color: var(--muted); cursor: pointer; }
  #keys .kclose:hover { color: var(--txt); }
```

- [ ] **Step 2: Ajouter le markup (bouton ? + surcouche)**

Dans `hub.html`, juste après `<div class="hint">Échap ou Ctrl+Alt+Espace pour fermer</div>` (`hub.html:134`), insérer :

```html
  <button id="keys-toggle" title="Raccourcis clavier">?</button>
  <div id="keys">
    <span class="kclose" id="keys-close">✕ Fermer (Échap)</span>
    <h2>Raccourcis</h2>
    <div class="ksub">Toutes les actions se font au clavier, en jeu comme hors jeu.</div>
    <div class="kgrid">
      <div class="kgroup">
        <div class="gh">Affichage</div>
        <div class="krow"><span class="keycap">Ctrl + Alt + H</span><span class="kdesc">Montrer / cacher l'overlay</span></div>
        <div class="krow"><span class="keycap">Ctrl + Alt + Flèches</span><span class="kdesc">Déplacer l'overlay</span></div>
      </div>
      <div class="kgroup">
        <div class="gh">Apparence</div>
        <div class="krow"><span class="keycap">Ctrl + Alt + F</span><span class="kdesc">Changer de forme</span></div>
        <div class="krow"><span class="keycap">Ctrl + Alt + T</span><span class="kdesc">Changer de thème</span></div>
      </div>
      <div class="kgroup">
        <div class="gh">Stats</div>
        <div class="krow"><span class="keycap">Ctrl + Alt + 1 / 2 / 3</span><span class="kdesc">Playlist (1v1 / 2v2 / 3v3)</span></div>
        <div class="krow"><span class="keycap">Ctrl + Alt + R</span><span class="kdesc">Réinitialiser la session</span></div>
        <div class="krow"><span class="keycap">Ctrl + Alt + Espace</span><span class="kdesc">Ouvrir / fermer ce tableau de bord</span></div>
      </div>
      <div class="kgroup">
        <div class="gh">Réglages</div>
        <div class="krow"><span class="keycap">Ctrl + Alt + S</span><span class="kdesc">Fréquence de rafraîchissement</span></div>
        <div class="krow"><span class="keycap">Ctrl + Alt + D</span><span class="kdesc">Présence Discord</span></div>
        <div class="krow"><span class="keycap">Ctrl + Alt + P</span><span class="kdesc">Reconfigurer le pseudo</span></div>
      </div>
    </div>
  </div>
```

- [ ] **Step 3: JS — toggle, _showKeys, gestion Échap**

Dans `hub.html`, dans `paint(vm)`, juste après le bloc thème (`if (vm._theme != null) { ... }`) — c.-à-d. avant `document.body.classList.toggle('hot', ...)` — ajouter :

```js
    if (vm._showKeys) document.body.classList.add('show-keys'); // auto au 1er lancement
```

Puis remplacer le bloc final (`hub.html:238-240`) :

```js
  window.hub.onUpdate(paint);
  // Échap ferme le Hub (lecture seule : seul input autorisé).
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.hub.close(); });
```

par :

```js
  window.hub.onUpdate(paint);

  const keysOn = () => document.body.classList.contains('show-keys');
  document.getElementById('keys-toggle').addEventListener('click', () => document.body.classList.toggle('show-keys'));
  document.getElementById('keys-close').addEventListener('click', () => document.body.classList.remove('show-keys'));
  // clic sur le fond de la surcouche (pas sur le contenu) -> ferme
  document.getElementById('keys').addEventListener('click', (e) => { if (e.target.id === 'keys') document.body.classList.remove('show-keys'); });
  // Échap : ferme d'abord la page touches si ouverte, sinon ferme le Hub.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (keysOn()) { document.body.classList.remove('show-keys'); }
    else { window.hub.close(); }
  });
```

- [ ] **Step 4: Vérifier (manuel)**

```bash
npm start
```
Ouvrir le Hub avec `Ctrl+Alt+Espace`. Cliquer le bouton **?** (coin haut-droit) → la page touches s'affiche (thémée, 4 groupes, sans W/G/E). `Échap` ferme la page touches (Hub toujours ouvert) ; `Échap` à nouveau ferme le Hub. Cliquer le fond de la surcouche la ferme aussi. Changer de thème (`Ctrl+Alt+T`) → la page touches suit le thème.

- [ ] **Step 5: Commit**

```bash
git add hub.html
git commit -m "feat: themed keybindings overlay in Hub (? button, Esc handling)"
```

---

### Task 3: Ouverture auto au 1er lancement (Hub + page touches, une seule fois)

**Files:**
- Modify: `main.js` (`save-setup` `main.js:438-452` ; `pushHub` `main.js:366-370`)

**Interfaces:**
- Consumes: `openHub()`, `pushHub()`, `startOverlay()`, `loadConfig()/saveConfig()` (existants) ; champ `_showKeys` consommé par Task 2.
- Produces: au 1er setup, Hub ouvert + `_showKeys: true` poussé une fois ; `config.overlay.tutoSeen = true`.

- [ ] **Step 1: Flag one-shot + push `_showKeys` dans `pushHub`**

Dans `main.js`, juste avant `function pushHub()` (`main.js:366`), ajouter :

```js
let showKeysOnce = false; // arme l'affichage de la page touches au prochain push Hub
```

Puis remplacer `pushHub` (`main.js:366-370`) :

```js
function pushHub() {
  if (hubWin && !hubWin.isDestroyed() && lastVm) {
    const theme = (loadConfig().overlay.theme || 0) % THEME_COUNT;
    hubWin.webContents.send('hub-update', { ...lastVm, _theme: theme });
  }
}
```

par :

```js
function pushHub() {
  if (hubWin && !hubWin.isDestroyed() && lastVm) {
    const theme = (loadConfig().overlay.theme || 0) % THEME_COUNT;
    const payload = { ...lastVm, _theme: theme };
    if (showKeysOnce) { payload._showKeys = true; showKeysOnce = false; }
    hubWin.webContents.send('hub-update', payload);
  }
}
```

- [ ] **Step 2: Déclencher l'ouverture au tout premier setup**

Dans `main.js`, `save-setup`, remplacer le bloc (`main.js:448-451`) :

```js
  if (!overlayStarted) startOverlay(); // 1er lancement
  else poll();                          // reconfiguration : on rafraîchit
  if (setupWin && !setupWin.isDestroyed()) setupWin.close();
  return true;
```

par :

```js
  const firstRun = !overlayStarted && !cfg.overlay.tutoSeen;
  if (!overlayStarted) startOverlay(); // 1er lancement (NE force PAS la visibilité du HUD)
  else poll();                          // reconfiguration : on rafraîchit
  if (setupWin && !setupWin.isDestroyed()) setupWin.close();
  if (firstRun) {
    cfg.overlay.tutoSeen = true; saveConfig(cfg); // page touches : auto une seule fois
    showKeysOnce = true;
    openHub(); // pushHub() est appelé au did-finish-load du Hub -> envoie _showKeys
  }
  return true;
```

- [ ] **Step 3: Vérifier (manuel) — 1er lancement**

```bash
powershell -NoProfile -Command "Remove-Item \"$env:APPDATA\rl-overlay\config.json\" -ErrorAction SilentlyContinue"
npm start
```
Faire le setup (pseudo → thème → Démarrer). Attendu : le **Hub s'ouvre tout seul** avec la **page touches affichée** d'office, dans le thème choisi. **Le HUD in-game ne s'affiche PAS** (pas de RL au premier plan). `config.json` contient `overlay.tutoSeen: true`.

- [ ] **Step 4: Vérifier (manuel) — relances suivantes**

Fermer l'app, relancer :
```bash
npm start
```
Attendu : pas de setup (déjà configuré), **pas d'ouverture auto** du Hub ni de la page touches. `Ctrl+Alt+Espace` ouvre le Hub sans la page touches ; le bouton **?** la rouvre.

- [ ] **Step 5: Vérifier la suite de tests**

Run: `npm test`
Expected : 64/64 vert (aucune logique `lib/` touchée).

- [ ] **Step 6: Commit**

```bash
git add main.js
git commit -m "feat: first-run opens Hub with keybindings page once (tutoSeen)"
```

---

## Notes d'exécution

- Fonctionnalité **GUI** : la validation principale est manuelle (3 vérifs ci-dessus). Pas de tests unitaires nouveaux ; la suite existante sert de garde anti-régression.
- Vérifications GUI sous Windows : penser à tuer une instance résiduelle avant `npm start` (`Get-Process electron,'RL Overlay' | Stop-Process -Force`) sinon le single-instance lock fait quitter la nouvelle.
- `setup.html` lie themes.css : ces variables ne stylent que le `.f5` d'aperçu (le reste du setup garde ses couleurs littérales) → pas de régression visuelle du setup.
