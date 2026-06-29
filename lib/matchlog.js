'use strict';

// Journal des matchs (logique pure, pas d'I/O -> testable). Persisté en JSON par
// main.js (matches.json dans userData). Base de futurs graphes premium (win-rate,
// MMR dans le temps). Un match est enregistré quand le MMR change après une fin de
// match détectée via le log RL (cf. refreshAfterMatch).

// Construit une entrée de match normalisée. `extra` (option) porte le résultat
// explicite + les stats issues de la Stats API (buts/arrêts/tirs/passes/score,
// teamScore/oppScore, source). Le résultat explicite prime sur le delta MMR.
function makeEntry(playlist, before, after, day, ts, extra) {
  const b = Number(before), a = Number(after);
  const delta = (Number.isFinite(a) && Number.isFinite(b)) ? a - b : 0;
  const e = {
    ts: ts || Date.now(),
    day: day || new Date().toISOString().slice(0, 10),
    playlist: playlist || null,
    mmr: Number.isFinite(a) ? a : null,
    delta,
    result: (extra && extra.result) || (delta > 0 ? 'W' : delta < 0 ? 'L' : 'N'),
  };
  if (extra) {
    for (const k of ['teamScore', 'oppScore', 'goals', 'saves', 'shots', 'assists', 'score', 'demos', 'source',
      'avgBoost', 'boostZeroPct', 'boostFullPct', 'airPct', 'groundPct', 'touches']) {
      if (extra[k] != null) e[k] = extra[k];
    }
  }
  return e;
}

// Ajoute une entrée, borne la taille (anti-gonflement du fichier).
function appendMatch(list, entry, cap = 500) {
  const out = [...(Array.isArray(list) ? list : []), entry];
  return out.length > cap ? out.slice(out.length - cap) : out;
}

// Résultat W/L d'une entrée : champ `result` (Stats API) sinon dérivé du delta MMR.
function entryResult(m) {
  if (m.result === 'W' || m.result === 'L') return m.result;
  return m.delta > 0 ? 'W' : m.delta < 0 ? 'L' : 'N';
}

// Résumé d'un jour (ou de tout si day omis) : nb, W, L, net MMR, win-rate %, streak.
function summarize(list, day) {
  const all = Array.isArray(list) ? list : [];
  const rows = day ? all.filter((m) => m.day === day) : all;
  const wins = rows.filter((m) => entryResult(m) === 'W').length;
  const losses = rows.filter((m) => entryResult(m) === 'L').length;
  const net = rows.reduce((s, m) => s + (Number(m.delta) || 0), 0);
  const decided = wins + losses;
  const winRate = decided ? Math.round((wins / decided) * 100) : 0;
  // streak en cours : depuis la fin, victoires/défaites consécutives (W>0, L<0).
  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = entryResult(rows[i]);
    if (r === 'N') continue;
    if (streak === 0) streak = r === 'W' ? 1 : -1;
    else if (streak > 0 && r === 'W') streak++;
    else if (streak < 0 && r === 'L') streak--;
    else break;
  }
  return { count: rows.length, wins, losses, net, winRate, streak };
}

module.exports = { makeEntry, appendMatch, summarize };
