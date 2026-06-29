// patchnotes.js — historique des nouveautés affiché dans le Hub.
//
// Source de vérité unique des "patch notes". Chargée par hub.html (<script>),
// rendue par la surcouche #news. La page Nouveautés s'ouvre :
//   - automatiquement au 1er lancement APRÈS un update (cf. main.js : compare
//     overlay.lastSeenVersion vs app.getVersion()),
//   - manuellement via le bouton 🎁 du Hub.
//
// Le plus récent EN PREMIER (index 0 = version courante). Généré/maintenu par
// le skill `.claude/skills/patch-notes`.
//
// Schéma d'une entrée :
//   version : 'X.Y.Z'   (doit matcher package.json à la release)
//   date    : 'YYYY-MM-DD'
//   title   : titre court de la version
//   items   : [{ icon, text }]            — la liste des changements
//   themes  : [{ name, a, b }]            — (option) pastilles dégradé aA→aB
//   images  : ['img/xxx.png']             — (option) captures, rendues en grille
window.PATCH_NOTES = [
  {
    version: '1.1.2',
    date: '2026-06-29',
    title: 'Mises à jour plus fiables',
    items: [
      { icon: '🔄', text: 'Les mises à jour se vérifient et se téléchargent dès le lancement, sans avoir besoin d\'être en partie. Plus besoin d\'ouvrir Rocket League pour recevoir une update.' },
    ],
    themes: [],
    images: [],
  },
  {
    version: '1.1.1',
    date: '2026-06-29',
    title: 'Page Nouveautés & confort du Hub',
    items: [
      { icon: '🎁', text: 'Nouvelle page Nouveautés dans le Hub (bouton 🎁), ouverte automatiquement au 1er lancement après une mise à jour.' },
      { icon: '🪟', text: 'Le Hub se ferme tout seul quand tu le quittes des yeux — l\'overlay en jeu revient sans rester bloqué caché.' },
    ],
    themes: [],
    images: [],
  },
  {
    version: '1.1.0',
    date: '2026-06-29',
    title: 'Thèmes, formes & tableau de bord',
    items: [
      { icon: '🎨', text: '6 thèmes couleur partagés sur l\'overlay, le Premium et le Hub. Cycle avec Ctrl + Alt + T.' },
      { icon: '🔷', text: '9 formes d\'overlay (Badge, Split Wing, Cyber Glow, Marquee…). Cycle avec Ctrl + Alt + F.' },
      { icon: '🟢', text: 'Série de victoires affichée en vert.' },
      { icon: '📊', text: 'Hub aux libellés clairs : 10 dernières parties, Parcours des rangs, Analyses, Élan de session, Régularité.' },
      { icon: '🚀', text: 'Configuration en 2 étapes : pseudo, puis choix du thème avec aperçu Premium en direct.' },
      { icon: '⌨️', text: 'Page des raccourcis dans le Hub (bouton ?), ouverte une fois au tout 1er lancement.' },
      { icon: '🔄', text: 'Mise à jour automatique depuis GitHub : les futures versions s\'installent seules au lancement.' },
    ],
    themes: [
      { name: 'Octane',    a: '#ff8a3d', b: '#ffc24d' },
      { name: 'Cryo',      a: '#39c5ff', b: '#7af0e0' },
      { name: 'Synthwave', a: '#ff3db4', b: '#8a5bff' },
      { name: 'Mono',      a: '#e8eaee', b: '#9aa0aa' },
      { name: 'Acid',      a: '#b6ff3d', b: '#5fd17a' },
      { name: 'Crimson',   a: '#ff3b4e', b: '#ff8a3d' },
    ],
    images: [],
  },
];
