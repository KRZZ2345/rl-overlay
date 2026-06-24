# RL Overlay V2 — Design / Spec

Date : 2026-06-24
Statut : validé en brainstorming, prêt pour plan d'implémentation.

## 1. Vision

Transformer le tracker de stats actuel en **compagnon compétitif vivant** : un HUD in-game minimal et glanceable qui s'embrase sur les moments forts, doublé d'un **hub plein écran** (touche dédiée) qui raconte la progression et donne une raison de relancer Rocket League chaque jour.

Références d'ambition : Blitz, Faceit, Valorant Tracker — mais adaptées à la contrainte "overlay in-game" (footprint, lisibilité en match).

## 2. Forme produit : double densité

- **HUD in-game** : carte compacte, click-through, always-on-top, visible uniquement quand RL a le focus (comportement actuel conservé). Affiche l'essentiel glanceable.
- **Hub plein écran** : fenêtre focusable ouverte par une touche dédiée (toggle). Densité max : journey, insights, objectifs, tous les widgets. Même skin.

Une seule app, deux surfaces. Le HUD reste prioritaire sur la lisibilité en match ; le hub absorbe la richesse.

**Trigger hub (hypothèse, configurable)** : raccourci global `Alt+R` en toggle (réutilise `globalShortcut` déjà présent). Pensé pour être pressé en menu / replay / fin de match, pas en plein jeu.

## 3. Contrainte data — le plafond (à respecter absolument)

`tracker.js` ne fournit qu'un **snapshot** par poll (15s, en jeu uniquement) : MMR courant, tier, division, winStreak signé (réel API), buts/arrêts **à vie**. Pas d'historique par match, pas de peak, pas de delta côté API.

**Conséquences actées :**

