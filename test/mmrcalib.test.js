// test/mmrcalib.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { fit, apply, addPair, maxResidual } = require('../lib/mmrcalib');

test('1 paire -> pente assumée 20, offset calé sur le point', () => {
  const c = fit([{ internal: 21.11, displayed: 522 }]);
  assert.strictEqual(c.slope, 20);
  assert.ok(Math.abs(c.offset - (522 - 20 * 21.11)) < 1e-6);
  assert.strictEqual(c.assumed, true);
  assert.strictEqual(apply(21.11, c), 522); // exact sur le point connu
});

test('régression sur points linéaires parfaits (affiché = 20*interne + 100)', () => {
  const pairs = [{ internal: 21, displayed: 520 }, { internal: 26, displayed: 620 }, { internal: 30, displayed: 700 }];
  const c = fit(pairs);
  assert.ok(Math.abs(c.slope - 20) < 1e-6, 'pente ~20');
  assert.ok(Math.abs(c.offset - 100) < 1e-6, 'offset ~100');
  assert.strictEqual(c.assumed, false);
  assert.strictEqual(apply(28, c), 660); // 20*28+100
  assert.ok(maxResidual(pairs, c) < 1e-6);
});

test('addPair : ajoute, remplace si interne quasi identique, borne', () => {
  let l = [];
  l = addPair(l, 21.11, 522);
  l = addPair(l, 21.115, 525); // ~même interne -> remplace
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0].displayed, 525);
  l = addPair(l, 26, 620);
  assert.strictEqual(l.length, 2);
});

test('valeurs invalides ignorées', () => {
  assert.strictEqual(fit([]), null);
  assert.strictEqual(apply(NaN, { slope: 20, offset: 100 }), null);
  assert.strictEqual(apply(21, null), null);
  assert.deepStrictEqual(addPair([{ internal: 1, displayed: 2 }], NaN, 5), [{ internal: 1, displayed: 2 }]);
});