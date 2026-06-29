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
    version: '1.1.7',
    date: '2026-06-29',
    title: 'Réglages + correctif thèmes',
    items: [
      { icon: '🐛', text: 'Correctif : Ctrl + Alt + T donne enfin accès aux 15 thèmes (les 9 nouveaux étaient bloqués).' },
      { icon: '⚙️', text: 'Nouvelle page Réglages dans le Hub (bouton ⚙).' },
      { icon: '✨', text: 'Le halo du MMR est plus doux : il respire lentement et ne clignote plus. Désactivable dans les Réglages.' },
      { icon: '🎵', text: 'L\'affichage de la musique (Spotify) est désactivable dans les Réglages.' },
    ],
    themes: [],
    images: [],
  },
  {
    version: '1.1.6',
    date: '2026-06-29',
    title: '9 nouveaux thèmes + MMR qui brille',
    items: [
      { icon: '🎨', text: '9 nouveaux thèmes couleur (15 au total). Cycle avec Ctrl + Alt + T.' },
      { icon: '✨', text: 'Le MMR a un halo lumineux qui pulse doucement, sur toutes les formes d\'overlay.' },
    ],
    themePreviews: [
      { name: 'Aurora',     t: { bg:'#06100e', card:'#0a1714', line:'#163029', txt:'#e9fff7', muted:'#7fb0a2', dim:'#4d6f64', aA:'#2ee6a6', aB:'#5bd0ff', good:'#37e0c0', loss:'#ff6b8a', hot:'#2ee6a6', hot2:'#9bffd6' } },
      { name: 'Sunset',     t: { bg:'#120a0c', card:'#1b0f12', line:'#33181f', txt:'#ffeef0', muted:'#c08f96', dim:'#7a565c', aA:'#ff7a3d', aB:'#ff4d8d', good:'#46d39a', loss:'#ff5d6c', hot:'#ff7a3d', hot2:'#ffb46b' } },
      { name: 'Vapor',      t: { bg:'#0c0a16', card:'#120f22', line:'#251f3f', txt:'#f3eaff', muted:'#a394c6', dim:'#665a8c', aA:'#ff8ad6', aB:'#62e6ff', good:'#5af0c0', loss:'#ff6b8a', hot:'#ff8ad6', hot2:'#b3f0ff' } },
      { name: 'Royal Gold', t: { bg:'#070a14', card:'#0c1020', line:'#1e2740', txt:'#fff7e6', muted:'#9aa6c6', dim:'#5d678a', aA:'#ffce5c', aB:'#e0a020', good:'#46d39a', loss:'#ff5d6c', hot:'#ffce5c', hot2:'#fff0b0' } },
      { name: 'Toxic',      t: { bg:'#0a0c08', card:'#0f1310', line:'#222a1c', txt:'#f0ffe6', muted:'#9ab088', dim:'#5d6e50', aA:'#c6ff3d', aB:'#9a5bff', good:'#c6ff3d', loss:'#ff6b6b', hot:'#c6ff3d', hot2:'#e6ff9c' } },
      { name: 'Ember',      t: { bg:'#0d0908', card:'#160d0a', line:'#2c1a14', txt:'#fff0ea', muted:'#c0968a', dim:'#7a5a4c', aA:'#ff5a2e', aB:'#ffaa3d', good:'#46d39a', loss:'#ff3b4e', hot:'#ff5a2e', hot2:'#ffcf6b' } },
      { name: 'Forest',     t: { bg:'#070d09', card:'#0c1510', line:'#1a2c1f', txt:'#eafff0', muted:'#86b094', dim:'#536e5b', aA:'#3de08a', aB:'#a8d84a', good:'#3de08a', loss:'#ff6b6b', hot:'#3de08a', hot2:'#d6ff9c' } },
      { name: 'Coral',      t: { bg:'#120c0a', card:'#1b110d', line:'#33201a', txt:'#fff0ea', muted:'#c79a8a', dim:'#7e5c4c', aA:'#ff6f61', aB:'#ffb48a', good:'#46d39a', loss:'#ff3b4e', hot:'#ff6f61', hot2:'#ffd0b0' } },
      { name: 'Indigo',     t: { bg:'#08081a', card:'#0d0d24', line:'#1f1f44', txt:'#eeeaff', muted:'#9a94c6', dim:'#5d588c', aA:'#6d6bff', aB:'#b86bff', good:'#5af0c0', loss:'#ff6b8a', hot:'#6d6bff', hot2:'#c0b0ff' } },
    ],
    themes: [],
    images: [],
  },
  {
    version: '1.1.5',
    date: '2026-06-29',
    title: 'Mises à jour automatiques',
    items: [
      { icon: '⚡', text: 'Les mises à jour s\'installent et se relancent toutes seules, hors partie. Plus besoin de fermer/relancer à la main.' },
      { icon: '🎮', text: 'Jamais de coupure en plein match : si tu joues, l\'update attend que tu quittes la partie.' },
    ],
    themes: [],
    images: [],
  },
  {
    version: '1.1.4',
    date: '2026-06-29',
    title: 'Overlay discret au lancement',
    items: [
      { icon: '👁️', text: 'L\'overlay n\'apparaît plus partout au démarrage : il s\'affiche seulement quand Rocket League est au premier plan. Ctrl + Alt + H pour le forcer.' },
    ],
    themes: [],
    images: [],
  },
  {
    version: '1.1.3',
    date: '2026-06-29',
    title: 'Correctif mise à jour (anti-boucle)',
    items: [
      { icon: '🛠️', text: 'Corrige un cas où l\'appli pouvait se relancer en boucle après une mise à jour. La mise à jour s\'abandonne proprement si l\'installation échoue, l\'appli démarre normalement.' },
    ],
    themes: [],
    images: [],
  },
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
