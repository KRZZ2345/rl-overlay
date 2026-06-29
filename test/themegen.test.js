// test/themegen.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { deriveTheme, mix, parse, hex, rgba } = require('../lib/themegen');

test('parse hex (6 et 3 chiffres) + invalide', () => {
  assert.deepStrictEqual(parse('#ff8a3d'), { r: 255, g: 138, b: 61 });
  assert.deepStrictEqual(parse('f00'), { r: 255, g: 0, b: 0 });
  assert.strictEqual(parse('nope'), null);
});

test('mix interpole + hex arrondit', () => {
  assert.strictEqual(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.strictEqual(mix('#000000', '#ffffff', 0), '#000000');
  assert.strictEqual(hex({ r: 16, g: 32, b: 48 }), '#102030');
});

test('rgba format', () => {
  assert.strictEqual(rgba('#0a0b0e', 0.62), 'rgba(10,11,14,0.62)');
});

test('deriveTheme : tokens complets, déterministe, good/loss fixes', () => {
  const t = deriveTheme({ aA: '#39c5ff', aB: '#7af0e0', bg: '#070b0f', txt: '#eaf6ff' });
  // entrées préservées
  assert.strictEqual(t.aA, '#39c5ff'); assert.strictEqual(t.aB, '#7af0e0');
  assert.strictEqual(t.bg, '#070b0f'); assert.strictEqual(t.txt, '#eaf6ff');
  // alias
  assert.strictEqual(t.accent, '#39c5ff'); assert.strictEqual(t.title, '#eaf6ff');
  assert.strictEqual(t.hot, '#39c5ff'); assert.strictEqual(t.hot2, '#7af0e0');
  // W/L lisibles (fixes)
  assert.strictEqual(t.good, '#46d39a'); assert.strictEqual(t.loss, '#ff5d6c');
  // fonds translucides
  assert.match(t.bg1, /^rgba\(/); assert.match(t.bg2, /^rgba\(/);
  // card/line entre bg et txt
  assert.ok(parse(t.card).r >= parse(t.bg).r && parse(t.card).r <= parse(t.txt).r);
  // déterministe
  assert.deepStrictEqual(deriveTheme({ aA: '#39c5ff', aB: '#7af0e0', bg: '#070b0f', txt: '#eaf6ff' }), t);
});

test('deriveTheme : défauts si entrées invalides', () => {
  const t = deriveTheme({ aA: 'xxx', bg: null });
  assert.strictEqual(t.aA, '#ff8a3d'); // défaut Octane
  assert.strictEqual(t.bg, '#0a0b0e');
});
