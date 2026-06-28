const { test } = require('node:test');
const assert = require('node:assert');
const { parseVersion, compareVersions, isNewer, pickAsset, repoSlug } = require('../lib/updater');

test('parseVersion tolère v et pre-release', () => {
  assert.deepStrictEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3 });
  assert.deepStrictEqual(parseVersion('1.2.3-beta.1'), { major: 1, minor: 2, patch: 3 });
  assert.deepStrictEqual(parseVersion('2.0.0'), { major: 2, minor: 0, patch: 0 });
});

test('compareVersions ordonne correctement', () => {
  assert.strictEqual(compareVersions('1.0.0', '1.0.1'), -1);
  assert.strictEqual(compareVersions('1.2.0', '1.1.9'), 1);
  assert.strictEqual(compareVersions('1.0.0', '1.0.0'), 0);
  assert.strictEqual(compareVersions('2.0.0', '1.9.9'), 1);
});

test('isNewer : remote strictement supérieur seulement', () => {
  assert.strictEqual(isNewer('v1.1.0', '1.0.0'), true);
  assert.strictEqual(isNewer('1.0.0', '1.0.0'), false);
  assert.strictEqual(isNewer('v0.9.0', '1.0.0'), false);
});

test('pickAsset trouve par nom exact', () => {
  const rel = { assets: [
    { name: 'RL-Overlay-win-x64.zip', browser_download_url: 'http://x/z.zip' },
    { name: 'autre.txt', browser_download_url: 'http://x/a.txt' }
  ] };
  assert.strictEqual(pickAsset(rel, 'RL-Overlay-win-x64.zip').browser_download_url, 'http://x/z.zip');
  assert.strictEqual(pickAsset(rel, 'absent.zip'), null);
  assert.strictEqual(pickAsset({}, 'RL-Overlay-win-x64.zip'), null);
});

test('repoSlug parse les formats GitHub courants', () => {
  assert.strictEqual(repoSlug({ repository: 'github:foo/rl-overlay' }), 'foo/rl-overlay');
  assert.strictEqual(repoSlug({ repository: 'https://github.com/foo/rl-overlay.git' }), 'foo/rl-overlay');
  assert.strictEqual(repoSlug({ repository: { url: 'git@github.com:foo/rl-overlay.git' } }), 'foo/rl-overlay');
  assert.strictEqual(repoSlug({}), null);
});
