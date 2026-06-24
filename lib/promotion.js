'use strict';

// Approximation : on traite chaque division comme une fenêtre fixe de 100 MMR.
// La vraie taille varie selon le rang ; documenté comme estimation.
const DIV_SIZE = 100;

function avgWinGain(events, fallback = 9) {
  const wins = events.filter((e) => e.win);
  if (wins.length === 0) return fallback;
  const sum = wins.reduce((a, e) => a + e.delta, 0);
  return Math.round(sum / wins.length);
}

function promotion(mmr, avgGain, divSize = DIV_SIZE) {
  const into = ((mmr % divSize) + divSize) % divSize; // position dans la division
  const mmrToNext = into === 0 ? divSize : divSize - into;
  const pct = Math.round((into / divSize) * 100);
  const g = avgGain > 0 ? avgGain : 1;
  const matchesNeeded = Math.ceil(mmrToNext / g);
  return { mmrToNext, pct, matchesNeeded };
}

module.exports = { avgWinGain, promotion, DIV_SIZE };
