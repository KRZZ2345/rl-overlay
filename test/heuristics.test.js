const { test } = require('node:test');
const assert = require('node:assert');
const { consistencyScore, confidence, tilt } = require('../lib/heuristics');

const ev = (win, delta) => ({ win, delta });

test('consistency haute quand les deltas sont stables', () => {
  const events = Array.from({ length: 10 }, () => ev(true, 10));
  const c = consistencyScore(events);
  assert.strictEqual(c.score, 100);
  assert.strictEqual(c.grade, 'A+');
});

test('consistency basse quand les deltas varient fort', () => {
  const events = [ev(true, 50), ev(false, -50), ev(true, 50), ev(false, -50)];
  const c = consistencyScore(events);
  assert.ok(c.score < 60, 'score should be low, got ' + c.score);
});

test('confidence max sur 10 wins d_affilée', () => {
  const events = Array.from({ length: 10 }, () => ev(true, 10));
  assert.strictEqual(confidence(events), 100);
});

test('confidence basse sur 10 pertes', () => {
  const events = Array.from({ length: 10 }, () => ev(false, -10));
  assert.strictEqual(confidence(events), 0);
});

test('tilt détecté sur 3 pertes récentes finissant par une perte', () => {
  const events = [ev(true, 10), ev(false, -9), ev(false, -10), ev(true, 8), ev(false, -9)];
  const t = tilt(events);
  assert.strictEqual(t.tilted, true);
});

test('pas de tilt si le dernier est un win', () => {
  const events = [ev(false, -9), ev(false, -10), ev(false, -9), ev(true, 12)];
  assert.strictEqual(tilt(events).tilted, false);
});
