const { test } = require('node:test');
const assert = require('node:assert');
const { emptyState, recordSample } = require('../lib/history');

test('emptyState renvoie une structure vide cohérente', () => {
  const s = emptyState('ranked-doubles');
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.playlist, 'ranked-doubles');
  assert.strictEqual(s.lastMmr, null);
  assert.deepStrictEqual(s.events, []);
  assert.deepStrictEqual(s.daily, {});
  assert.strictEqual(s.records.peakMmr, null);
  assert.strictEqual(s.records.bestStreak, 0);
});

test('premier échantillon ne crée pas d_event mais pose lastMmr', () => {
  let { state, event } = recordSample(emptyState('x'), 1000, 1000, '2026-06-24');
  assert.strictEqual(event, null);
  assert.strictEqual(state.lastMmr, 1000);
  assert.strictEqual(state.events.length, 0);
});

test('hausse de MMR crée un event win', () => {
  let { state } = recordSample(emptyState('x'), 1000, 1000, '2026-06-24');
  const r = recordSample(state, 1012, 2000, '2026-06-24');
  assert.strictEqual(r.event.win, true);
  assert.strictEqual(r.event.delta, 12);
  assert.strictEqual(r.event.mmrBefore, 1000);
  assert.strictEqual(r.event.mmrAfter, 1012);
  assert.strictEqual(r.state.events.length, 1);
  assert.strictEqual(r.state.lastMmr, 1012);
});

test('baisse de MMR crée un event loss', () => {
  let { state } = recordSample(emptyState('x'), 1000, 1000, '2026-06-24');
  const r = recordSample(state, 991, 2000, '2026-06-24');
  assert.strictEqual(r.event.win, false);
  assert.strictEqual(r.event.delta, -9);
});

test('MMR identique ne crée pas d_event', () => {
  let { state } = recordSample(emptyState('x'), 1000, 1000, '2026-06-24');
  const r = recordSample(state, 1000, 2000, '2026-06-24');
  assert.strictEqual(r.event, null);
  assert.strictEqual(r.state.events.length, 0);
});

test('event log borné à 500', () => {
  let state = emptyState('x');
  ({ state } = recordSample(state, 1000, 0, '2026-06-24'));
  for (let i = 1; i <= 520; i++) {
    ({ state } = recordSample(state, 1000 + i, i, '2026-06-24'));
  }
  assert.strictEqual(state.events.length, 500);
  // le plus ancien gardé doit correspondre au 21e changement
  assert.strictEqual(state.events[0].mmrAfter, 1021);
  assert.strictEqual(state.events[499].mmrAfter, 1520);
});
