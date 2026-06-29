// test/matchagg.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { createAggregator } = require('../lib/matchagg');

test('aucun échantillon -> null', () => {
  assert.strictEqual(createAggregator().finalize(), null);
});

test('moyennes boost + % 0/100 + sol/air', () => {
  const a = createAggregator();
  a.sample({ boost: 0, speed: 10, onGround: true, demos: 0, touches: 1 });
  a.sample({ boost: 100, speed: 30, onGround: false, demos: 1, touches: 3 });
  a.sample({ boost: 50, speed: 20, onGround: true, demos: 1, touches: 5 });
  const r = a.finalize();
  assert.strictEqual(r.samples, 3);
  assert.strictEqual(r.avgBoost, 50);       // (0+100+50)/3
  assert.strictEqual(r.boostZeroPct, 33);   // 1/3
  assert.strictEqual(r.boostFullPct, 33);   // 1/3
  assert.strictEqual(r.groundPct, 67);      // 2/3
  assert.strictEqual(r.airPct, 33);
  assert.strictEqual(r.maxSpeed, 30);
  assert.strictEqual(r.demos, 1);           // dernière valeur cumulée
  assert.strictEqual(r.touches, 5);
});

test('ignore les échantillons null', () => {
  const a = createAggregator();
  a.sample(null); a.sample({ boost: 80, onGround: true });
  assert.strictEqual(a.samples(), 1);
  assert.strictEqual(a.finalize().avgBoost, 80);
});
