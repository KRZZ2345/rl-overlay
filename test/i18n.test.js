// test/i18n.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { t, languages, STRINGS, DEFAULT_LANG } = require('../lib/i18n');

test('t renvoie le français par défaut', () => {
  assert.strictEqual(t('settings.title'), 'Réglages');
  assert.strictEqual(t('settings.title', 'fr'), 'Réglages');
});

test('t renvoie l\'anglais demandé', () => {
  assert.strictEqual(t('settings.title', 'en'), 'Settings');
  assert.strictEqual(t('history.empty', 'en'), 'No matches recorded yet — play a ranked game.');
});

test('repli : langue inconnue -> fr, clé inconnue -> clé brute', () => {
  assert.strictEqual(t('settings.title', 'xx'), 'Réglages'); // langue inconnue -> fr
  assert.strictEqual(t('cle.inexistante', 'en'), 'cle.inexistante'); // clé manquante -> brute
});

test('langues dispo + défaut', () => {
  assert.deepStrictEqual(languages().sort(), ['en', 'fr']);
  assert.strictEqual(DEFAULT_LANG, 'fr');
});

test('FR et EN ont exactement les mêmes clés (pas de trou de traduction)', () => {
  const fr = Object.keys(STRINGS.fr).sort();
  const en = Object.keys(STRINGS.en).sort();
  assert.deepStrictEqual(en, fr);
});
