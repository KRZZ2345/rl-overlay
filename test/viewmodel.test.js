const { test } = require('node:test');
const assert = require('node:assert');
const { buildHudViewModel } = require('../lib/viewmodel');

const ev = (win, delta) => ({ ts: 0, mmrBefore: 0, mmrAfter: 0, delta, win });
const base = {
  mmr: 1075, startMmr: 1033, events: [], gameStreak: null,
  session: { wins: 0, losses: 0, streak: 0 }, sessionStart: 0, now: 0
};

test('deltaSession = mmr - startMmr', () => {
  const vm = buildHudViewModel({ ...base });
  assert.strictEqual(vm.deltaSession, 42);
});

test('deltaSession = 0 si mmr ou startMmr manquant', () => {
  assert.strictEqual(buildHudViewModel({ ...base, startMmr: null }).deltaSession, 0);
  assert.strictEqual(buildHudViewModel({ ...base, mmr: null }).deltaSession, 0);
});

test('promotion calculée depuis le mmr', () => {
  const vm = buildHudViewModel({ ...base, mmr: 1075 });
  assert.strictEqual(vm.promotion.mmrToNext, 25);
  assert.strictEqual(vm.promotion.pct, 75);
});

test('mmr null => promotion à zéro (garde-fou)', () => {
  const vm = buildHudViewModel({ ...base, mmr: null });
  assert.deepStrictEqual(vm.promotion, { mmrToNext: 0, pct: 0, matchesNeeded: 0 });
});

test('momentum exposé (7W/10 = hot)', () => {
  const events = [true,true,false,true,true,false,true,true,false,true].map((w) => ev(w, w ? 10 : -9));
  const vm = buildHudViewModel({ ...base, events });
  assert.strictEqual(vm.momentum.wins, 7);
  assert.strictEqual(vm.momentum.form, 'hot');
  assert.strictEqual(vm.boost, 70);
});

test('boost = 0 sans events', () => {
  assert.strictEqual(buildHudViewModel({ ...base }).boost, 0);
});

test('streak prend gameStreak en priorité, sinon session', () => {
  assert.strictEqual(buildHudViewModel({ ...base, gameStreak: 4 }).streak, 4);
  assert.strictEqual(buildHudViewModel({ ...base, gameStreak: null, session: { wins: 0, losses: 0, streak: 2 } }).streak, 2);
});

test('hot si streak >= 3 même momentum froid', () => {
  const vm = buildHudViewModel({ ...base, gameStreak: 3 });
  assert.strictEqual(vm.momentum.form, 'struggling');
  assert.strictEqual(vm.hot, true);
});

test('pas hot au repos', () => {
  assert.strictEqual(buildHudViewModel({ ...base }).hot, false);
});

test('timeMs = now - sessionStart, 0 si sessionStart absent', () => {
  assert.strictEqual(buildHudViewModel({ ...base, sessionStart: 1000, now: 61000 }).timeMs, 60000);
  assert.strictEqual(buildHudViewModel({ ...base, sessionStart: 0, now: 61000 }).timeMs, 0);
});
