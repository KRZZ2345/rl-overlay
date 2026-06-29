// test/mmrcalib.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { fit, apply, addPair, SLOPE, DEFAULT_OFFSET } = require('../lib/mmrcalib');

test('formule par défaut : 20*interne + 100 (aucune paire)', () => {
  const c = fit([]);
  assert.strictEqual(c.slope, 20);
  assert.strictEqual(c.offset, 100);
  assert.strictEqual(c.confirmed, false);
  assert.strictEqual(apply(21.11, c), 522); // 20*21.11+100 = 522.2 -> 522
  assert.strictEqual(apply(30.22, c), 704); // 20*30.22+100 = 704.4 -> 704
});

test('paire proche de la formule -> confirmée, offset stable', () => {
  const c = fit([{ internal: 30.22, displayed: 704 }]);
  assert.strictEqual(c.slope, 20);
  assert.strictEqual(c.confirmed, true);
  assert.strictEqual(apply(30.22, c), 704);
});

test('paire aberrante (tracker périmé) rejetée -> reste sur la formule', () => {
  // 30.69 -> réel ~714 ; tracker périmé dit 704 (offset implicite ~90, |90-100|=10 > 6)
  const c = fit([{ internal: 30.69, displayed: 704 }]);
  assert.strictEqual(c.trusted, 0);     // rejetée
  assert.strictEqual(c.offset, 100);    // garde la formule
  assert.strictEqual(apply(30.69, c), 714); // 20*30.69+100 = 713.8 -> 714
});

test('pas de pente=0 dégénérée même avec des paires polluées', () => {
  // cas réel qui cassait la régression : même affiché, internes différents
  const c = fit([{ internal: 30.22, displayed: 704 }, { internal: 30.69, displayed: 704 }]);
  assert.strictEqual(c.slope, 20); // jamais 0
  // 30.69 reste converti par la pente, pas bloqué
  assert.strictEqual(apply(30.69, c), 714);
});

test('offset affiné par médiane si >=3 paires fiables', () => {
  const c = fit([
    { internal: 21, displayed: 521 }, // offset 101
    { internal: 26, displayed: 622 }, // offset 102
    { internal: 30, displayed: 701 }, // offset 101
  ]);
  assert.strictEqual(c.trusted, 3);
  assert.strictEqual(c.offset, 101); // médiane(101,102,101)
  assert.strictEqual(c.confirmed, true);
});

test('addPair remplace si interne quasi identique', () => {
  let l = addPair([], 30.22, 704);
  l = addPair(l, 30.225, 705);
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0].displayed, 705);
});

test('apply garde-fous', () => {
  assert.strictEqual(apply(NaN, { slope: 20, offset: 100 }), null);
  assert.strictEqual(apply(21, null), null);
});