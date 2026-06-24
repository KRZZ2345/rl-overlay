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
