// test/entitlement.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const ent = require('../entitlement');

test('par défaut tout est gratuit (isPremium=true)', () => {
  assert.strictEqual(ent.isPremium(undefined), true);
  assert.strictEqual(ent.isPremium({ overlay: {} }), true);
  assert.strictEqual(ent.isPremium({ overlay: { premium: true } }), true);
});

test('premium:false simule le palier gratuit limité', () => {
  const cfg = { overlay: { premium: false } };
  assert.strictEqual(ent.isPremium(cfg), false);
  assert.strictEqual(ent.canUseTheme(0, cfg), true);  // Octane = gratuit
  assert.strictEqual(ent.canUseTheme(7, cfg), false); // Sunset = premium
  assert.strictEqual(ent.canUseLayout(5, cfg), true); // Premium layout = gratuit
  assert.strictEqual(ent.canUseLayout(8, cfg), false); // Marquee = premium
});

test('en premium tout est accessible', () => {
  const cfg = { overlay: { premium: true } };
  assert.strictEqual(ent.canUseTheme(7, cfg), true);
  assert.strictEqual(ent.canUseLayout(8, cfg), true);
});
