const { test } = require('node:test');
const assert = require('node:assert');
const { momentum } = require('../lib/momentum');

const ev = (win) => ({ ts: 0, mmrBefore: 0, mmrAfter: 0, delta: 0, win });

test('liste vide = struggling, 0/0', () => {
  const m = momentum([], 10);
  assert.deepStrictEqual(m.results, []);
  assert.strictEqual(m.wins, 0);
  assert.strictEqual(m.form, 'struggling');
});

test('ne garde que les N derniers', () => {
  const events = Array.from({ length: 15 }, (_, i) => ev(i % 2 === 0));
  const m = momentum(events, 10);
  assert.strictEqual(m.results.length, 10);
});

test('7 wins sur 10 = hot / En feu', () => {
  const events = [true,true,false,true,true,false,true,true,false,true].map(ev);
  const m = momentum(events, 10);
  assert.strictEqual(m.wins, 7);
  assert.strictEqual(m.losses, 3);
  assert.strictEqual(m.form, 'hot');
  assert.strictEqual(m.label, 'En feu');
});

test('5 wins = stable', () => {
  const events = [true,false,true,false,true,false,true,false,true,false].map(ev);
  assert.strictEqual(momentum(events, 10).form, 'stable');
});

test('4 wins = struggling / En difficulté', () => {
  const events = [true,false,false,true,false,false,true,false,false,true].map(ev);
  const m = momentum(events, 10);
  assert.strictEqual(m.wins, 4);
  assert.strictEqual(m.form, 'struggling');
  assert.strictEqual(m.label, 'En difficulté');
});