- W/L, momentum, streak, session = **inférés des changements de MMR entre polls**. Fiable au niveau match (2 matchs ne peuvent pas finir dans une même fenêtre de 15s, un match dure 5-7 min).
- Pas de données **par match** isolées (buts/arrêts d'un match précis) → **Clutch Index abandonné**, aucun proxy bidon.
- Aucun backfill : peak / tendances / moyennes se construisent **à partir de l'installation**.
- Périmètre historique = **playlist sélectionnée uniquement** (config). Simple, focalisé.

Conclusion : la V2 ne nécessite **aucune nouvelle source de données**. Elle nécessite (a) que l'overlay devienne son **propre enregistreur de série temporelle** et (b) une refonte de la couche visuelle.

## 4. Couche données — store d'historique persistant

Nouveau store persistant (dans `userData`, jamais wipé, jamais commité/packagé — cf. `.gitignore`), distinct de `session.json` (qui reste daily) :

- **Event log** : à chaque changement de MMR détecté sur la playlist suivie →
  `{ ts, playlist, mmrBefore, mmrAfter, delta, win:boolean }`. Rolling, borné (ex. derniers 500 events).
  → alimente Momentum-10, W/L réels, streaks, Consistency, Confidence, Tilt.
- **Snapshots quotidiens** : 1 valeur MMR/jour pour la playlist suivie → tendance 14j, "X au-dessus de ta moyenne".
- **Records** : peak MMR (+ date), plus longue win streak, meilleur +MMR sur une journée. Mis à jour en continu.

Détection d'un "match" = transition de MMR observée entre deux polls (logique déjà présente `main.js:226`), étendue pour écrire dans l'event log au lieu de seulement incrémenter le compteur du jour.

## 5. Skin (tokens validés)

Base **Minimal Premium** (80%) + barre/glow de B + personnalité Octane (C). Aucune agressivité (pas d'angles coupés, pas de néon uniforme).

```
--bg #0a0b0e   --card #0e0f13   --line #191b22
--txt #f4f5f7  --muted #868d9c  --dim #5c6270
Accents froids : --aA #5b8cff → --aB #b489ff  (barre promotion, glow bleu, halo carte)
Gains  --good #3ad29f      Pertes --loss #ff5d6c
Octane --hot #ff9e4d → --hot2 #ffd36b  (RÉSERVÉ aux états "hot")
```

**Règles :**
- Repos = froid/minimal. MMR en chiffre géant poids 300, tabular-nums, letter-spacing négatif. Labels UPPERCASE tracking large. Espace généreux, zéro effet tableau de bord.
- Accent froid bleu→violet : barre de promotion (tête lumineuse + glow), halo discret en tête de carte, lueur douce sur le MMR.
- **Octane orange = signal "tu es chaud"**, jamais sur le neutre. S'embrase ET pulse sur : pill streak, barre Boost/élan, flash du delta, embrasement bas de carte, dots du streak. S'éteint au repos.

## 6. HUD in-game (nouvelle form, complète les f0-f4 existantes)

De haut en bas, dans une carte ~240px :
1. **Rank Shield** (pastille glow) + tier "DIAMOND II" + playlist.
2. **MMR géant** + **delta session** "▲ +42" (italique, orange si streak/gros gain).
3. **Barre promotion** "Vers Diamond III — 2 victoires" (bleu→violet, tête lumineuse).
4. **Momentum-10** : 10 barres fines pleine largeur, vert=win rouge=loss, dernier(s) win(s) du streak rayonnent orange.
5. **Barre Boost/élan** (orange, respire) — visible surtout en état chaud.
6. **Pied** : W/L + temps de session + **pill STREAK** orange pulsante.

Le label de la barre orange = **"⚡ Boost · élan"** (ou "forme" / "dynamique" — à trancher en implémentation, défaut "élan").

## 7. Hub plein écran — structure A "Profil vivant"

Hiérarchie verticale décroissante (la progression est le centre de gravité, le reste gravite) :

- **Héros (pleine largeur, dominant)** : Rank Shield + tier/division | **MMR géant** + delta + pill streak | **Peak Tracker** (peak, écart, jours depuis). Sous le tout : **barre promotion pleine largeur** (% + matchs restants). Léger embrasement orange en fond si état chaud.
- **Bande 2 — pouls de session** : Momentum-10 (+ analyse auto "🔥 En feu / Stable / En difficulté") | bloc Session (temps, W/L, +MMR) + **Confidence Meter** (jauge).
- **Bande 3** : **Ranked Journey** (échelle horizontale Bronze→…→GC avec marqueur de position) | **Smart Insights** (2-3 phrases auto).
- **Bande 4 — widgets** (rangée de cartes égales, secondaires) : Daily Challenge · Consistency Score · Boost/Session Heat · Objectif courant. **Tilt Detector** = bandeau d'alerte qui n'apparaît que si déclenché (sinon masqué).

Tailles : héros >> bande 2 > bande 3 > widgets. Cartes widgets petites et uniformes ; le héros écrase visuellement le reste.

## 8. Composants — détail data & logique

### Progression (core)
- **MMR restant avant promotion / % vers division suivante / matchs estimés** : à partir des seuils MMR de division (constantes RL connues, approximatives) + gain moyen par win (issu de l'event log). "matchs restants" = ceil(MMR_manquant / gain_moyen_win).
- **Peak saison** + **record perso** : depuis le store Records.

### Momentum-10 (core)
10 derniers events de la playlist. Analyse auto par fenêtre :
- ≥7 W → "🔥 En feu / Hot streak"
- 5-6 W → "Stable"
- ≤4 W → "En difficulté"

### Session Tracker (core)
Temps (via `presenceStart` existant), +/- MMR session, W/L, série courante. Reset quotidien (logique `session.json` existante).

### Smart Insights (core)
Phrases générées par règles, priorisées, on affiche les 2-3 plus pertinentes :
- "🔥 Plus haute progression des 14 derniers jours" (si max sur snapshots 14j)
- "⚡ X% de winrate aujourd'hui"
- "📈 Tu joues X MMR au-dessus de ta moyenne" (vs moyenne snapshots)
- "🎯 Promotion probable dans N victoires" (depuis calc promotion)

### Ranked Journey (core)
Échelle Bronze · Argent · Or · Platine · Diamant · Champion · GC avec segment rempli jusqu'au rang courant + marqueur (pin orange). Compact, décoratif + situant.

### Objectifs (core)
Cibles définissables (ex. Atteindre Diamond, WR 60%, +100 MMR/semaine, 10 wins/jour) avec barre de progression auto-calculée depuis le store. Set par défaut + éditable.

### Rank Shield (widget)
Emblème de rang stylisé + pips de division. Identité visuelle (déjà amorcé dans le HUD).

### Peak Tracker (widget)
Peak MMR depuis install, écart actuel au peak, jours depuis le peak. Narratif "reconquête".

### Session Heat / Boost (widget)
La barre élan : intensité = densité de victoires + vélocité MMR sur la session courante.

### Daily Challenge (widget)
Objectif du jour auto-généré (ex. +15 MMR / 3 wins / WR>50%) avec progression. Renouvelé chaque jour → dopamine d'habitude.

### Consistency Score (widget)
Régularité = inverse de la variance des deltas sur les N derniers events. Noté (ex. lettre A+/B/…). Faible variance = stable.

### Confidence Meter (widget — HEURISTIQUE assumée)
Jauge 0-100 = combinaison winrate récent + streak + vélocité MMR. Étiqueté comme ressenti calculé, pas une vérité.

### Tilt Detector (widget — HEURISTIQUE assumée)
Détecte cluster de défaites rapprochées + chute MMR rapide → bandeau doux "pause conseillée". Masqué tant que non déclenché. Valeur bien-être/coaching.

## 9. Animations

- **Au repos** : statique, sobre. Aucune animation sur le neutre.
- **États chauds** : pill streak pulse (~1.8s), barre Boost respire, delta flash, embrasement bas de carte, dots de streak qui rayonnent.
- **Événements** : flash/transition courte à la détection d'un win (gain MMR), montée animée de la barre de promotion, petit "rank-up" cinématique réutilisant le `.rankup` existant (`index.html:561`).
- Performances : animations CSS uniquement, respect du footprint (le HUD tourne pendant le jeu).

## 10. Hors périmètre (acté)

- **Clutch Index** et toute métrique par-match (buts/arrêts d'un match isolé) : impossible avec l'API actuelle.
- Backfill d'historique antérieur à l'installation.
- Suivi multi-playlists dans l'historique (V2 = playlist sélectionnée seule).

## 11. Vision V3 (exploratoire, hors V2)

Pistes pour faire de l'overlay une référence du marché, à instruire plus tard :

- **Recap de session partageable** : carte image générée en fin de session (MMR net, W/L, momentum, meilleur moment) exportable Discord/stream.
- **Mode OBS / streamer** : skin dédié transparent pour capture, sans le hub.
- **ETA d'objectif** : prédiction "à ce rythme, Diamond III dans ~2 jours" depuis la tendance.
- **Ghost / rival** : se mesurer à son soi d'il y a 7/30 jours (depuis les snapshots).
- **Sound design dopamine** : cues audio discrets sur win streak / promotion / rank-up (réutilise `sounds/`).
- **Saison narrative** : récit de la saison (point de départ, peak, comeback) en fin de saison.
- **Coaching insights avancés** : détection d'horaires/sessions où tu performes le mieux (depuis ts des events).

## 12. Hypothèses ouvertes (à confirmer en implémentation)

- Raccourci hub par défaut `Alt+R` (configurable).
- Label barre orange : "élan" par défaut.
- Seuils MMR de division : constantes approximatives RL (à caler).
- Bornes du store (taille event log, rétention snapshots).
