// test/goals.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateGoals, DEFAULT_GOALS } = require('../lib/goals');

const ctx = { mmr: 1000, winratePct: 0, mmrWeek: 0, winsToday: 0 };

test('null => DEFAULT_GOALS, même nombre de lignes', () => {
  assert.strictEqual(evaluateGoals(null, ctx).length, DEFAULT_GOALS.length);
});

test('reachMmr : value=mmr courant, done si >= target', () => {
  const goals = [{ label: 'Diamond', type: 'reachMmr', target: 1110 }];
  assert.strictEqual(evaluateGoals(goals, { ...ctx, mmr: 1110 })[0].done, true);
  assert.strictEqual(evaluateGoals(goals, { ...ctx, mmr: 1000 })[0].done, false);
});

test('winrate : value=winratePct', () => {
  const goals = [{ label: 'WR 60', type: 'winrate', target: 60 }];
  const r = evaluateGoals(goals, { ...ctx, winratePct: 60 })[0];
  assert.strictEqual(r.value, 60);
  assert.strictEqual(r.done, true);
});

test('mmrWeek : value=mmrWeek, pct partiel', () => {
  const goals = [{ label: '+100/sem', type: 'mmrWeek', target: 100 }];
  const r = evaluateGoals(goals, { ...ctx, mmrWeek: 50 })[0];
  assert.strictEqual(r.value, 50);
  assert.strictEqual(r.pct, 50);
  assert.strictEqual(r.done, false);
});

test('winsDay : value=winsToday', () => {
  const goals = [{ label: '10 wins', type: 'winsDay', target: 10 }];
  assert.strictEqual(evaluateGoals(goals, { ...ctx, winsToday: 10 })[0].pct, 100);
});

test('mmr null => value 0, jamais NaN', () => {
  const goals = [{ label: 'Diamond', type: 'reachMmr', target: 1110 }];
  const r = evaluateGoals(goals, { ...ctx, mmr: null })[0];
  assert.strictEqual(r.value, 0);
  assert.ok(!Number.isNaN(r.pct));
});
