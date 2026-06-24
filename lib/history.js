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
