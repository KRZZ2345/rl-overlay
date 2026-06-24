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

  // Snapshot quotidien (start/end).
  const day = next.daily[dayKey];
  if (!day) next.daily[dayKey] = { start: mmr, end: mmr };
  else next.daily[dayKey] = { start: day.start, end: mmr };

  // Records.
  if (next.records.peakMmr == null || mmr > next.records.peakMmr) {
    next.records.peakMmr = mmr;
    next.records.peakTs = ts;
  }
  const d = next.daily[dayKey];
  const dayGain = d.end - d.start;
  if (dayGain > next.records.bestDayGain) next.records.bestDayGain = dayGain;

  // bestStreak = plus longue série de wins consécutifs dans l'event log.
  let cur = 0, best = next.records.bestStreak;
  for (const e of next.events) {
    if (e.win) { cur += 1; if (cur > best) best = cur; }
    else cur = 0;
  }
  next.records.bestStreak = best;

  next.lastMmr = mmr;
  return { state: next, event };
}

module.exports = { emptyState, recordSample, MAX_EVENTS };
