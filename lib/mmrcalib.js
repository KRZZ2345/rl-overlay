'use strict';

// Calibration MMR interne (log : PartyLeaderMMR) -> MMR affiché (tracker).
// Hypothèse : relation linéaire affiché = pente*interne + offset (par playlist).
// Observé 1v1 : 21.11 -> 522 ≈ 20*interne + 100. On apprend pente/offset depuis
// les paires (interne, affiché) collectées au fil des matchs, puis on calcule le
// MMR affiché EN DIRECT depuis le log (instantané, exact si linéaire). Pur/testable.

const ASSUMED_SLOPE = 20; // pente par défaut tant qu'on n'a qu'un point

// Régression linéaire moindres carrés. <2 points distincts -> pente assumée.
function fit(pairs) {
  const pts = (Array.isArray(pairs) ? pairs : []).filter((p) => Number.isFinite(p.internal) && Number.isFinite(p.displayed));
  if (pts.length === 0) return null;
  if (pts.length === 1) {
    return { slope: ASSUMED_SLOPE, offset: pts[0].displayed - ASSUMED_SLOPE * pts[0].internal, n: 1, assumed: true };
  }
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.internal, 0);
  const sy = pts.reduce((a, p) => a + p.displayed, 0);
  const sxx = pts.reduce((a, p) => a + p.internal * p.internal, 0);
  const sxy = pts.reduce((a, p) => a + p.internal * p.displayed, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) { // tous les internes ~égaux -> pente assumée
    return { slope: ASSUMED_SLOPE, offset: sy / n - ASSUMED_SLOPE * (sx / n), n, assumed: true };
  }
  const slope = (n * sxy - sx * sy) / denom;
  const offset = (sy - slope * sx) / n;
  return { slope, offset, n, assumed: false };
}

// MMR affiché estimé depuis l'interne + la calibration.
function apply(internal, calib) {
  if (!calib || !Number.isFinite(internal)) return null;
  return Math.round(calib.slope * internal + calib.offset);
}

// Ajoute/maj une paire (remplace si interne quasi identique), borne la liste.
function addPair(list, internal, displayed, cap = 20) {
  if (!Number.isFinite(internal) || !Number.isFinite(displayed)) return Array.isArray(list) ? list : [];
  const out = Array.isArray(list) ? list.slice() : [];
  const i = out.findIndex((p) => Math.abs(p.internal - internal) < 0.01);
  if (i >= 0) out[i] = { internal, displayed }; else out.push({ internal, displayed });
  return out.slice(-cap);
}

// Résidu max |affiché - prédit| sur les paires (mesure la qualité du linéaire).
function maxResidual(pairs, calib) {
  if (!calib) return null;
  let max = 0;
  for (const p of pairs || []) {
    if (!Number.isFinite(p.internal) || !Number.isFinite(p.displayed)) continue;
    max = Math.max(max, Math.abs(p.displayed - (calib.slope * p.internal + calib.offset)));
  }
  return max;
}

module.exports = { fit, apply, addPair, maxResidual, ASSUMED_SLOPE };
