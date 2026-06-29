# Design / Roadmap — Big update + Freemium (gratuit limité / premium par clé)

Date : 2026-06-29 (rédigé en mode auto, utilisateur absent — à valider au réveil)
Statut : design + impl du **terrain gratuit**. Décision utilisateur : "fais comme si tout
est gratuit, prépare le terrain pour le payant". Donc on construit `entitlement.js`
(`isPremium()` → true partout) + nouveaux réglages, SANS paywall ni clé. Le payant (§5/§6)
reste à décider/brancher plus tard.

## 0. Pourquoi pas implémenté tout de suite
- **Repo public + app Electron (JS en clair)** : une clé d'activation validée *en local*
  est triviale à contourner (lire/patcher le code, partager des clés, supprimer le check).
  Un paywall crédible exige au minimum l'UN de :
  1. **Validation serveur** (clé vérifiée côté backend que tu contrôles), et/ou
  2. **Repo privé / build obfusqué** (plus de code source public à patcher).
- C'est une décision argent + irréversible vis-à-vis des users (auto-update public). Donc
  on valide §6 d'abord.

## 1. État actuel (rappel)
Gratuit aujourd'hui (v1.1.11) : 15 thèmes, 9 formes, glow MMR, Hub dashboard, page Réglages
(toggles glow/musique), MMR "live" via log RL, auto-playlist, patch notes, auto-update.
Données : tracker.gg (poll) + log RL (read-only). Config dans `%APPDATA%\rl-overlay`.

## 2. Sous-projets (à livrer dans cet ordre)
1. **Infra réglages + nouveaux réglages gratuits** (sûr, réversible) — détaillé §3.
2. **Features premium** (la vraie valeur payante) — §4.
3. **Tiering + licence/activation** (sensible) — §5/§6.
Chaque sous-projet aura son propre spec → plan → impl.

## 3. Sous-projet 1 — Réglages (page Réglages enrichie)
Tout pilotable depuis le Hub (⚙), persisté dans `config.overlay`, poussé en direct au
renderer (même canal que mmrGlow/showMusic actuels).

Réglages d'affichage :
- **Taille** de l'overlay (slider 70-150 %).
- **Opacité** (50-100 %).
- **Position** : mode "placement" (glisser) en plus des flèches ; bouton recentrer.
- **Toggles par élément** : rang, peak, streak, W-L, boost, défi du jour, momentum-10, musique (déjà).
- **Halo MMR** (déjà) + intensité.
- **Clic-traversant** on/off (déjà en config, exposer).
- **Police** (2-3 choix) + **taille du MMR**.
- **Langue** FR/EN (i18n).
- **Lancer au démarrage de Windows** (toggle ; déjà forcé, rendre optionnel).
- **Fréquence de refresh** (déjà Ctrl+Alt+S, exposer slider).
- **Remap des raccourcis** (avancé).

Archi : généraliser le mécanisme `set-overlay-flag` actuel en `set-setting(key,value)`
typé (bool/int/enum), + un schéma de réglages (clé, type, défaut, gratuit/premium) qui
génère la page Réglages automatiquement. Évite d'empiler les handlers à la main.

## 4. Sous-projet 2 — Features premium (valeur payante)
Candidats (à prioriser avec toi) :
- **Éditeur de thème** : couleurs accent perso, sauvegarde de thèmes custom.
- **Historique des matchs** (SQLite local) + **graphes** (MMR dans le temps, win-rate par
  jour/semaine, heatmap des sessions).
