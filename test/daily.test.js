// test/daily.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { dailyChallenge, DAILY_TEMPLATES } = require('../lib/daily');

const ctx = { todayGain: 0, sessionWins: 0, sessionLosses: 0, tilted: false };

test('même jour => même défi (déterministe)', () => {
  const a = dailyChallenge('2026-06-25', ctx);
  const b = dailyChallenge('2026-06-25', ctx);
  assert.strictEqual(a.id, b.id);
});

test('jours différents peuvent changer de défi (couvre tout le pool sur 30 jours)', () => {
  const ids = new Set();
  for (let d = 1; d <= 30; d++) ids.add(dailyChallenge(`2026-06-${String(d).padStart(2, '0')}`, ctx).id);
  assert.ok(ids.size >= 2, 'le pool doit tourner, ids vus: ' + ids.size);
});

test('défi mmrGain : value=todayGain, done quand atteint', () => {
  const tpl = DAILY_TEMPLATES.find((t) => t.metric === 'mmrGain');
  // force ce template via un dayKey dont l'index tombe dessus
  const idx = DAILY_TEMPLATES.indexOf(tpl);
  const key = forceKey(idx);
  const c = dailyChallenge(key, { ...ctx, todayGain: tpl.target });
  assert.strictEqual(c.value, tpl.target);
  assert.strictEqual(c.done, true);
  assert.strictEqual(c.pct, 100);
});

test('winrate : value = pourcentage de victoires de session', () => {
  const tpl = DAILY_TEMPLATES.find((t) => t.metric === 'winrate');
  const c = dailyChallenge(forceKey(DAILY_TEMPLATES.indexOf(tpl)), { ...ctx, sessionWins: 3, sessionLosses: 1 });
  assert.strictEqual(c.value, 75);
});

test('noTilt : value=1 si pas tilt, done', () => {
  const tpl = DAILY_TEMPLATES.find((t) => t.metric === 'noTilt');
  const c = dailyChallenge(forceKey(DAILY_TEMPLATES.indexOf(tpl)), { ...ctx, tilted: false });
  assert.strictEqual(c.value, 1);
  assert.strictEqual(c.done, true);
});

test('pct borné à 100 même si value dépasse target', () => {
  const tpl = DAILY_TEMPLATES.find((t) => t.metric === 'mmrGain');
  const c = dailyChallenge(forceKey(DAILY_TEMPLATES.indexOf(tpl)), { ...ctx, todayGain: tpl.target * 5 });
  assert.strictEqual(c.pct, 100);
});

// Construit une clé dont la somme des codes char % pool == idx (suffixe variable).
function forceKey(idx) {
  for (let n = 0; n < 1000; n++) {
    const key = '2026-06-25#' + n;
    let s = 0;
    for (const ch of key) s += ch.charCodeAt(0);
    if (s % DAILY_TEMPLATES.length === idx) return key;
  }
  throw new Error('clé introuvable pour idx ' + idx);
}
