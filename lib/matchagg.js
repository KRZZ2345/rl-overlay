'use strict';

// Agrège les échantillons UpdateState du joueur local sur la durée d'un match
// pour produire un récap (boost moyen, % temps à 0/100 boost, sol/air, démos,
// touches). Pur/testable. Une instance par match (reset au début).
function createAggregator() {
  let n = 0, bSum = 0, bZero = 0, bFull = 0, sSum = 0, sMax = 0, ground = 0, air = 0;
  let demos = 0, touches = 0;

  return {
    // me = modèle joueur local (statsmodel.matchModel().me)
    sample(me) {
      if (!me) return;
      n++;
      const b = Number(me.boost) || 0;
      bSum += b; if (b <= 1) bZero++; if (b >= 99) bFull++;
      const sp = Number(me.speed) || 0;
      sSum += sp; if (sp > sMax) sMax = sp;
      if (me.onGround) ground++; else air++;
      demos = Number(me.demos) || demos;       // valeurs cumulées -> on garde la dernière
      touches = Number(me.touches) || touches;
    },
    samples() { return n; },
    // null si aucun échantillon (match sans données).
    finalize() {
      if (n === 0) return null;
      const pct = (x) => Math.round((x / n) * 100);
      return {
        samples: n,
        avgBoost: Math.round(bSum / n),
        boostZeroPct: pct(bZero),
        boostFullPct: pct(bFull),
        avgSpeed: Math.round(sSum / n),
        maxSpeed: Math.round(sMax),
        groundPct: pct(ground),
        airPct: pct(air),
        demos,
        touches,
      };
    },
  };
}

module.exports = { createAggregator };
