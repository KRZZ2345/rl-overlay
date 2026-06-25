# RL Overlay V2 — Design / Spec : Hub plein écran (Plan 3)

Date : 2026-06-25
Statut : validé en brainstorming, prêt pour plan d'implémentation (Plan 3).

Addendum de clôture aux specs `2026-06-24-rl-overlay-v2-design.md` (features Hub : §7 layout, §8 composants) et `2026-06-25-rl-overlay-v2-rendering-design.md` (câblage fenêtre, contrat view-model §3, skin partagé). Ce document fige les **décisions ouvertes** restantes pour rendre Plan 3 implémentable. Il ne réécrit pas les features ni le câblage déjà figés.

État en entrée : Plan 1 (couche data `lib/`) et Plan 2 (HUD `f5` Premium) livrés. Le Hub n'existe pas encore.

## 1. Périmètre Plan 3 : spec §7 intégral

Le premier livrable du Hub couvre **toute la structure A "Profil vivant"** (spec V2 §7) : héros, pouls de session, journey + insights, et **tous** les widgets (Daily Challenge, Consistency, Boost/Session Heat, Objectif, Tilt Detector masqué tant que non déclenché). La couche data porte déjà toutes les métriques nécessaires, donc aucun blocage technique à tout afficher d'un coup.

## 2. Données — view-model étendu, source unique

Constat : `lib/viewmodel.js` `buildHudViewModel` ne compose aujourd'hui que le **sous-ensemble HUD** (`deltaSession`, `promotion`, `momentum`, `boost`, `hot`, `streak`, `timeMs`). Le contrat complet du rendering design §3 (`records`, `insights`, `heuristics`, `session`, `rank`) n'est pas encore branché.

Décision :

- **Renommer/étendre `buildHudViewModel` → `buildViewModel`** produisant le **contrat §3 complet**. Le rename est assumé : il touche `main.js` (import + appel) et n'altère pas le rendu du HUD `f5` (qui pioche le même sous-ensemble). C'est la vraie source unique voulue par le rendering design §3 — pas de fonction parallèle, pas de divergence.
- Champs ajoutés au view-model, composés depuis les modules `lib/` déjà présents :
  - `records` : `{ peak, gap, daysSince }` via `lib/history-store` (Records).
  - `insights` : `[{ icon, text }]` via `lib/insights`.
  - `heuristics` : `{ confidence, consistency, tilt:{ tilted, reason } }` via `lib/heuristics`.
  - `daily` : défi du jour + progression (cf. §4).
  - `goals` : objectifs + progression (cf. §5).
- **Coût** : composé à chaque poll (15 s, RL au focus). Fonctions pures sur ≤500 events → négligeable. Aucun calcul côté renderer (rendering design §3 inchangé).
- HUD `f5` consomme son sous-ensemble glanceable (inchangé). Hub consomme tout.

## 3. Fenêtre Hub — câblage (rappel rendering design §2, confirmé)

- Nouveau `BrowserWindow` **focusable** (pas click-through, pas always-on-top imposé) chargeant **`hub.html`**.
- **Cycle de vie lazy** : créé au toggle d'ouverture, **détruit à la fermeture** → footprint RAM nul en plein match.
- Toggle = **`Ctrl+Alt+Space`** (raccourci global). Fermeture : re-presser `Ctrl+Alt+Space` **ou `Échap`** quand le Hub a le focus.
- À l'ouverture → **push immédiat du dernier view-model connu** (jamais d'écran vide en attendant le prochain poll). Polls suivants mettent à jour HUD et/ou Hub si ouverts.

## 4. Interaction — lecture seule

Le Hub est un **tableau de bord pur** : il peint le view-model poussé, **aucun input**. Pas d'IPC retour renderer→main, le flux one-way du rendering design §3 reste intact. L'édition d'objectifs en-Hub est reportée (piste V3).

## 5. Daily Challenge — `lib/daily.js` (pur)

- **1 défi par jour, auto-généré, seed = date** (ex. `YYYY-MM-DD` → index déterministe dans un pool de templates). Rotation reproductible : même jour = même défi, change chaque jour.
- Pool de templates (ex.) : `+15 MMR aujourd'hui`, `3 wins`, `WR > 50% sur la session`, `pas de tilt aujourd'hui`. Chaque template porte sa cible et sa façon de calculer la progression depuis `session` + store.
- Renvoie `{ id, label, target, progress, done }`. Calcul **pur** (entrées : date, session, events), aucune I/O.
- Pas de config : objectif de dopamine d'habitude, surprise quotidienne.

## 6. Objectifs — `lib/goals.js` (pur)

- **Set par défaut codé** (ex.) : `Atteindre Diamond`, `Winrate 60%`, `+100 MMR / semaine`, `10 wins / jour`.
- **Override via `config.json`** (champ `goals: [...]`) — lecture seule, l'utilisateur édite le fichier, aucun éditeur en-Hub.
- Progression **auto-calculée** depuis le store (peak/MMR courant, snapshots 14 j, event log, session du jour) selon le type d'objectif.
- Renvoie `[{ label, target, progress, pct, done }]`. Pur.

## 7. Layout `hub.html` — spec §7 intégral

- Structure A "Profil vivant" : héros (pleine largeur, dominant) >> bande pouls de session > bande journey + insights > rangée widgets. Tailles : héros écrase visuellement le reste (spec V2 §7-§8).
- **Ranked Journey** réutilise l'ordre des rangs `TIERS` de `main.js` (Bronze I → Supersonic Legend), regroupé par tier (Bronze · Argent · Or · Platine · Diamant · Champion · GC · SSL) avec segment rempli jusqu'au rang courant + marqueur (pin orange).
- **Tilt Detector** = bandeau d'alerte affiché **seulement** si `heuristics.tilt.tilted` ; masqué sinon.
- Skin : inclut **`theme-v2.css`** (même source de vérité que le HUD). État chaud = classe **`body.hot`** pilotée par `hot`. Animations CSS pures (rendering design §4, spec V2 §9).
- Renderer = bête d'affichage : `require('./lib/...')` interdit dans `hub.html`. Il ne fait que peindre le view-model reçu par IPC.

## 8. Découpage (rappel)

- **Plan 3 — Hub** : extension du view-model (`buildViewModel`) + `lib/daily.js` + `lib/goals.js` + `hub.html` + `BrowserWindow` lazy + raccourci `Ctrl+Alt+Space`/Échap + push à l'ouverture. Réutilise `theme-v2.css`. Vérifiable via le skill de run (ouverture du Hub, rendu, fermeture).
- Pas de Plan 4 : le périmètre §7 intégral est dans Plan 3.

## 9. Hors périmètre (rappel + nouveau)

- Inchangé vs spec V2 §10 : pas de Clutch Index ni de métrique par-match, pas de backfill, historique = playlist sélectionnée seule.
- **Édition d'objectifs en-Hub** (IPC retour) → reportée V3.
- Pistes V3 (spec V2 §11 : recap partageable, mode OBS, ghost/rival, sound design, saison narrative, coaching horaires) restent hors V2.
