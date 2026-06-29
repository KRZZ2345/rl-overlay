'use strict';

// Lecture SEULE du log Rocket League pour rendre l'overlay quasi temps réel,
// sans injection ni BakkesMod (anticheat-safe). On tail Launch.log et on émet :
//   - matchStart(playlistId, playlistKey|null) : entrée en file/résa d'un match
//   - matchEnd() : écran de fin de match (WinnerMenu/EndGameMenu)
// Aucune écriture, aucun contact avec le process RL.

const fs = require('fs');
const path = require('path');
const os = require('os');

function defaultLogPath() {
  return path.join(os.homedir(), 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Logs', 'Launch.log');
}

// Patterns vérifiés sur un vrai Launch.log.
const RE_PLAYLIST_START = /for playlists (\d+)/;            // Matchmaking: StartMatchmaking ... for playlists 11
const RE_RESERVATION    = /Reservation=\(.*?Playlist=(\d+)/; // Party: HandleServerReserved (Reservation=(...Playlist=11...))
const RE_MATCH_END      = /GFX_(?:WinnerMenu|EndGameMenu)_SF/;

// id de playlist RL -> clé interne suivie par l'overlay (modes classés seulement ;
// les autres ids ne forcent pas la playlist affichée).
const PLAYLIST_IDS = { 10: 'ranked-duel', 11: 'ranked-doubles', 13: 'ranked-standard' };

// Parse pure d'une ligne -> appelle emit.matchStart / emit.matchEnd. Testable.
function parseLine(line, emit) {
  const m = line.match(RE_PLAYLIST_START) || line.match(RE_RESERVATION);
  if (m) { emit.matchStart(parseInt(m[1], 10)); return; }
  if (RE_MATCH_END.test(line)) emit.matchEnd();
}

// Surveille le log et émet les événements. Renvoie { stop }.
function startLogWatcher(opts = {}) {
  const logPath = opts.logPath || defaultLogPath();
  const onMatchStart = opts.onMatchStart || (() => {});
  const onMatchEnd = opts.onMatchEnd || (() => {});
  const intervalMs = opts.intervalMs || 1000;
  const log = opts.log || (() => {});

  let pos = 0;        // curseur octets lus
  let started = false; // false tant qu'on n'a pas calé le curseur sur la fin
  let buf = '';        // ligne partielle entre deux lectures
  let lastEnd = 0;     // anti-rebond matchEnd

  const emit = {
    matchStart: (id) => { onMatchStart(id, PLAYLIST_IDS[id] || null); },
    matchEnd: () => {
      const now = Date.now();
      if (now - lastEnd < 5000) return; // WinnerMenu + EndGameMenu chargent ensemble
      lastEnd = now;
      onMatchEnd();
    },
  };

  function tick() {
    fs.stat(logPath, (err, st) => {
      if (err) return;                         // log absent -> on retente au prochain tick
      if (!started) { pos = st.size; started = true; return; } // démarre à la fin (pas d'historique)
      if (st.size < pos) { pos = 0; buf = ''; } // rotation/troncature (redémarrage du jeu)
      if (st.size <= pos) return;
      const end = st.size;
      const stream = fs.createReadStream(logPath, { start: pos, end: end - 1, encoding: 'utf8' });
      let data = '';
      stream.on('data', (d) => { data += d; });
      stream.on('end', () => {
        pos = end;
        buf += data;
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();                     // garde la dernière (potentiellement partielle)
        for (const line of lines) {
          try { parseLine(line, emit); } catch (e) { log('rllog parse: ' + e.message); }
        }
      });
      stream.on('error', (e) => log('rllog read: ' + e.message));
    });
  }

  const timer = setInterval(tick, intervalMs);
  tick();
  return { stop: () => clearInterval(timer) };
}

module.exports = { startLogWatcher, parseLine, defaultLogPath, PLAYLIST_IDS };
