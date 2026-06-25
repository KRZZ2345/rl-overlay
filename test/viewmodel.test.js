const { test } = require('node:test');
const assert = require('node:assert');
const { buildViewModel } = require('../lib/viewmodel');

const ev = (win, delta, ts = 0) => ({ ts, mmrBefore: 0, mmrAfter: 0, delta, win });
const base = {
  mmr: 1075, startMmr: 1033, events: [], gameStreak: null,
  session: { wins: 0, losses: 0, streak: 0 }, sessionStart: 0, now: 0,
  state: null, rank: null, dayKey: '2026-06-25', goalsCfg: null
};

test('deltaSession = mmr - startMmr', () => {
  assert.strictEqual(buildViewModel({ ...base }).deltaSession, 42);
});

test('promotion calculée depuis le mmr', () => {
  const vm = buildViewModel({ ...base, mmr: 1075 });
  assert.strictEqual(vm.promotion.mmrToNext, 25);
  assert.strictEqual(vm.promotion.pct, 75);
});

test('momentum exposé (7W/10 = hot) + boost', () => {
  const events = [true,true,false,true,true,false,true,true,false,true].map((w) => ev(w, w ? 10 : -9));
  const vm = buildViewModel({ ...base, events });
  assert.strictEqual(vm.momentum.wins, 7);
  assert.strictEqual(vm.momentum.form, 'hot');
  assert.strictEqual(vm.boost, 70);
});

test('hot si streak >= 3', () => {
  assert.strictEqual(buildViewModel({ ...base, gameStreak: 3 }).hot, true);
});

test('session expose timeMs/wins/losses/mmrNet', () => {
  const vm = buildViewModel({ ...base, sessionStart: 1000, now: 61000, session: { wins: 4, losses: 2, streak: 1 } });
  assert.strictEqual(vm.session.timeMs, 60000);
  assert.strictEqual(vm.session.wins, 4);
  assert.strictEqual(vm.session.losses, 2);
  assert.strictEqual(vm.session.mmrNet, 42);
});

test('records dérivés du state (peak, gap, daysSince)', () => {
  const state = {
    version: 1, playlist: 'x', lastMmr: 1075, events: [], daily: {},
    records: { peakMmr: 1120, peakTs: 0, bestStreak: 0, bestDayGain: 0 }
  };
  const vm = buildViewModel({ ...base, mmr: 1075, state, now: 2 * 86400000 });
  assert.strictEqual(vm.records.peak, 1120);
  assert.strictEqual(vm.records.gap, -45);
  assert.strictEqual(vm.records.daysSince, 2);
});

test('records à zéro quand state null (garde-fou)', () => {
  const vm = buildViewModel({ ...base, state: null });
  assert.deepStrictEqual(vm.records, { peak: null, gap: 0, daysSince: 0 });
});

test('heuristics exposées', () => {
  const events = Array.from({ length: 10 }, () => ev(true, 10));
  const vm = buildViewModel({ ...base, events });
  assert.strictEqual(vm.heuristics.confidence, 100);
  assert.strictEqual(vm.heuristics.consistency.grade, 'A+');
  assert.strictEqual(vm.heuristics.tilt.tilted, false);
});

test('insights vides quand state null', () => {
  assert.deepStrictEqual(buildViewModel({ ...base, state: null }).insights, []);
});

test('daily et goals présents', () => {
  const vm = buildViewModel({ ...base });
  assert.ok(vm.daily && typeof vm.daily.id === 'string');
  assert.ok(Array.isArray(vm.goals) && vm.goals.length >= 1);
});

test('rank est l’écho de l’input', () => {
  const rank = { tier: 'Diamond II', division: 'Division I', playlist: '2v2' };
  assert.deepStrictEqual(buildViewModel({ ...base, rank }).rank, rank);
});
