'use strict';

// Logique de version pure (pas d'I/O, pas d'Electron) -> testable node:test.

function parseVersion(s) {
  const clean = String(s).trim().replace(/^v/i, '').split('-')[0];
  const [major = 0, minor = 0, patch = 0] = clean.split('.').map((n) => parseInt(n, 10) || 0);
  return { major, minor, patch };
}

function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  for (const k of ['major', 'minor', 'patch']) {
    if (x[k] > y[k]) return 1;
    if (x[k] < y[k]) return -1;
  }
  return 0;
}

function isNewer(remoteTag, currentVersion) {
  return compareVersions(remoteTag, currentVersion) > 0;
}

function pickAsset(release, assetName) {
  const assets = (release && release.assets) || [];
  return assets.find((a) => a.name === assetName) || null;
}

function repoSlug(pkg) {
  let r = pkg && pkg.repository;
  if (!r) return null;
  if (typeof r === 'object') r = r.url || '';
  const m = String(r).match(/github(?::|\.com[/:])([\w.-]+\/[\w.-]+?)(?:\.git)?$/i);
  return m ? m[1] : null;
}

module.exports = { parseVersion, compareVersions, isNewer, pickAsset, repoSlug };
