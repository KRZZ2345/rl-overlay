// themegen — dérive un jeu complet de tokens de thème à partir de 4 couleurs
// (accent A, accent B, fond, texte). UMD : require() côté main + window.themegen
// côté Hub (aperçu live). Pur, sans I/O.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.themegen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(n) { return Math.max(0, Math.min(255, Math.round(n))); }
  function parse(h) {
    let s = String(h == null ? '' : h).trim().replace(/^#/, '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    const n = parseInt(s, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function hex(c) { return '#' + [c.r, c.g, c.b].map((v) => clamp(v).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, t) {
    const A = parse(a) || { r: 0, g: 0, b: 0 }, B = parse(b) || { r: 255, g: 255, b: 255 };
    return hex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
  }
  function rgba(c, al) { const C = parse(c) || { r: 0, g: 0, b: 0 }; return `rgba(${C.r},${C.g},${C.b},${al})`; }
  function norm(h, def) { return parse(h) ? hex(parse(h)) : def; }

  // Entrée : { aA, aB, bg, txt }. Sortie : tous les tokens (clés sans '--').
  function deriveTheme(inp) {
    inp = inp || {};
    const aA = norm(inp.aA, '#ff8a3d'), aB = norm(inp.aB, '#ffc24d');
    const bg = norm(inp.bg, '#0a0b0e'), txt = norm(inp.txt, '#f5f6f8');
    const card = mix(bg, txt, 0.06), line = mix(bg, txt, 0.16);
    return {
      bg, card, line, txt,
      muted: mix(txt, bg, 0.45), dim: mix(txt, bg, 0.65),
      aA, aB, accent: aA, accent2: aB, title: txt,
      good: '#46d39a', loss: '#ff5d6c', hot: aA, hot2: aB,
      bg1: rgba(card, 0.62), bg2: rgba(bg, 0.66),
    };
  }

  return { deriveTheme, mix, rgba, parse, hex, norm };
});
