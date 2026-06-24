const { test } = require('node:test');
const assert = require('node:assert');
const { avgWinGain, promotion, DIV_SIZE } = require('../lib/promotion');

const win = (delta) => ({ win: true, delta });
const loss = (delta) => ({ win: false, delta });

test('DIV_SIZE vaut 100 (approximation documentée)', () => {
  assert.strictEqual(DIV_SIZE, 100);
});

test('avgWinGain moyenne les gains des wins', () => {
  assert.strictEqual(avgWinGain([win(10), win(14), loss(-9)]), 12);
});

test('avgWinGain renvoie le fallback sans win', () => {
  assert.strictEqual(avgWinGain([loss(-9)], 9), 9);
});

test('promotion calcule restant/pct/matchs', () => {
  // mmr 1075, division courante = [1000,1100), restant = 25, pct = 75
  const p = promotion(1075, 12);
  assert.strictEqual(p.mmrToNext, 25);
  assert.strictEqual(p.pct, 75);
  assert.strictEqual(p.matchesNeeded, 3); // ceil(25/12)
});

test('promotion à la frontière basse de division', () => {
  const p = promotion(1000, 10);
  assert.strictEqual(p.mmrToNext, 100);
  assert.strictEqual(p.pct, 0);
  assert.strictEqual(p.matchesNeeded, 10);
});
