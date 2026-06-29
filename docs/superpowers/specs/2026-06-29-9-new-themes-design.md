# Design — 9 nouveaux thèmes + aperçus par thème dans les Nouveautés

Date : 2026-06-29
Statut : à implémenter

## But

Ajouter 9 thèmes couleur à l'overlay RL (6 → 15) et les présenter dans la page
Nouveautés du Hub avec un **mini-aperçu overlay par thème** (pas une simple pastille).

Thèmes choisis (galerie de 12 candidats → 9 retenus) :
Aurora, Sunset, Vapor, Royal Gold, Toxic, Ember, Forest, Coral, Indigo.

## Composants touchés

### 1. `themes.css` — 9 blocs `body.t6`…`body.t14`
Chaque bloc fournit l'**union complète** des tokens, comme les thèmes 0–5 :
`--bg --card --line --txt --muted --dim --aA --aB --good --loss --hot --hot2`
+ alias `--accent:=aA  --accent2:=aB  --title:=txt`
+ `--bg1 --bg2` (fonds translucides des cartes f0–f4, dérivés du bg du thème,
alpha ~0.62 / ~0.66, teinte = base sombre du thème).

Palettes (aA → aB ; reste cohérent avec la galerie validée) :

| t  | nom        | bg       | card     | line     | txt      | aA      | aB      |
|----|------------|----------|----------|----------|----------|---------|---------|
| 6  | Aurora     | #06100e  | #0a1714  | #163029  | #e9fff7  | #2ee6a6 | #5bd0ff |
| 7  | Sunset     | #120a0c  | #1b0f12  | #33181f  | #ffeef0  | #ff7a3d | #ff4d8d |
| 8  | Vapor      | #0c0a16  | #120f22  | #251f3f  | #f3eaff  | #ff8ad6 | #62e6ff |
| 9  | Royal Gold | #070a14  | #0c1020  | #1e2740  | #fff7e6  | #ffce5c | #e0a020 |
| 10 | Toxic      | #0a0c08  | #0f1310  | #222a1c  | #f0ffe6  | #c6ff3d | #9a5bff |
| 11 | Ember      | #0d0908  | #160d0a  | #2c1a14  | #fff0ea  | #ff5a2e | #ffaa3d |
| 12 | Forest     | #070d09  | #0c1510  | #1a2c1f  | #eafff0  | #3de08a | #a8d84a |
| 13 | Coral      | #120c0a  | #1b110d  | #33201a  | #fff0ea  | #ff6f61 | #ffb48a |
| 14 | Indigo     | #08081a  | #0d0d24  | #1f1f44  | #eeeaff  | #6d6bff | #b86bff |

(muted/dim/good/loss/hot/hot2 par thème = valeurs de la galerie validée
`scratchpad/theme-gallery.html`, source de vérité des couleurs.)

### 2. `main.js` — `THEME_COUNT = 15`
Seul changement. Le cycle Ctrl+Alt+T et le modulo Hub/overlay suivent automatiquement.

### 3. `patchnotes.js` + renderer `#news` (hub.html) — aperçus par thème
- Nouvelle entrée en tête de `PATCH_NOTES` (version = celle de la prochaine release)
  avec un champ **`themePreviews`** : `[{ name, t:{bg,card,line,txt,muted,dim,aA,aB,good,loss,hot,hot2} }]`
  pour les 9 nouveaux thèmes.
- Le renderer `renderNews()` (hub.html) apprend à rendre `themePreviews` : pour
  chaque thème, une **mini-carte overlay** (tier/MMR/delta/streak/barre boost)
  avec les tokens du thème posés en `style` inline local (même structure que la
  galerie). Le champ `themes` (pastilles) reste supporté pour les anciennes entrées.
- CSS de la mini-carte ajouté au `<style>` de hub.html (préfixe `.tp-`), scoping
  par variables inline pour ne pas polluer le thème du Hub.

### 4. `index.html` — glow ambiant pulsé sur le MMR (toutes les formes)
Toutes les formes (f0–f4, layout-wing, f-marquee, f5) utilisent la classe `.mmr`
(seule la taille/couleur est surchargée par forme). Une seule animation suffit.
- `@keyframes mmr-glow` : pulse le `text-shadow` accent entre ~8px/40% et ~18px/80%.
- `.mmr { animation: mmr-glow 2.4s ease-in-out infinite; }` (le `text-shadow`
  statique actuel reste comme état de repos).
- Respecte `@media (prefers-reduced-motion: reduce)` : `animation: none` sur `.mmr`
  (le glow fixe demeure), cohérent avec le bloc reduced-motion existant du marquee.
- Couleur = `var(--accent)` → suit automatiquement le thème (dont les 9 nouveaux).

## Hors-scope (YAGNI)
- Pas de flash/pop réactif au changement de MMR (choix : glow ambiant seul).
- Pas de noms de thèmes affichés dans l'overlay en jeu (juste l'index, comme aujourd'hui).
- Pas de sélecteur de thème cliquable dans le Hub (le cycle clavier suffit).
- Pas de suppression des 6 thèmes existants.

## Vérification
1. `node --check` sur les fichiers JS.
2. Lint visuel : parser themes.css, vérifier 15 sélecteurs de thème (`:root` + t1..t14).
3. Screenshot headless de la page Nouveautés (réutilise `scratchpad/hubshot.js`,
   VM avec `_showNews`) → confirmer le rendu des 9 mini-aperçus.

## Release
Suivre le workflow habituel : entrée patchnotes (ce design) → bump → tag → gh release.
Auto-update hors-jeu (v1.1.5) propagera aux clients.
