// test/rllog.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { parseLine, PLAYLIST_IDS, logPathCandidates } = require('../rllog');
const path = require('path');

// Collecteur d'événements pour parseLine.
function collect(lines) {
  const events = [];
  const st = {};
  const emit = {
    matchStart: (id, mmr, tier) => events.push({ type: 'start', id, mmr, tier }),
    matchEnd: () => events.push({ type: 'end' }),
  };
  for (const l of lines) parseLine(l, emit, st);
  return events;
}

test('détecte le début de match via StartMatchmaking + playlist id', () => {
  const e = collect(['[3201.84] Matchmaking: StartMatchmaking at 2026-06-29 in EU9 for playlists 11 on game server ']);
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].type, 'start');
  assert.strictEqual(e[0].id, 11);
});

test('détecte le début via HandleServerReserved (Reservation Playlist=)', () => {
  const e = collect(['[3206.25] Party: HandleServerReserved (Reservation=(ServerName="EU9-x",Playlist=13,Region="EU"))']);
  assert.strictEqual(e[0].type, 'start');
  assert.strictEqual(e[0].id, 13);
});

test('capture MMR interne + tier (lignes avant StartMatchmaking)', () => {
  const e = collect([
    '[0038.25] Matchmaking: Pre-divide PartyLeaderMMR: 21.1114',
    '[0038.25] Matchmaking: Post-divide PartyLeaderMMR: 21.1114',
    '[0038.25] Matchmaking: PartyLeaderTier=(11)',
    '[0038.25] Matchmaking: StartMatchmaking at 2026-06-29 for playlists 10 on game server ',
  ]);
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].id, 10);
  assert.ok(Math.abs(e[0].mmr - 21.1114) < 1e-6);
  assert.strictEqual(e[0].tier, 11);
});

test('détecte la fin de match via WinnerMenu et EndGameMenu', () => {
  const e = collect([
    '[0669.85] Log: Fully load package: ..\\..\\TAGame\\CookedPCConsole\\GFX_WinnerMenu_SF.upk',
    '[3210.88] Log: Fully load package: ..\\..\\TAGame\\CookedPCConsole\\GFX_EndGameMenu_SF.upk',
  ]);
  assert.deepStrictEqual(e, [{ type: 'end' }, { type: 'end' }]);
});

test('ignore les lignes sans intérêt', () => {
  const e = collect([
    '[3201.84] Matchmaking: SecondsSearching=(1) bIgnoreSkill=(False)',
    '\tFunction TAGame.ProductAsset_GoalExplosion_TA:GetExplosionFXActorForPRI',
    '[1731.30] Matchmaking: Post-divide PartyLeaderMMR: 31.3883',
  ]);
  assert.deepStrictEqual(e, []);
});

test('candidats chemin log : Documents + OneDrive (%OneDrive%) + OneDrive local, dédupliqués', () => {
  const c = logPathCandidates('C:\\Users\\bob', 'C:\\Users\\bob\\OneDrive');
  const rel = path.join('My Games', 'Rocket League', 'TAGame', 'Logs', 'Launch.log');
  assert.strictEqual(c[0], path.join('C:\\Users\\bob', 'Documents', rel));
  assert.strictEqual(c[1], path.join('C:\\Users\\bob\\OneDrive', 'Documents', rel));
  assert.ok(c.length === 2 || c.length === 3); // 3e (home/OneDrive) peut dédupliquer avec le 2e
  assert.strictEqual(new Set(c).size, c.length); // pas de doublon
});

test('candidats sans OneDrive = juste Documents', () => {
  const c = logPathCandidates('C:\\Users\\bob', undefined);
  assert.deepStrictEqual(c, [path.join('C:\\Users\\bob', 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Logs', 'Launch.log'),
    path.join('C:\\Users\\bob', 'OneDrive', 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Logs', 'Launch.log')]);
});

test('map des ids de playlist classées', () => {
  assert.strictEqual(PLAYLIST_IDS[10], 'ranked-duel');
  assert.strictEqual(PLAYLIST_IDS[11], 'ranked-doubles');
  assert.strictEqual(PLAYLIST_IDS[13], 'ranked-standard');
  assert.strictEqual(PLAYLIST_IDS[1], undefined); // casual non suivi
});
