// test/sparkline.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { sparkline } = require('../lib/sparkline');

test('moins de 2 valeurs -> null', () => {
  assert.strictEqual(sparkline([]), null);
  assert.strictEqual(sparkline([1200]), null);
  assert.strictEqual(sparkline(null), null);
});

test('génère n points, bornes x = pad..w-pad, sens up', () => {
  const s = sparkline([1200, 1210, 1190, 1230], 140, 36, 3);
  const pts = s.points.split(' ');
  assert.strictEqual(pts.length, 4);
  assert.strictEqual(parseFloat(pts[0].split(',')[0]), 3);            // 1er x = pad
  assert.strictEqual(parseFloat(pts[3].split(',')[0]), 140 - 3);      // dernier x = w-pad
  assert.strictEqual(s.up, true);  // 1230 >= 1200
  assert.strictEqual(s.first, 1200);
  assert.strictEqual(s.last, 1230);
});

test('le max est en haut (y le plus petit), le min en bas', () => {
  const s = sparkline([1000, 2000], 100, 40, 0);
  const [, y0] = s.points.split(' ')[0].split(',').map(Number);
  const [, y1] = s.points.split(' ')[1].split(',').map(Number);
  assert.ok(y1 < y0, 'la valeur la plus haute doit avoir un y plus petit');
});

test('ligne plate -> centrée verticalement, up=true', () => {
  const s = sparkline([1500, 1500, 1500], 100, 40);
  for (const p of s.points.split(' ')) assert.strictEqual(parseFloat(p.split(',')[1]), 20);
  assert.strictEqual(s.up, true);
});

test('tendance descendante -> up=false', () => {
  assert.strictEqual(sparkline([1300, 1250, 1200]).up, false);
});
