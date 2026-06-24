const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadHistory, saveHistory } = require('../lib/history-store');
const { emptyState, recordSample } = require('../lib/history');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rlh-')), 'history.json');
}

test('load sur fichier absent renvoie un état vide', () => {
  const s = loadHistory(tmpFile(), 'ranked-doubles');
  assert.strictEqual(s.playlist, 'ranked-doubles');
  assert.deepStrictEqual(s.events, []);
});

test('save puis load round-trip', () => {
  const f = tmpFile();
  let { state } = recordSample(emptyState('x'), 1000, 1, 'd1');
  ({ state } = recordSample(state, 1010, 2, 'd1'));
  saveHistory(f, state);
  const loaded = loadHistory(f, 'x');
  assert.strictEqual(loaded.events.length, 1);
  assert.strictEqual(loaded.lastMmr, 1010);
});

test('playlist différente = état vide (pas de mélange)', () => {
  const f = tmpFile();
  saveHistory(f, emptyState('ranked-duel'));
  const loaded = loadHistory(f, 'ranked-doubles');
  assert.strictEqual(loaded.playlist, 'ranked-doubles');
  assert.deepStrictEqual(loaded.events, []);
});

test('JSON corrompu = état vide', () => {
  const f = tmpFile();
  fs.writeFileSync(f, '{ pas du json');
  const loaded = loadHistory(f, 'x');
  assert.strictEqual(loaded.playlist, 'x');
});
