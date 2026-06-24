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

test('insight winrate du jour à partir des ts', () => {
  const { emptyState } = require('../lib/history');
  // 4 events aujourd'hui : 3 wins / 1 loss => 75%
  const day = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const now = Date.now();
  const state = emptyState('x');
  state.events = [
    { ts: now, mmrBefore: 1000, mmrAfter: 1012, delta: 12, win: true },
    { ts: now, mmrBefore: 1012, mmrAfter: 1003, delta: -9, win: false },
    { ts: now, mmrBefore: 1003, mmrAfter: 1015, delta: 12, win: true },
    { ts: now, mmrBefore: 1015, mmrAfter: 1027, delta: 12, win: true }
  ];
  const out = generateInsights(state, { dayKey: day, mmr: 1027, max: 4 });
  assert.ok(out.some((i) => i.icon === '⚡' && i.text.includes('75%')), JSON.stringify(out));
});
