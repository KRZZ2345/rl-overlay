// test/matchlog.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { makeEntry, appendMatch, summarize } = require('../lib/matchlog');

test('makeEntry calcule delta + résultat', () => {
  const w = makeEntry('ranked-doubles', 1200, 1212, '2026-06-29', 1000);
  assert.strictEqual(w.delta, 12);
  assert.strictEqual(w.result, 'W');
  assert.strictEqual(w.mmr, 1212);
  assert.strictEqual(w.day, '2026-06-29');
  const l = makeEntry('ranked-duel', 1200, 1188);
  assert.strictEqual(l.result, 'L');
  const n = makeEntry('x', 1200, 1200);
  assert.strictEqual(n.result, 'N');
});

test('appendMatch borne la taille', () => {
  let list = [];
  for (let i = 0; i < 10; i++) list = appendMatch(list, makeEntry('p', i, i + 1), 5);
  assert.strictEqual(list.length, 5);
  assert.strictEqual(list[list.length - 1].mmr, 10);
});

test('summarize : W/L, net, win-rate par jour', () => {
  const list = [
    makeEntry('p', 1000, 1010, '2026-06-29'),
    makeEntry('p', 1010, 1000, '2026-06-29'),
    makeEntry('p', 1000, 1009, '2026-06-29'),
    makeEntry('p', 1009, 1009, '2026-06-29'), // nul, ignoré du win-rate
    makeEntry('p', 1, 2, '2026-06-28'),         // autre jour
  ];
  const s = summarize(list, '2026-06-29');
  assert.strictEqual(s.count, 4);
  assert.strictEqual(s.wins, 2);
  assert.strictEqual(s.losses, 1);
  assert.strictEqual(s.net, 10 - 10 + 9); // 9
  assert.strictEqual(s.winRate, 67); // 2/3
});

test('summarize gère liste vide/null', () => {
  assert.deepStrictEqual(summarize(null), { count: 0, wins: 0, losses: 0, net: 0, winRate: 0, streak: 0 });
});

test('summarize : résultat explicite (Stats API) prioritaire + streak', () => {
  const e = (result) => makeEntry('p', null, null, '2026-06-29', Date.now(), { result });
  const list = [e('W'), e('L'), e('W'), e('W')]; // delta=0 partout, compte par result
  const s = summarize(list, '2026-06-29');
  assert.strictEqual(s.wins, 3);
  assert.strictEqual(s.losses, 1);
  assert.strictEqual(s.winRate, 75);
  assert.strictEqual(s.streak, 2); // 2 victoires en cours
});

test('makeEntry porte les stats Stats API', () => {
  const m = makeEntry('ranked-doubles', null, null, '2026-06-29', 1, { result: 'W', teamScore: 3, oppScore: 1, goals: 2, saves: 1, shots: 4, assists: 1, source: 'statsapi' });
  assert.strictEqual(m.result, 'W');
  assert.strictEqual(m.teamScore, 3);
  assert.strictEqual(m.goals, 2);
  assert.strictEqual(m.source, 'statsapi');
});
