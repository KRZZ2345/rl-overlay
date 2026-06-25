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
  const daysSince = state.records.peakTs != null ? Math.floor((now - state.records.peakTs) / DAY_MS) : 0;
  return { peak, gap, daysSince };
}

// MMR gagné sur ~7 derniers jours, depuis les snapshots quotidiens.
function mmrThisWeek(state, mmr) {
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
    mmrWeek: mmrThisWeek(state, mmr),
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
