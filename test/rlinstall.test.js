// test/rlinstall.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { parseEpicManifest, parseSteamLibraryFolders, patchIniContent } = require('../lib/rlinstall');

test('manifest Epic Rocket League -> InstallLocation', () => {
  const j = JSON.stringify({ DisplayName: 'Rocket League', InstallLocation: 'C:\\Program Files\\Epic Games\\rocketleague', LaunchExecutable: 'Binaries\\Win64\\RocketLeague.exe' });
  assert.strictEqual(parseEpicManifest(j), 'C:\\Program Files\\Epic Games\\rocketleague');
});

test('manifest Epic autre jeu -> null', () => {
  assert.strictEqual(parseEpicManifest(JSON.stringify({ DisplayName: 'Fortnite', InstallLocation: 'X' })), null);
  assert.strictEqual(parseEpicManifest('pas du json'), null);
});

test('libraryfolders.vdf -> chemins', () => {
  const vdf = `"libraryfolders"\n{\n  "0"\n  {\n  "path"  "C:\\\\Program Files (x86)\\\\Steam"\n  }\n  "1"\n  {\n  "path"  "D:\\\\SteamLibrary"\n  }\n}`;
  const paths = parseSteamLibraryFolders(vdf);
  assert.ok(paths.includes('C:\\Program Files (x86)\\Steam'));
  assert.ok(paths.includes('D:\\SteamLibrary'));
});

test('patchIniContent : 0 -> 30', () => {
  const ini = '[TAGame.MatchStatsExporter_TA]\r\nPort=49123\r\nPacketSendRate=0';
  const out = patchIniContent(ini, 30);
  assert.match(out, /PacketSendRate=30/);
  assert.doesNotMatch(out, /PacketSendRate=0\b/);
  assert.match(out, /Port=49123/); // préserve le reste
});

test('patchIniContent : contenu vide -> section créée', () => {
  const out = patchIniContent('', 30);
  assert.match(out, /\[TAGame\.MatchStatsExporter_TA\]/);
  assert.match(out, /Port=49123/);
  assert.match(out, /PacketSendRate=30/);
});

test('patchIniContent : \\r orphelin (valeur collée au commentaire) -> ligne propre', () => {
  // cas réel observé : le commentaire et la valeur séparés par \r seul (pas \n)
  const ini = '[TAGame.MatchStatsExporter_TA]\r\n; commentaire 0 disables\rPacketSendRate=0';
  const out = patchIniContent(ini, 30);
  const lines = out.split('\r\n');
  // PacketSendRate doit être seul sur sa ligne, pas derrière le ';'
  assert.ok(lines.some((l) => /^PacketSendRate=30$/.test(l)), 'PacketSendRate sur sa propre ligne');
  assert.ok(!/;[^\n]*PacketSendRate/.test(out), 'pas collé au commentaire');
});

test('patchIniContent : section sans PacketSendRate -> ajoutée', () => {
  const out = patchIniContent('[TAGame.MatchStatsExporter_TA]\r\nPort=49123', 30);
  assert.match(out, /PacketSendRate=30/);
});
