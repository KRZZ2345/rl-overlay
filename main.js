const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { fetchStats, closeHidden } = require('./tracker');
const { DiscordRPC } = require('./discord-rpc');
const { loadHistory, saveHistory } = require('./lib/history-store');
const { recordSample } = require('./lib/history');

// Nom du process de Rocket League (sans .exe) tel que renvoyé par Get-Process.
const RL_PROCESS = 'RocketLeague';

// Les fichiers modifiables vont dans userData (écriture autorisée même quand
// l'app est packagée en .exe). __dirname serait en lecture seule (asar).
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const SESSION_PATH = path.join(app.getPath('userData'), 'session.json');
const HISTORY_PATH = path.join(app.getPath('userData'), 'history.json');

const DEFAULT_CONFIG = {
  platform: 'epic',
  username: '',
  playlist: 'ranked-doubles',
  pollSeconds: 15,
  overlay: { anchor: 'bottom-right', marginX: 320, marginY: 50, x: 20, y: 20, clickThrough: true, theme: 0, layout: 0 },
  // Discord Rich Presence : affiche MMR/rang live sur ton profil Discord.
  // clientId = "Application ID" d'une app creee sur discord.com/developers
  // (1 min, voir README). Vide = desactive. largeImageKey = cle d'un asset
  // uploade sur l'app (optionnel) ; sinon pas d'image.
  discord: { enabled: true, clientId: '', largeImageKey: '', showProfileButton: true }
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^﻿/, ''); // retire un BOM éventuel
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// L'app est-elle configurée ? (pseudo renseigné)
function isConfigured() {
  const c = loadConfig();
  return c.username && c.username.trim() && c.username !== 'TON_PSEUDO_ICI';
}

// Date du jour (YYYY-MM-DD) en local : sert de clé de "session du jour".
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Etat de session du JOUR, remis à zéro au changement de date.
// total : compteur W/L/streak GLOBAL (tous modes confondus).
// mmr   : dernier MMR + MMR de départ vus pour chaque mode (sert à détecter W/L
//         et à afficher le delta de la playlist sélectionnée).
function freshSession() {
  return { date: today(), total: { wins: 0, losses: 0, streak: 0 }, mmr: {}, goalsBase: null, savesBase: null };
}

