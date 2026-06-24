const { test } = require('node:test');
const assert = require('node:assert');
const { emptyState, recordSample } = require('../lib/history');
const { generateInsights } = require('../lib/insights');

function build(samples) {
  let state = emptyState('x');
  for (const [mmr, ts, day] of samples) ({ state } = recordSample(state, mmr, ts, day));
  return state;
}

test('insight promotion quand proche', () => {
  // mmr 1090 -> mmrToNext 10, avg ~10 -> 1 match
  const state = build([[1080, 1, 'd1'], [1090, 2, 'd1']]);
  const out = generateInsights(state, { dayKey: 'd1', mmr: 1090, max: 3 });
  assert.ok(out.some((i) => i.text.includes('Promotion')), JSON.stringify(out));
});

test('insight au-dessus de la moyenne', () => {
  // moyennes journalières basses, mmr courant nettement au-dessus
  const state = build([[900, 1, 'd1'], [905, 2, 'd1'], [950, 3, 'd2']]);
  const out = generateInsights(state, { dayKey: 'd2', mmr: 1000, max: 3 });
  assert.ok(out.some((i) => i.text.includes('au-dessus de ta moyenne')), JSON.stringify(out));
});

test('jamais plus de max insights', () => {
  const state = build([[1080, 1, 'd1'], [1095, 2, 'd1']]);
  const out = generateInsights(state, { dayKey: 'd1', mmr: 1095, max: 2 });
  assert.ok(out.length <= 2);
});

test('état vide ne casse pas', () => {
  const out = generateInsights(emptyState('x'), { dayKey: 'd1', mmr: 1000, max: 3 });
  assert.ok(Array.isArray(out));
});
