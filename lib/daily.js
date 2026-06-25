'use strict';

// Pool de défis quotidiens. metric pilote le calcul de la progression.
const DAILY_TEMPLATES = [
  { id: 'mmr15',  label: '+15 MMR aujourd\'hui', target: 15, metric: 'mmrGain' },
  { id: 'win3',   label: '3 victoires',            target: 3,  metric: 'wins' },
  { id: 'wr50',   label: 'Winrate > 50%',          target: 50, metric: 'winrate' },
  { id: 'notilt', label: 'Pas de tilt aujourd\'hui', target: 1, metric: 'noTilt' }
];

function seedIndex(dayKey) {
  let s = 0;
  for (const ch of String(dayKey)) s += ch.charCodeAt(0);
  return s % DAILY_TEMPLATES.length;
}

function metricValue(metric, ctx) {
  switch (metric) {
    case 'mmrGain': return Math.max(0, ctx.todayGain || 0);
    case 'wins':    return ctx.sessionWins || 0;
    case 'winrate': {
      const total = (ctx.sessionWins || 0) + (ctx.sessionLosses || 0);
      return total === 0 ? 0 : Math.round(((ctx.sessionWins || 0) / total) * 100);
    }
    case 'noTilt':  return ctx.tilted ? 0 : 1;
    default:        return 0;
  }
}

// Défi du jour, déterministe par dayKey. Pur.
function dailyChallenge(dayKey, ctx = {}) {
  const tpl = DAILY_TEMPLATES[seedIndex(dayKey)];
  const value = metricValue(tpl.metric, ctx);
  const pct = Math.max(0, Math.min(100, Math.round((value / tpl.target) * 100)));
  return { id: tpl.id, label: tpl.label, target: tpl.target, value, pct, done: value >= tpl.target };
}

module.exports = { DAILY_TEMPLATES, dailyChallenge };
