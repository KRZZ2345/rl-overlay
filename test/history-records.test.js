const { test } = require('node:test');
const assert = require('node:assert');
const { emptyState, recordSample } = require('../lib/history');

test('peak suit le MMR maximum vu', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 1, 'd1'));
  ({ state } = recordSample(state, 1030, 2, 'd1'));
  ({ state } = recordSample(state, 1010, 3, 'd1'));
  assert.strictEqual(state.records.peakMmr, 1030);
  assert.strictEqual(state.records.peakTs, 2);
});

test('daily enregistre start et end de la journée', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 1, 'd1')); // start jour 1
  ({ state } = recordSample(state, 1012, 2, 'd1'));
  ({ state } = recordSample(state, 1025, 3, 'd1')); // end jour 1
  ({ state } = recordSample(state, 1030, 4, 'd2')); // start jour 2
  assert.strictEqual(state.daily.d1.start, 1000);
  assert.strictEqual(state.daily.d1.end, 1025);
  assert.strictEqual(state.daily.d2.start, 1030);
  assert.strictEqual(state.daily.d2.end, 1030);
});

test('bestDayGain = meilleur gain net sur une journée', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 1, 'd1'));
  ({ state } = recordSample(state, 1040, 2, 'd1')); // +40 sur d1
  ({ state } = recordSample(state, 1030, 3, 'd2'));
  ({ state } = recordSample(state, 1030, 4, 'd2'));
  assert.strictEqual(state.records.bestDayGain, 40);
});

test('bestStreak suit la plus longue série de wins', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 0, 'd1'));
  ({ state } = recordSample(state, 1010, 1, 'd1')); // W (streak 1)
  ({ state } = recordSample(state, 1020, 2, 'd1')); // W (streak 2)
  ({ state } = recordSample(state, 1030, 3, 'd1')); // W (streak 3)
  ({ state } = recordSample(state, 1020, 4, 'd1')); // L (reset)
  ({ state } = recordSample(state, 1030, 5, 'd1')); // W (streak 1)
  assert.strictEqual(state.records.bestStreak, 3);
});
