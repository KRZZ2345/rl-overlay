# Design — Éditeur de thèmes custom (simple)

Date : 2026-06-29
Statut : à implémenter

## But
Permettre de créer ses propres thèmes : choisir 4 couleurs (accent A, accent B, fond,
texte), dériver automatiquement le reste des tokens, prévisualiser en live, sauvegarder,
appliquer. Marche sur overlay in-game + Hub + OBS (mêmes tokens).

## Tokens & dérivation
Tokens cibles (identiques aux 15 thèmes) : `--bg --card --line --txt --muted --dim --aA
--aB --good --loss --hot --hot2` + alias `--accent:=aA --accent2:=aB --title:=txt` +
`--bg1 --bg2` (fonds translucides). Entrées éditeur : `aA, aB, bg, txt`. Dérivation
(`lib/themegen.js`, pur + testable, utils hex/mix/rgba) :
- card = mix(bg, txt, 6%) ; line = mix(bg, txt, 16%)
- muted = mix(txt, bg, 45%) ; dim = mix(txt, bg, 65%)
- hot = aA ; hot2 = aB ; accent=aA ; accent2=aB ; title=txt
- good = #46d39a, loss = #ff5d6c (fixes : W/L toujours lisibles)
- bg1 = rgba(card, .62) ; bg2 = rgba(bg, .66)

`themegen.js` en UMD léger (CommonJS pour main + `window.themegen` pour le Hub via
`<script src>`), pour dériver côté Hub (aperçu live) ET côté main (tokens appliqués).

## Stockage & sélection
- `config.overlay.customThemes = [{ name, aA, aB, bg, txt }]` (on regénère les tokens à la
  volée via themegen, pas de duplication).
- **Sélection** : on étend l'index thème. `theme` 0..14 = built-in ; `15..15+N-1` =
  `customThemes[i-15]`. `cycleTheme` : total = THEME_COUNT + customThemes.length.
- **Application** :
  - built-in (index < THEME_COUNT) → push `{ theme: index }` → classe `body.tN`.
  - custom → push `{ themeVars: <tokens dérivés> }` → vars inline sur `body` + on retire la
    classe `tN`. (Et inversement on retire les vars inline quand on repasse built-in.)
- Renderers (index.html, hub.html, obs via /state) : `applyThemeVars(vars)` (inline) /
  `applyTheme(idx)` (classe) — l'un nettoie l'autre.

## Éditeur (Hub, bouton 🎨)
Surcouche `#theme-editor` : 4 color inputs (Accent A/B, Fond, Texte) + champ Nom +
**aperçu live** (mini-overlay : tier/MMR/streak/barre teintés via les tokens dérivés) +
boutons **Enregistrer** (ajoute à customThemes + applique), **Appliquer**, **Supprimer**
(pour un custom existant), liste des customs existants (charger pour éditer).
IPC : `save-custom-theme(theme)`, `delete-custom-theme(name)`, `apply-theme(indexOrName)`.

## Erreurs / bords
- Couleurs invalides → garde-fou (regex hex), défaut si parse échoue.
- Suppression du custom actif → repli sur thème 0.
- Cap customThemes (ex. 20).

## Vérification
1. `lib/themegen.js` tests (dérivation déterministe, hex/mix/rgba, good/loss fixes).
2. DOM headless : éditeur ouvre, aperçu reflète les pickers ; appliquer un custom → vars
   inline posées.
3. Manuel : créer un thème, l'appliquer, cycler Ctrl+Alt+T (built-ins + custom), OBS suit.

## Hors-scope
- Mode avancé (12 tokens). Partage/import de thèmes. (Plus tard.)
