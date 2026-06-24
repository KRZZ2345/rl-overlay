'use strict';

function momentum(events, n = 10) {
  const last = events.slice(Math.max(0, events.length - n));
  const results = last.map((e) => !!e.win);
  const wins = results.filter(Boolean).length;
  const losses = results.length - wins;

  let form, label;
  if (wins >= 7) { form = 'hot'; label = 'En feu'; }
  else if (wins >= 5) { form = 'stable'; label = 'Stable'; }
  else { form = 'struggling'; label = 'En difficulté'; }

  return { results, wins, losses, form, label };
}

module.exports = { momentum };
