# Refonte des formes d'overlay — style Esports HUD premium

Date : 2026-06-22
Statut : validé, prêt pour plan d'implémentation

## Problème

Les 9 formes actuelles (`L1`..`L8` + défaut) sont des variations CSS d'**un seul
panneau** (`index.html`) : chaque forme se contente de masquer/réarranger les
mêmes blocs via `display:none`. Résultat : les formes se ressemblent toutes et
n'ont aucune identité visuelle propre. L'utilisateur veut des formes **vraiment
différentes**, à densité de stats variable, avec un look **premium**.

## Décisions

- **Remplacer** les 9 formes existantes (pas de conservation).
- **5 formes**, gamme de densité large : du minimal (MMR seul) au dashboard complet.
- Direction esthétique : **Esports HUD** — coins biseautés/angulaires (clip-path),
  accents néon, barres lumineuses, glow, look broadcast RLCS.
- Les **8 thèmes** couleur sont conservés et continuent de piloter l'accent.

## Architecture

### État actuel (à comprendre)

- `main.js` envoie au renderer un message `update` contenant **layout** (index de
  forme) + les données : `mmr`, `playlist` (court : 1v1/2v2/3v3), `startMmr`
  (pour le delta), `wins`, `losses`, `streak`, `gameStreak`, `rankTier`,
  `rankDiv`, `rankIcon`, `goals`, `saves`. Le calcul WR et la barre de
  progression (palier de 100 MMR) sont dérivés côté renderer.
- Les données sont **déjà totalement découplées** du layout. main.js ne connaît
  pas la structure HTML.

### Nouveau renderer

1. **`main.js` ne change presque pas** : seul `LAYOUT_COUNT` passe de 9 à 5, et
   `LAYOUT_NAMES` devient `['Minimal','Compact','Compétitif','Dashboard','Boost']`.
   Tout le pipeline de données reste identique.
2. Le renderer maintient un objet **`state`** accumulant les dernières valeurs
   reçues (mmr, rang, W/L, etc.). Les messages partiels (appear, celebrate) ne
   réinitialisent rien.
3. **5 templates HTML indépendants**, chacun avec sa propre structure et son CSS.
   Chaque champ dynamique porte un attribut `data-f="<champ>"` (ex. `data-f="mmr"`,
   `data-f="wl"`, `data-f="streak"`, `data-f="bar"`, `data-f="rankIcon"`...).
4. Au changement de forme (`d.layout`) : on rend le template choisi dans un
   conteneur `#stage`, puis on appelle `paint(state)` pour repeindre.
5. `paint(state)` écrit chaque valeur dans les `[data-f]` **présents dans la
   forme active** (les champs absents d'une forme sont simplement ignorés).
   La logique dérivée (delta coloré, WR, %, prochain palier) vit dans `paint`.
6. **Couche célébration séparée** (`#fx`), superposée au-dessus de `#stage`,
   indépendante de la forme : WIN/LOSS confetti, rank up, toast de thème/forme.
   Le flash vert/rouge cible le conteneur de la forme active.

Avantage isolation : chaque forme est un bloc autonome (template + styles
scopés). Modifier ou ajouter une forme ne touche pas les autres. Les animations
existantes sont conservées et reciblées sur la forme active.

## Les 5 formes

Champs source disponibles : `mmr`, `playlist`, `rankTier`, `rankDiv`,
`rankIcon`, `delta` (= mmr − startMmr, signé/coloré), `wins`, `losses`, `wr`
(dérivé), `streak` (gameStreak sinon streak session), `goals`, `saves`,
`barPct` + `barNext` (palier de 100 MMR, dérivés).

### F0 — Minimal (`⚡`)
- Champs : MMR (géant), delta, streak.
- Chip biseauté étroit (~120px). Usage : discrétion maximale.

### F1 — Compact (`▪`)
- Champs : playlist, rang (texte), MMR, delta, W/L, streak.
- Carte angulaire (~190px). Pas de barre, pas de buts/saves.

### F2 — Compétitif (`◆`)
- Champs : playlist, rang, MMR, delta, **barre de progression + prochain palier**,
  W/L, **WR**, streak.
- Carte (~226px). La forme "match". Pas de buts/saves.

### F3 — Dashboard (`▦`)
- Champs : tout F2 + **icône de rang réelle** (`rankIcon`) + **buts/saves du jour**.
- Carte (~240px). Densité maximale.

### F4 — Boost (anneau) (`◈`)
- **Couronne circulaire** qui entoure la jauge de boost ronde de Rocket League
  (située en bas-droite du jeu — confirmé par capture d'écran). Centre
  **transparent** pour laisser la jauge "100" visible.
- Disposition radiale : MMR (arc haut), rang (sous le MMR), streak (gauche),
  delta (droite), W/L (arc bas).
- Taille ~260×260, centrable sur la jauge avec Ctrl+Alt+Flèches.
- Glow de l'anneau réagit au thème **et** à la streak (vert si win streak,
  rouge si loss streak).

## Communs à toutes les formes

- Coins biseautés via `clip-path`, accent néon piloté par les variables de thème.
- Glow sur le MMR, barres lumineuses (dégradé accent).
- Flash vert/rouge sur changement W/L, confetti WIN/LOSS, animation rank up,
  toasts thème/forme : tous conservés, fonctionnent sur les 5 formes.

## Hors périmètre (YAGNI)

- Pas de nouveau hotkey (le cycle Ctrl+Alt+F reste, juste 5 formes au lieu de 9).
- Pas de changement du pipeline de données / scraping Tracker.
- Pas de configurateur de forme par champ (les 5 presets suffisent).

## Critères de réussite

- Les 5 formes ont des silhouettes et structures visuellement distinctes (pas du
  show/hide du même panneau).
- Ctrl+Alt+F cycle les 5 formes, choix persisté dans config.json.
- La forme Boost entoure réellement la jauge ronde, centre transparent.
- Flash, confetti, rank up, toasts marchent sur les 5 formes.
- Les 8 thèmes s'appliquent correctement à chaque forme.
