'use strict';

// Point central du modèle freemium ("prépare le terrain pour le payant").
// AUJOURD'HUI : tout est gratuit -> isPremium() renvoie true partout. Quand on
// branchera une licence (cf. docs/.../freemium-big-update-design.md §6), SEUL ce
// module changera : la validation de clé pilotera isPremium(). Les thèmes/formes/
// features "premium" sont déjà taguées ici (métadonnée) mais non bloquées tant
// qu'isPremium() = true.

// Override possible via config.overlay.premium :
//   undefined / true  -> tout débloqué (état actuel)
//   false             -> simule le palier GRATUIT limité (pour tester plus tard)
function isPremium(cfg) {
  const o = (cfg && cfg.overlay) || {};
  return o.premium !== false;
}

// Paliers de référence (indices alignés sur THEME_COUNT / LAYOUT_COUNT).
// Servent à la future UI (cadenas + CTA "Débloquer"). Non enforced tant que
// isPremium() = true.
const FREE_THEMES = [0, 1, 5];   // Octane, Cryo, Crimson
const FREE_LAYOUTS = [0, 5];     // Minimal, Premium

function isThemeFree(i) { return FREE_THEMES.includes(i); }
function isLayoutFree(i) { return FREE_LAYOUTS.includes(i); }

// Accès à un thème/forme donné selon le palier courant.
function canUseTheme(i, cfg) { return isPremium(cfg) || isThemeFree(i); }
function canUseLayout(i, cfg) { return isPremium(cfg) || isLayoutFree(i); }

module.exports = {
  isPremium, isThemeFree, isLayoutFree, canUseTheme, canUseLayout,
  FREE_THEMES, FREE_LAYOUTS,
};
