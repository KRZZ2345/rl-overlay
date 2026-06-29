'use strict';

// Génère les points d'une mini-courbe (sparkline) SVG. Logique pure -> testable.
// Le rendu (le <svg>/<polyline>) est fait côté Hub à partir de ce retour.
// Renvoie null si moins de 2 valeurs (rien à tracer).
function sparkline(values, w = 140, h = 36, pad = 3) {
  const v = (Array.isArray(values) ? values : []).filter((n) => Number.isFinite(n));
  if (v.length < 2) return null;
  const min = Math.min(...v), max = Math.max(...v);
  const span = (max - min) || 1; // évite division par zéro (ligne plate -> milieu)
  const n = v.length;
  const pts = v.map((val, i) => {
    const x = pad + (i / (n - 1)) * (w - 2 * pad);
    // MMR plus haut = point plus haut (y plus petit). Ligne plate -> centrée.
    const y = (max === min) ? h / 2 : pad + (1 - (val - min) / span) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { points: pts.join(' '), w, h, up: v[n - 1] >= v[0], min, max, first: v[0], last: v[n - 1] };
}

module.exports = { sparkline };
