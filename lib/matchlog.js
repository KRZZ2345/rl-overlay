'use strict';

// Journal des matchs (logique pure, pas d'I/O -> testable). Persisté en JSON par
// main.js (matches.json dans userData). Base de futurs graphes premium (win-rate,
// MMR dans le temps). Un match est enregistré quand le MMR change après une fin de
// match détectée via le log RL (cf. refreshAfterMatch).

// Construit une entrée de match normalisée.
function makeEntry(playlist, before, after, day, ts) {
  const b = Number(before), a = Number(after);
  const delta = (Number.isFinite(a) && Number.isFinite(b)) ? a - b : 0;
  return {
    ts: ts || Date.now(),
    day: day || new Date().toISOString().slice(0, 10),
    playlist: playlist || null,
    mmr: Number.isFinite(a) ? a : null,
    delta,
    result: delta > 0 ? 'W' : delta < 0 ? 'L' : 'N', // N = nul/inchangé
  };
}

// Ajoute une entrée, borne la taille (anti-gonflement du fichier).
function appendMatch(list, entry, cap = 500) {
  const out = [...(Array.isArray(list) ? list : []), entry];
  return out.length > cap ? out.slice(out.length - cap) : out;
}

// Résumé d'un jour (ou de tout si day omis) : nb, W, L, net MMR, win-rate %.
function summarize(list, day) {
  const all = Array.isArray(list) ? list : [];
  const rows = day ? all.filter((m) => m.day === day) : all;
  const wins = rows.filter((m) => m.delta > 0).length;
  const losses = rows.filter((m) => m.delta < 0).length;
  const net = rows.reduce((s, m) => s + (Number(m.delta) || 0), 0);
  const decided = wins + losses;
  const winRate = decided ? Math.round((wins / decided) * 100) : 0;
  return { count: rows.length, wins, losses, net, winRate };
}

module.exports = { makeEntry, appendMatch, summarize };