function loadSession() {
  let s;
  try { s = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')); } catch { s = null; }
  // Nouveau jour ou format obsolète -> on repart à zéro.
  if (!s || !s.total || !s.mmr || s.date !== today()) s = freshSession();
  return s;
}

function saveSession(s) {
  fs.writeFileSync(SESSION_PATH, JSON.stringify(s, null, 2));
}

// Référence MMR (dernier vu + départ) pour un mode donné aujourd'hui.
function mmrRef(pl) {
  if (session.date !== today()) session = freshSession();
  if (!session.mmr[pl]) session.mmr[pl] = { last: null, start: null };
  return session.mmr[pl];
}

let win;
let session;
let history; // état du store d'historique persistant (playlist sélectionnée)
let clickThrough = true;

// --- Discord Rich Presence ---
let rpc = null;
let presenceStart = 0; // timestamp de debut de session de jeu (pour le chrono)

function profileUrl(cfg) {
  return `https://rocketleague.tracker.network/rocket-league/profile/${cfg.platform}/${encodeURIComponent(cfg.username)}/overview`;
}

// (Re)connecte le RPC selon la config. Idempotent.
function ensureRpc() {
  const cfg = loadConfig();
  if (!cfg.discord || !cfg.discord.enabled || !cfg.discord.clientId) {
    if (rpc) { rpc.close(); rpc = null; }
    return;
  }
  if (rpc && rpc.clientId !== cfg.discord.clientId) { rpc.close(); rpc = null; }
  if (!rpc) { rpc = new DiscordRPC(cfg.discord.clientId); rpc.onFrame = (j) => logFocus(`RPC frame ${j.slice(0, 300)}`); rpc.connect(); logFocus(`RPC create clientId=${cfg.discord.clientId}`); }
}

// Construit et pousse l'activite Discord a partir des donnees d'un poll.
function updatePresence(data) {
  ensureRpc();
  if (!rpc) return;
  const cfg = loadConfig();
  if (!presenceStart) presenceStart = Date.now();

  const parts = [];
  if (data.playlist) parts.push(data.playlist);
  if (data.mmr != null) parts.push(`${data.mmr} MMR`);
  const details = parts.join(' • ') || 'Rocket League';

  let state = '';
  if (data.rankTier) state = data.rankDiv ? `${data.rankTier} • ${data.rankDiv}` : data.rankTier;
  const wl = `${data.wins ?? 0}V ${data.losses ?? 0}D`;
  const streak = data.streak ? `  (${data.streak > 0 ? '🔥' : '❄'}${Math.abs(data.streak)})` : '';
  state = state ? `${state}  —  ${wl}${streak}` : `${wl}${streak}`;

  const activity = {
    details,
    state,
    timestamps: { start: presenceStart },
    instance: false
  };
  if (cfg.discord.largeImageKey) {
    activity.assets = { large_image: cfg.discord.largeImageKey, large_text: 'RL Overlay' };
  }
  if (cfg.discord.showProfileButton && cfg.username) {
    activity.buttons = [{ label: 'Profil Tracker', url: profileUrl(cfg) }];
  }
  rpc.setActivity(activity);
  logFocus(`RPC push connected=${rpc.connected} details="${details}" state="${state}"`);
}

function clearPresence() {
  presenceStart = 0;
  if (rpc) rpc.clear();
}

function createWindow() {
  const cfg = loadConfig();
  clickThrough = cfg.overlay.clickThrough;

  // Fenêtre élargie : laisse la place aux formes qui encadrent la jauge de boost.
  // Les formes "carte" restent ancrées en haut-gauche (margin du .panel) -> même
  // position à l'écran qu'avant. Les formes "Boost/Colonne" utilisent tout l'espace.
  const W = 300, H = 260;
  // Par défaut on ancre l'overlay en bas à droite, près de la jauge de boost.
  const work = screen.getPrimaryDisplay().workAreaSize;
  const mx = cfg.overlay.marginX ?? 28;
  const my = cfg.overlay.marginY ?? 96; // remonté pour ne pas masquer le boost
  let posX = work.width - W - mx;
  let posY = work.height - H - my;
  if (cfg.overlay.anchor === 'free') { posX = cfg.overlay.x ?? posX; posY = cfg.overlay.y ?? posY; }

  win = new BrowserWindow({
    width: W,
    height: H,
    x: posX,
    y: posY,
    show: false, // caché tant que Rocket League n'est pas au premier plan
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  // Toujours au-dessus, même par-dessus un jeu en plein écran fenêtré.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(clickThrough, { forward: true });
  // Applique le thème mémorisé dès que la page est prête.
  win.webContents.on('did-finish-load', () => {
    const o = loadConfig().overlay;
    sendUpdate({ theme: o.theme || 0, layout: o.layout || 0 });
  });
  win.loadFile('index.html');
}

const THEME_COUNT = 8;
const LAYOUT_COUNT = 5;

// Passe au thème suivant, persiste, et notifie le renderer (avec toast).
function cycleTheme() {
  const cfg = loadConfig();
  const next = (((cfg.overlay.theme || 0) + 1) % THEME_COUNT);
  cfg.overlay.theme = next;
  saveConfig(cfg);
  sendUpdate({ theme: next, themeToast: true });
}

// Passe à la forme (layout) suivante, persiste, et notifie le renderer.
function cycleLayout() {
  const cfg = loadConfig();
  const next = (((cfg.overlay.layout || 0) + 1) % LAYOUT_COUNT);
  cfg.overlay.layout = next;
  saveConfig(cfg);
  sendUpdate({ layout: next, layoutToast: true });
}

// Buts / saves du JOUR = total carrière actuel - référence prise en début de
// journée. Ces compteurs sont communs à toutes les playlists (pas de reset au
// changement de playlist), et repartent à zéro au changement de date.
function dayDelta(field, current) {
  const baseKey = field + 'Base';
  if (current == null) return session[baseKey] != null ? 0 : 0;
  if (session[baseKey] == null) session[baseKey] = current; // 1ère mesure du jour
  return Math.max(0, current - session[baseKey]);
}

// Détecte un changement de MMR sur un mode et met à jour le TOTAL global du jour.
function applyMmr(pl, mmr) {
  if (mmr == null) return;
  const ref = mmrRef(pl);
  if (ref.start == null) ref.start = mmr;
  if (ref.last != null && mmr !== ref.last) {
    const t = session.total;
    if (mmr > ref.last) { t.wins += 1; t.streak = t.streak >= 0 ? t.streak + 1 : 1; }
    else { t.losses += 1; t.streak = t.streak <= 0 ? t.streak - 1 : -1; }
  }
  ref.last = mmr;
}

// Garde-fou : un seul poll à la fois (sinon des chargements concurrents sur la
// fenêtre cachée se chevauchent et un ancien poll réimpose une sélection périmée).
let polling = false;

// Boucle de poll : on récupère TOUS les MMR + stats carrière.
// W/L = total du jour (tous modes). On affiche le MMR de la playlist choisie.
async function poll() {
  if (polling) return;
  if (!overlayVisible) return; // pas en jeu = pas de scraping (perf)
  polling = true;
  try {
    const cfg = loadConfig();
    let stats;
    try {
      stats = await fetchStats(cfg.platform, cfg.username);
    } catch (e) {
      sendUpdate({ error: 'MMR introuvable (Tracker bloqué ?)' });
      return;
    }

    const ratings = (stats && stats.ratings) || {};
    // Met à jour le total à partir de TOUS les modes (1v1...casual)
    for (const pl in ratings) applyMmr(pl, ratings[pl]);

    // On relit la playlist sélectionnée MAINTENANT (pas au début du poll) pour
    // toujours afficher le dernier choix, même si l'utilisateur a switché pendant
    // le chargement.
    const sel = loadConfig().playlist;
    const ref = mmrRef(sel);
    const mmr = ratings[sel] != null ? ratings[sel] : ref.last;
    if (mmr == null) return;

    // Enregistre le MMR de la playlist suivie dans l'historique persistant.
    if (!history || history.playlist !== sel) history = loadHistory(HISTORY_PATH, sel);
    const recorded = recordSample(history, mmr, Date.now(), today());
    history = recorded.state;
    saveHistory(HISTORY_PATH, history);

    const goals = dayDelta('goals', stats.goals);
    const saves = dayDelta('saves', stats.saves);
    saveSession(session);

    // Rang + winstreak réelle (in-game) du mode sélectionné, fournis par l'API.
    const m = (stats && stats.meta && stats.meta[sel]) || {};
    const rankup = detectRankUp(sel, m); // montée de rang/division -> anim

    const payload = {
      mmr, playlist: shortPlaylist(sel),
      startMmr: ref.start, goals, saves,
      rankTier: m.tier || null, rankDiv: m.div || null, rankIcon: m.icon || null,
      gameStreak: m.streak ?? null, rankup,
      ...session.total
    };
    sendUpdate(payload);
    updatePresence(payload); // miroir sur Discord
  } finally {
    polling = false;
  }
}

// Ordre complet des rangs RL pour calculer une montée (tier inclut I/II/III).
const TIERS = [
  'Bronze I','Bronze II','Bronze III','Silver I','Silver II','Silver III',
  'Gold I','Gold II','Gold III','Platinum I','Platinum II','Platinum III',
  'Diamond I','Diamond II','Diamond III','Champion I','Champion II','Champion III',
  'Grand Champion I','Grand Champion II','Grand Champion III','Supersonic Legend'
];
const DIVS = ['Division I','Division II','Division III','Division IV'];

function rankScore(tier, div) {
  const ti = TIERS.indexOf(tier);
  if (ti < 0) return -1;
  return ti * 4 + Math.max(0, DIVS.indexOf(div));
}
function tierGroup(tier) { return tier.replace(/\s+I{1,3}$/, ''); }

// Baseline du dernier rang vu par mode (mémoire). 1ère mesure = pas d'anim ;
// au redémarrage on repart de l'état courant -> aucune fausse animation.
const rankBaseline = {};
function detectRankUp(pl, m) {
  if (!m || !m.tier) return undefined;
  const score = rankScore(m.tier, m.div);
  if (score < 0) return undefined;
  const prev = rankBaseline[pl];
  rankBaseline[pl] = { score, tier: m.tier };
  if (!prev || score <= prev.score) return undefined; // 1ère vue ou pas de montée
  const kind = TIERS.indexOf(m.tier) > TIERS.indexOf(prev.tier) ? 'tier' : 'div';
  return { kind, tier: m.tier, div: m.div || null, group: tierGroup(m.tier), icon: m.icon || null };
}

function shortPlaylist(pl) {
  const map = { 'ranked-duel': '1v1', 'duel': '1v1', 'ranked-doubles': '2v2', 'doubles': '2v2', 'ranked-standard': '3v3', 'standard': '3v3' };
  return map[(pl || '').toLowerCase()] || '2v2';
}

function sendUpdate(data) {
  if (win && !win.isDestroyed()) win.webContents.send('update', data);
}

// Change la playlist AFFICHÉE (1v1 / 2v2 / 3v3) et persiste le choix.
// Le total W/L est global, seul le MMR affiché change.
function switchPlaylist(pl) {
  const cfg = loadConfig();
  if (cfg.playlist === pl) return;
  cfg.playlist = pl;
  saveConfig(cfg);
  const ref = mmrRef(pl);
  sendUpdate({ playlist: shortPlaylist(pl), mmr: ref.last, startMmr: ref.start, ...session.total });
  poll(); // récupère tout de suite le MMR à jour
}

// Remet à zéro le total W/L/streak du jour (les références MMR restent, pour ne
// pas compter de faux match au prochain poll).
function resetCurrent() {
  const cfg = loadConfig();
  session.total = { wins: 0, losses: 0, streak: 0 };
  saveSession(session);
  const ref = mmrRef(cfg.playlist);
  sendUpdate({ mmr: ref.last, playlist: shortPlaylist(cfg.playlist), startMmr: ref.start, ...session.total });
}

// IPC : reset de session, déclenché par un raccourci.
ipcMain.handle('reset-session', () => resetCurrent());

// IPC : enregistre plateforme + pseudo. Sert au 1er lancement ET à la
// reconfiguration (Ctrl+Alt+P) si on s'est trompé de pseudo.
ipcMain.handle('save-setup', (_e, data) => {
  const cfg = loadConfig();
  const newUser = (data.username || '').trim();
  const changed = cfg.username !== newUser || cfg.platform !== (data.platform || 'epic').toLowerCase();
  cfg.platform = (data.platform || 'epic').toLowerCase();
  cfg.username = newUser;
  saveConfig(cfg);
  // Nouveau joueur -> on repart sur une session vierge (MMR/stats différents).
  if (changed) { session = freshSession(); saveSession(session); }

  if (!overlayStarted) startOverlay(); // 1er lancement
  else poll();                          // reconfiguration : on rafraîchit
  if (setupWin && !setupWin.isDestroyed()) setupWin.close();
  return true;
});

let setupWin = null;
let overlayStarted = false;

// Fenêtre de configuration affichée au tout premier lancement.
function createSetupWindow() {
  setupWin = new BrowserWindow({
    width: 380, height: 440,
    resizable: false, frame: true, title: 'RL Overlay — Configuration',
    backgroundColor: '#0c1120',
    webPreferences: { preload: path.join(__dirname, 'setup-preload.js'), contextIsolation: true }
  });
  setupWin.setMenuBarVisibility(false);
  setupWin.loadFile('setup.html');
}

// Déplace l'overlay de (dx,dy) px et mémorise la position absolue.
function nudge(dx, dy) {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  const nx = x + dx, ny = y + dy;
  win.setPosition(nx, ny);
  const cfg = loadConfig();
  cfg.overlay.anchor = 'free'; // on passe en position absolue mémorisée
  cfg.overlay.x = nx; cfg.overlay.y = ny;
  saveConfig(cfg);
}

// Affiche l'overlay seulement quand Rocket League est la fenêtre au premier plan.
// Un process PowerShell persistant rapporte le nom du process focus chaque
// seconde (P/Invoke GetForegroundWindow). Pas de module natif requis.
let focusProc = null;
let overlayVisible = false;
let forceShow = true; // TEMP screenshot

// Dernier titre Spotify "Artiste - Titre" vu (null = pas de musique / pausé).
let lastSpotify = null;

// Reçoit le titre brut de la fenêtre Spotify. Un vrai morceau contient " - "
// (Artiste - Titre) ; "Spotify" seul = pausé/arrêté -> null. On ne pousse au
// renderer qu'en jeu (overlay visible) et seulement si la valeur a changé.
function handleSpotify(title) {
  const np = title && title.includes(' - ') ? title : null;
  if (np === lastSpotify) return;
  lastSpotify = np;
  if (overlayVisible) sendUpdate({ spotify: np });
}

// Log debug dans userData/overlay.log (sert à diagnostiquer "visible partout").
function logFocus(msg) {
  try {
    fs.appendFileSync(
      path.join(app.getPath('userData'), 'overlay.log'),
      `[${new Date().toISOString()}] ${msg}\n`
    );
  } catch {}
}

function setOverlayVisible(v) {
  if (forceShow) v = true;
  if (!win || win.isDestroyed() || v === overlayVisible) return;
  overlayVisible = v;
  if (v) {
    win.showInactive();          // montre SANS voler le focus au jeu
    sendUpdate({ appear: true }); // anim d'apparition côté renderer
    sendUpdate({ spotify: lastSpotify }); // recale la ligne musique à l'affichage
    startPolling();              // reprend le scraping (et refresh immédiat)
  } else {
    win.hide();
    stopPolling();        // stoppe poll + ferme la fenêtre Chromium = ~0 perf
    clearPresence();      // hors jeu : on retire l'activité Discord
  }
}

// Poll actif seulement quand l'overlay est affiché (= en jeu). Hors-jeu : aucun
// scraping, fenêtre Chromium fermée -> CPU/GPU/RAM quasi nuls.
let pollTimer = null;

function pollMs() {
  return Math.max(5, loadConfig().pollSeconds || 15) * 1000;
}

function startPolling() {
  if (pollTimer) return;
  poll(); // refresh immédiat à l'affichage
  pollTimer = setInterval(poll, pollMs());
}

// Presets de fréquence de poll (s). Plus haut = moins de requêtes (utile si
// réseau instable / packet loss). Cycle + persiste + relance l'intervalle.
const POLL_PRESETS = [10, 15, 30, 60];
function cyclePollRate() {
  const cfg = loadConfig();
  const idx = POLL_PRESETS.indexOf(cfg.pollSeconds || 15);
  const rate = POLL_PRESETS[(idx + 1) % POLL_PRESETS.length];
  cfg.pollSeconds = rate;
  saveConfig(cfg);
  if (pollTimer) { clearInterval(pollTimer); pollTimer = setInterval(poll, rate * 1000); }
  sendUpdate({ toast: '⏱ poll ' + rate + 's' });
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  try { closeHidden(); } catch {}
}

function startFocusWatcher() {
  if (process.platform !== 'win32') { setOverlayVisible(true); return; }

  const ps = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$sig = @'
using System;
using System.Runtime.InteropServices;
public class FG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
}
'@
Add-Type -TypeDefinition $sig
while ($true) {
  $h = [FG]::GetForegroundWindow()
  $procId = 0
  [void][FG]::GetWindowThreadProcessId($h, [ref]$procId)
  $name = ''
  try { $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
  Write-Output "FOCUS|$name"
  # Titre de la fenetre Spotify = "Artiste - Titre". Pause/arret -> "Spotify".
  $sp = ''
  try { $sp = (Get-Process Spotify -ErrorAction Stop | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1 -ExpandProperty MainWindowTitle) } catch {}
  Write-Output "SPOTIFY|$sp"
  Start-Sleep -Milliseconds 1000
}`;

  try {
    focusProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true });
  } catch (e) {
    logFocus('spawn powershell ERREUR: ' + e.message + ' -> overlay reste caché');
    return; // PAS de fallback "visible partout"
  }
  logFocus('watcher démarré pid=' + (focusProc.pid || '?'));

  let buf = '';
  focusProc.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop(); // garde la ligne partielle
    for (const line of lines) {
      const raw = line.trim();
      if (!raw) continue;
      if (raw.startsWith('SPOTIFY|')) { handleSpotify(raw.slice(8)); continue; }
      const name = raw.startsWith('FOCUS|') ? raw.slice(6) : raw;
      if (!name) continue;
      const match = name.toLowerCase() === RL_PROCESS.toLowerCase();
      if (match !== overlayVisible) logFocus(`focus=${name} -> ${match ? 'AFFICHE' : 'cache'}`);
      setOverlayVisible(match);
    }
  });
  focusProc.stderr.on('data', (d) => logFocus('stderr: ' + d.toString().trim()));
  // Si le watcher meurt : NE PAS forcer visible (sinon overlay partout).
  // On cache par sécurité et on retente dans 3 s.
  focusProc.on('exit', (code) => {
    logFocus('watcher exit code=' + code + ' -> cache + retry 3s');
    focusProc = null;
    setOverlayVisible(false);
    setTimeout(() => { if (!focusProc) startFocusWatcher(); }, 3000);
  });
}

// Démarre l'overlay + le polling + les raccourcis. Idempotent (les raccourcis
// ne sont enregistrés qu'une fois).
function startOverlay() {
  if (overlayStarted) return;
  overlayStarted = true;
  createWindow();
  // Le polling démarre/s'arrête avec la visibilité (startFocusWatcher ->
  // setOverlayVisible -> startPolling). Aucun scraping tant que pas en jeu.
  startFocusWatcher();

  globalShortcut.register('CommandOrControl+Alt+R', () => resetCurrent());

  // Ctrl+Alt+W : prévisualise l'animation de victoire (test du rendu).
  globalShortcut.register('CommandOrControl+Alt+W', () => sendUpdate({ celebrate: true }));

  // Ctrl+Alt+E : déclenche l'easter egg (son de défaite) à la demande.
  globalShortcut.register('CommandOrControl+Alt+E', () => sendUpdate({ playLoss: true }));

  // Ctrl+Alt+T : cycle les thèmes (couleurs) de l'overlay.
  globalShortcut.register('CommandOrControl+Alt+T', () => cycleTheme());

  // Ctrl+Alt+F : cycle les formes/dispositions (layouts) de l'overlay.
  globalShortcut.register('CommandOrControl+Alt+F', () => cycleLayout());

  // Ctrl+Alt+S : cycle la fréquence de poll (10/15/30/60s).
  globalShortcut.register('CommandOrControl+Alt+S', () => cyclePollRate());

  // Ctrl+Alt+G : preview de l'anim rank up (défile les rangs à chaque appui).
  let dbgRank = 0;
  // [group, tier name, N de l'icône s4-N]
  const DBG_GROUPS = [
    ['Bronze','Bronze I',1], ['Silver','Silver I',4], ['Gold','Gold I',7],
    ['Platinum','Platinum I',10], ['Diamond','Diamond I',13], ['Champion','Champion I',16],
    ['Grand Champion','Grand Champion I',19], ['Supersonic Legend','Supersonic Legend',22]
  ];
  globalShortcut.register('CommandOrControl+Alt+G', () => {
    const [g, tier, n] = DBG_GROUPS[dbgRank++ % DBG_GROUPS.length];
    const icon = `https://trackercdn.com/cdn/tracker.gg/rocket-league/ranks/s4-${n}.png`;
    sendUpdate({ rankup: { kind: 'tier', tier, div: 'Division I', group: g, icon } });
  });

  // Ctrl+Alt+H : bascule l'affichage forcé (secours si la détection RL échoue).
  // Quand on le réactive, le watcher (1×/s) recale la visibilité tout seul.
  globalShortcut.register('CommandOrControl+Alt+H', () => {
    forceShow = !forceShow;
    logFocus('forceShow=' + forceShow + ' (hotkey)');
    if (forceShow) setOverlayVisible(true);
  });

  // Déplacement de l'overlay aux flèches (12 px par appui), position sauvegardée.
  globalShortcut.register('CommandOrControl+Alt+Up', () => nudge(0, -12));
  globalShortcut.register('CommandOrControl+Alt+Down', () => nudge(0, 12));
  globalShortcut.register('CommandOrControl+Alt+Left', () => nudge(-12, 0));
  globalShortcut.register('CommandOrControl+Alt+Right', () => nudge(12, 0));

  // Ctrl+Alt+D : active/désactive la présence Discord (persiste).
  globalShortcut.register('CommandOrControl+Alt+D', () => {
    const cfg = loadConfig();
    cfg.discord = cfg.discord || { enabled: false, clientId: '', largeImageKey: '', showProfileButton: true };
    cfg.discord.enabled = !cfg.discord.enabled;
    saveConfig(cfg);
    if (!cfg.discord.enabled) { clearPresence(); if (rpc) { rpc.close(); rpc = null; } }
    else { ensureRpc(); poll(); }
    const msg = !cfg.discord.clientId
      ? '⚠ Discord : ajoute clientId dans config.json'
      : (cfg.discord.enabled ? '✅ Discord activé' : '⛔ Discord désactivé');
    sendUpdate({ toast: msg });
  });

  // Ctrl+Alt+P : rouvre l'écran de config pour corriger plateforme / pseudo.
  globalShortcut.register('CommandOrControl+Alt+P', () => {
    if (!setupWin || setupWin.isDestroyed()) createSetupWindow();
    else setupWin.focus();
  });

  // Ctrl+Alt+1/2/3 : playlist affichée. Touches nues évitées (quick chats en jeu).
  globalShortcut.register('CommandOrControl+Alt+1', () => switchPlaylist('ranked-duel'));
  globalShortcut.register('CommandOrControl+Alt+2', () => switchPlaylist('ranked-doubles'));
  globalShortcut.register('CommandOrControl+Alt+3', () => switchPlaylist('ranked-standard'));
}

// Empêche les doublons d'overlay : une seule instance peut tourner.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.whenReady().then(() => {
  // Lancement auto au démarrage de Windows (overlay toujours dispo en fond).
  if (process.platform === 'win32' && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true });
  }
  session = loadSession();
  // 1er lancement (pas de pseudo) -> écran de config, sinon overlay direct.
  if (isConfigured()) startOverlay();
  else createSetupWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (focusProc) { try { focusProc.kill(); } catch {} }
  if (rpc) { try { rpc.close(); } catch {} }
});
app.on('window-all-closed', () => app.quit());
