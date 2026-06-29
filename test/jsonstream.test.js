// test/jsonstream.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { createJsonStream } = require('../lib/jsonstream');

function collect() {
  const out = [];
  return { push: createJsonStream((v) => out.push(v)), out };
}

test('un objet complet en un chunk', () => {
  const s = collect();
  s.push('{"a":1}');
  assert.deepStrictEqual(s.out, [{ a: 1 }]);
});

test('deux objets concaténés (sans délimiteur)', () => {
  const s = collect();
  s.push('{"a":1}{"b":2}');
  assert.deepStrictEqual(s.out, [{ a: 1 }, { b: 2 }]);
});

test('objet à cheval sur deux chunks', () => {
  const s = collect();
  s.push('{"a":1,"b":');
  assert.deepStrictEqual(s.out, []);
  s.push('2}');
  assert.deepStrictEqual(s.out, [{ a: 1, b: 2 }]);
});

test('accolades dans une chaîne ignorées', () => {
  const s = collect();
  s.push('{"name":"a{b}c","n":1}');
  assert.deepStrictEqual(s.out, [{ name: 'a{b}c', n: 1 }]);
});

test('guillemet échappé dans une chaîne', () => {
  const s = collect();
  s.push('{"q":"he said \\"hi\\" }","n":2}');
  assert.deepStrictEqual(s.out, [{ q: 'he said "hi" }', n: 2 }]);
});

test('objets imbriqués + bruit/espaces entre objets', () => {
  const s = collect();
  s.push('  {"o":{"x":1}}\n  {"o":{"y":2}} ');
  assert.deepStrictEqual(s.out, [{ o: { x: 1 } }, { o: { y: 2 } }]);
});

test('flux fragmenté caractère par caractère', () => {
  const s = collect();
  for (const c of '{"a":[1,2,3]}') s.push(c);
  assert.deepStrictEqual(s.out, [{ a: [1, 2, 3] }]);
});
