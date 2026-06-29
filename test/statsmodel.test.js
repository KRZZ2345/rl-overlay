// test/statsmodel.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { parseData, localPlayer, matchModel, resultFromScores } = require('../lib/statsmodel');

// Échantillon réel capturé depuis la Stats API (freeplay, 1 joueur).
const REAL_UPDATESTATE = JSON.stringify({
  MatchGuid: '', Players: [{ Name: 'Serfio77400', PrimaryId: 'Epic|573c24021eeb4610a816ce5bae8fb2bc|0', TeamNum: 0, Score: 0, Goals: 0, Shots: 0, Assists: 0, Saves: 0, Touches: 11, Demos: 0, Speed: 4.1, Boost: 100 }],
  Game: { Teams: [{ Name: 'Bleu', TeamNum: 0, Score: 3 }, { Name: 'Orange', TeamNum: 1, Score: 0 }], TimeSeconds: 10, bOvertime: false, bReplay: false, bHasWinner: false, Winner: '', Arena: 'FNI_Stadium_P', Target: { Name: 'Serfio77400', TeamNum: 0 } },
});

test('parseData décode le Data stringifié', () => {
  assert.deepStrictEqual(parseData('{"a":1}'), { a: 1 });
  assert.deepStrictEqual(parseData({ a: 1 }), { a: 1 });
  assert.strictEqual(parseData(null), null);
  assert.strictEqual(parseData('pas json'), null);
});

test('matchModel sur données réelles (par pseudo)', () => {
  const m = matchModel(REAL_UPDATESTATE, { username: 'Serfio77400' });
  assert.strictEqual(m.inMatch, true);
  assert.strictEqual(m.myTeam, 0);
  assert.strictEqual(m.teamScore, 3);
  assert.strictEqual(m.oppScore, 0);
  assert.strictEqual(m.me.boost, 100);
  assert.strictEqual(m.me.name, 'Serfio77400');
  assert.strictEqual(m.time, 10);
});

test('localPlayer : PrimaryId prioritaire, repli pseudo / unique / target', () => {
  const players = [{ Name: 'A', PrimaryId: 'Epic|1|0', TeamNum: 0 }, { Name: 'B', PrimaryId: 'Epic|2|0', TeamNum: 1 }];
  assert.strictEqual(localPlayer(players, { primaryId: 'Epic|2|0' }).Name, 'B');
  assert.strictEqual(localPlayer(players, { username: 'a' }).Name, 'A');
  assert.strictEqual(localPlayer(players, {}, { Name: 'B' }).Name, 'B');
  assert.strictEqual(localPlayer([{ Name: 'Solo', TeamNum: 0 }], {}).Name, 'Solo'); // joueur unique (freeplay)
  assert.strictEqual(localPlayer([], {}), null);
});

test('résultat W/L/N + équipe adverse 2v2 (somme)', () => {
  assert.strictEqual(resultFromScores(3, 1), 'W');
  assert.strictEqual(resultFromScores(1, 3), 'L');
  assert.strictEqual(resultFromScores(2, 2), 'N');
  // équipe locale 1, adverse = somme des autres équipes
  const m = matchModel(JSON.stringify({ Players: [{ Name: 'me', TeamNum: 1 }], Game: { Teams: [{ TeamNum: 0, Score: 5 }, { TeamNum: 1, Score: 2 }] } }), { username: 'me' });
  assert.strictEqual(m.teamScore, 2);
  assert.strictEqual(m.oppScore, 5);
});

test('hors match -> inMatch false', () => {
  assert.strictEqual(matchModel(null, {}).inMatch, false);
  assert.strictEqual(matchModel('{"Players":[],"Game":{}}', {}).inMatch, false);
});
