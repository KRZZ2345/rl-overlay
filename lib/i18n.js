'use strict';

// Scaffold i18n (terrain). Dictionnaire + t() PUR et testable. PAS encore câblé à
// l'UI : le brancher (overlay + hub) est un refactor à faire supervisé. Quand on
// branchera, on lira config.overlay.lang et on remplacera les libellés en dur par t().
// Défaut : 'fr' (langue actuelle de l'app).

const STRINGS = {
  fr: {
    'settings.title': 'Réglages',
    'settings.sub': "Réglages de l'affichage de l'overlay en jeu.",
    'settings.glow': 'Halo du MMR',
    'settings.music': 'Affichage de la musique',
    'settings.streak': 'Série de victoires',
    'settings.delta': 'Écart de MMR (±)',
    'settings.size': "Taille de l'overlay",
    'settings.opacity': "Opacité de l'overlay",
    'settings.reset': 'Réinitialiser les réglages',
    'settings.diagnostic': 'Diagnostic',
    'settings.openLogs': 'Ouvrir les logs',
    'settings.checkUpdate': 'Vérifier la maj',
    'history.title': 'Historique',
    'history.today': "Aujourd'hui",
    'history.winRate': 'Win-rate (jour)',
    'history.netMmr': 'Net MMR (jour)',
    'history.total': 'Matchs (total)',
    'history.empty': "Aucun match enregistré pour l'instant — joue une partie classée.",
    'history.mmrCurve': 'Courbe MMR',
    'news.title': 'Nouveautés',
    'keys.title': 'Raccourcis',
    'common.close': 'Fermer',
    'common.on': 'oui',
    'common.off': 'non',
  },
  en: {
    'settings.title': 'Settings',
    'settings.sub': 'In-game overlay display settings.',
    'settings.glow': 'MMR glow',
    'settings.music': 'Music display',
    'settings.streak': 'Win streak',
    'settings.delta': 'MMR delta (±)',
    'settings.size': 'Overlay size',
    'settings.opacity': 'Overlay opacity',
    'settings.reset': 'Reset settings',
    'settings.diagnostic': 'Diagnostics',
    'settings.openLogs': 'Open logs',
    'settings.checkUpdate': 'Check for update',
    'history.title': 'History',
    'history.today': 'Today',
    'history.winRate': 'Win rate (day)',
    'history.netMmr': 'Net MMR (day)',
    'history.total': 'Matches (total)',
    'history.empty': 'No matches recorded yet — play a ranked game.',
    'history.mmrCurve': 'MMR curve',
    'news.title': "What's new",
    'keys.title': 'Shortcuts',
    'common.close': 'Close',
    'common.on': 'yes',
    'common.off': 'no',
  },
};

const DEFAULT_LANG = 'fr';

// Traduit une clé. Repli : langue -> fr -> clé brute (jamais d'erreur, jamais vide).
function t(key, lang) {
  const l = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  if (l[key] != null) return l[key];
  if (STRINGS[DEFAULT_LANG][key] != null) return STRINGS[DEFAULT_LANG][key];
  return key;
}

function languages() { return Object.keys(STRINGS); }

module.exports = { t, languages, STRINGS, DEFAULT_LANG };
