'use strict';

// Conversion MMR interne (log : PartyLeaderMMR) -> MMR affiché.
// Relation GLOBALE observée et vérifiée : affiché ≈ 20*interne + 100
//   1v1 : 21.11 -> 522  (20*21.11+100 = 522.2)
//   2v2 : 30.22 -> 704  (20*30.22+100 = 704.4)
// On fige donc la pente à 20 et l'offset par défaut à 100. On NE régresse PAS la
// pente depuis tracker : ça se faisait polluer par le lag tracker (deux files avec
// le même affiché périmé mais des internes différents -> pente=0). On affine
// seulement l'offset, par MÉDIANE des paires PROCHES de la formule (les paires
// aberrantes = tracker périmé sont rejetées). Pur/testable.

const SLOPE = 20;
const DEFAULT_OFFSET = 100;
const TOL = 6;           // |offset implicite - 100| toléré (au-delà = tracker périmé)
const MIN_TRUSTED = 3;   // nb de paires fiables avant d'affiner l'offset

// Offsets implicites (affiché - 20*interne) des paires proches de la formule.
function trustedOffsets(pairs) {
  return (Array.isArray(pairs) ? pairs : [])
    .filter((p) => Number.isFinite(p.internal) && Number.isFinite(p.displayed))
    .map((p) => p.displayed - SLOPE * p.internal)
    .filter((o) => Math.abs(o - DEFAULT_OFFSET) <= TOL);
}

function median(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Renvoie toujours une calibration utilisable (pente 20, offset 100 par défaut,
// affiné par médiane si assez de paires fiables). `confirmed` = offset validé par
// des paires réelles (pas juste la formule par défaut).
function fit(pairs) {
  const offs = trustedOffsets(pairs);
  let offset = DEFAULT_OFFSET, confirmed = false;
  if (offs.length >= MIN_TRUSTED) { offset = median(offs); confirmed = true; }
  else if (offs.length >= 1) { confirmed = true; } // la formule est confirmée par ≥1 paire proche
  return { slope: SLOPE, offset, n: (Array.isArray(pairs) ? pairs.length : 0), trusted: offs.length, confirmed };
}

function apply(internal, calib) {
  if (!calib || !Number.isFinite(internal)) return null;
  return Math.round(calib.slope * internal + calib.offset);
}

// Ajoute/maj une paire (remplace si interne quasi identique), borne la liste.
function addPair(list, internal, displayed, cap = 30) {
  if (!Number.isFinite(internal) || !Number.isFinite(displayed)) return Array.isArray(list) ? list : [];
  const out = Array.isArray(list) ? list.slice() : [];
  const i = out.findIndex((p) => Math.abs(p.internal - internal) < 0.01);
  if (i >= 0) out[i] = { internal, displayed }; else out.push({ internal, displayed });
  return out.slice(-cap);
}

module.exports = { fit, apply, addPair, trustedOffsets, SLOPE, DEFAULT_OFFSET };