- **Mode Stream / source OBS** : page `localhost` rendue par l'app à ajouter comme
  Browser Source dans OBS (overlay propre pour le stream, séparé de l'in-game).
- **Objectifs MMR** custom + suivi.
- **Sons/célébrations** personnalisables (victoire, montée de rang).
- **Profils multiples** (plusieurs comptes/pseudos).
- **Sync cloud** de la config (nécessite backend — lié §6).
- **Sans watermark** (le gratuit affiche un petit "RL Overlay — Free").

## 5. Tiering gratuit / premium (proposition de split)
- **Gratuit (limité, donne envie)** : 3 thèmes (Octane/Cryo/Crimson), 2 formes, dashboard
  de base, MMR live, auto-playlist, **petit watermark**. Réglages d'affichage de base.
- **Premium (clé)** : 15 thèmes + éditeur, 9 formes, historique+graphes, mode OBS, objectifs,
  sons custom, profils multiples, sync, **sans watermark**, tous les réglages.
- Gating technique : chaque thème/forme/feature porte un flag `premium:true` ; un module
  `entitlement.js` central répond `isPremium()` ; l'UI grise + cadenas les items premium en
  gratuit, avec un CTA "Débloquer".

## 6. Licence / activation — DÉCISIONS REQUISES (toi)
Options (du + simple au + robuste) :
- **A. Clé offline signée** : tu génères des clés signées (clé privée chez toi), l'app valide
  avec la clé publique embarquée. Simple, marche hors-ligne. **Contournable** par patch du
  binaire (surtout si repo public). OK pour modèle "honnête/donation".
- **B. Validation via SaaS** (Lemon Squeezy / Gumroad license API) : la clé est émise à
  l'achat et validée en ligne (activation par appareil, révocation possible). Recommandé.
  Gère le paiement pour toi.
- **C. B + repo privé / build obfusqué** : enlève le contournement trivial "lire le code".
  Le plus crédible. Note : l'auto-update actuel télécharge le zip depuis une **release
  GitHub publique sans auth** — passer privé impose de revoir la distribution (releases
  publiques d'un repo privé, ou serveur de download).

**Ce que TOI seul peux décider :**
1. Provider de paiement + prix (Lemon Squeezy ? Gumroad ? Stripe ?).
2. Split exact gratuit/premium (§5 à ajuster).
3. Online (B/C) vs offline (A) ?
4. Passer le repo en **privé / closed-source** ? (impacte l'auto-update public actuel.)
5. As-tu un **serveur / nom de domaine** ? (requis pour B/C custom.)

Reco : **B (Lemon Squeezy)** pour démarrer (paiement + clés gérés, validation en ligne,
activation par machine), repo gardé public au début (accepter que le gating soit léger),
puis **C** (privé + obfusqué) si ça décolle.

## 7. Étapes concrètes (quand décisions prises)
1. Impl sous-projet 1 (réglages) — gratuit, sans risque, livrable seul.
2. Impl features premium derrière un `entitlement.js` qui renvoie `true` (dev) — features
   construites et testables sans encore de paywall.
3. Brancher la licence (option choisie) ; basculer `entitlement.isPremium()` sur la vraie
   validation ; ajouter watermark gratuit + écrans "Débloquer".
4. Release + page d'achat.

## 8. Hors-scope ce soir
Tout code. Surtout : aucun paywall, aucune clé, aucune release de monétisation sans ton
"go" sur §6. On ne ship pas de l'argent en aveugle sur un repo public.

## 9. Catalogue d'idées big update (réflexion auto — à trier au réveil)
Priorité : ⭐ = quick win sûr, 🔶 = moyen, 🔴 = gros/risqué. (F)=gratuit (P)=premium futur.

### 9.1 Affichage / réglages (la plupart ⭐, gratuits)
- ⭐(F) Taille overlay (slider) + opacité — `transform: scale`, `opacity` sur le stage.
- ⭐(F) Toggles par élément : rang, peak, streak, W-L, boost, défi, momentum, musique.
- ⭐(F) Recentrer / verrouiller la position ; mode glisser-déposer.
- ⭐(F) Choix de police + taille du MMR.
- 🔶(F) i18n FR/EN (les libellés sont en dur dans index/hub ; extraire un dict).
- ⭐(F) Toggle "lancer au démarrage Windows" (déjà forcé) + toggle clic-traversant.
- 🔶(F) Remap des raccourcis (table clavier dans Réglages).
- ⭐(F) Profil d'affichage "compact/détaillé" rapide.

### 9.2 Données / stats (mix F/P)
- 🔶(P) Historique des matchs en SQLite local (date, playlist, MMR avant/après, résultat).
- 🔶(P) Graphes : courbe MMR, win-rate par jour/semaine, heatmap d'activité.
- ⭐(F) Streak du jour, meilleur/pire écart de session (on a déjà des heuristiques).
- 🔶(F) Détection de "tilt" déjà présente -> l'exposer + conseils.
- 🔴(P) Stats adverses lobby (MMR interne du log) — approximatif, à étudier.

### 9.3 Stream / créateurs (P, fort argument payant)
- 🔴(P) Mode source OBS : page localhost servie par l'app, propre pour le navigateur OBS,
  thèmable, séparée de l'overlay in-game. Gros différenciateur vs concurrents.
- 🔶(P) Alertes stream (montée de rang, win-streak) en surimpression.
- 🔶(P) "Just chatting" card : rang + objectif du jour pour l'écran de pause.

### 9.4 Personnalisation (mix)
- 🔶(P) Éditeur de thème : couleurs accent perso + sauvegarde (on a déjà 15 thèmes en tokens).
- 🔶(P) Sons/celebrations custom (on a déjà des sons + anims victoire).
- ⭐(F) Choix de l'emoji streak / format d'affichage MMR.

### 9.5 Confort / robustesse (⭐, gratuit)
- ⭐(F) Auto-détection du chemin log si Documents redirigé (OneDrive) — fallback à coder.
- ⭐(F) Écran "santé" : état tracker, état log RL, version, dossier config (debug user).
- ⭐(F) Bouton "forcer une vérif de mise à jour" + "ouvrir le dossier de logs".
- 🔶(F) Export/import de la config (fichier).

### 9.6 Terrain payant (préparé, non branché)
- ✅ `entitlement.js` central (fait, isPremium=true). Tags FREE_THEMES/FREE_LAYOUTS.
- À venir (sur décision §6) : watermark gratuit, écrans cadenas/CTA, validation de clé.

### 9.7 Ordre conseillé pour "la big update de demain"
1. Batch réglages ⭐ (9.1) — gros impact perçu, zéro risque, gratuit.
2. Écran "santé"/debug (9.5) — réduit le SAV (cf. galères update d'illan).
3. Historique + graphes (9.2) — base de la valeur premium future (construits gratuits).
4. Mode OBS (9.3) — le vrai argument payant, à faire quand le reste est stable.

## Risques / notes
- Auto-update public = toute release est poussée à tes users ; un paywall cassé/mal testé
  impacterait tout le monde → tester hors-ligne + en jeu avant.
- Légal : CGV/remboursement basiques nécessaires pour vendre (le provider en fournit).
- Le "MMR live" reste plafonné par le délai tracker.gg (cf. spec live-log) ; pas un argument
  de vente sur la fraîcheur exacte du chiffre.
