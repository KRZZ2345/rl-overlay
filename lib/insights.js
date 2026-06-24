'use strict';

const { promotion, avgWinGain } = require('./promotion');

function dailyGains(daily) {
  return Object.keys(daily).map((k) => ({ day: k, gain: daily[k].end - daily[k].start }));
}

function generateInsights(state, opts) {
  const { dayKey, mmr, max = 3 } = opts;
  const out = [];

  // 1. Promotion proche.
  const avg = avgWinGain(state.events);
  const promo = promotion(mmr, avg);
  if (promo.matchesNeeded <= 5) {
    out.push({ icon: '🎯', text: `Promotion probable dans ${promo.matchesNeeded} victoire${promo.matchesNeeded > 1 ? 's' : ''}` });
  }

  // 2. Au-dessus de la moyenne des fins de journée.
  const ends = Object.keys(state.daily).map((k) => state.daily[k].end);
  if (ends.length > 0) {
    const avgEnd = ends.reduce((a, b) => a + b, 0) / ends.length;
    const diff = Math.round(mmr - avgEnd);
    if (diff >= 5) out.push({ icon: '📈', text: `Tu joues ${diff} MMR au-dessus de ta moyenne` });
  }

  // 3. Plus haute progression des 14 derniers jours.
  const gains = dailyGains(state.daily);
  const today = state.daily[dayKey];
  if (today) {
    const todayGain = today.end - today.start;
    const recent = gains.slice(-14).map((g) => g.gain);
    const maxGain = recent.length ? Math.max(...recent) : 0;
    if (todayGain > 0 && todayGain >= maxGain) {
      out.push({ icon: '🔥', text: 'Plus haute progression des 14 derniers jours' });
    }
  }

  return out.slice(0, max);
}

module.exports = { generateInsights };
