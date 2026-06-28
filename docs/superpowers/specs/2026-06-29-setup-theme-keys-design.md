# RL Overlay — Design / Spec : Setup en 2 étapes (thème + aperçu) + page touches

Date : 2026-06-29
Statut : validé en brainstorming, prêt pour plan d'implémentation.

## 0. Objectif

Au premier lancement : après le pseudo, l'utilisateur **choisit son thème** sur un 2e écran de setup **avec aperçu live** d'un panneau Premium qui se recolore. Une fois validé, le Hub (dashboard) s'ouvre avec une **page des touches** thémée, claire et minimaliste, par-dessus le dashboard. Ensuite la page touches reste accessible via un bouton **?**.

## 1. Décisions (brainstorming)

- Setup = **assistant 2 étapes**, même fenêtre (`setup.html`).
- Étape 2 = **grille des 6 thèmes** (Octane/Cryo/Synthwave/Mono/Acid/Crimson) + **aperçu live du panneau Premium** recoloré selon le thème survolé/sélectionné, directement dans le setup.
- Page touches = **surcouche dans le Hub** (`hub.html`), par-dessus le dashboard, **thémée** (tokens du thème courant), **minimaliste** (touches debug cachées).
- Affichage page touches : **auto au 1er lancement** après config, puis **bouton ?** dans le Hub pour la rouvrir.
- 1er lancement ouvre le **Hub** (fenêtre dashboard, indépendante de RL) — pas besoin de forcer le HUD in-game.

## 2. Étape 2 du setup — choix thème + aperçu (`setup.html`)

- `setup.html` lie **`themes.css`** + **`theme-v2.css`** (pour rendre un vrai panneau `.f5` Premium).
- Structure : 2 « écrans » dans la même page (toggle CSS `.step-active`).
  - **Écran 1** (existant) : plateforme + pseudo. Bouton **Suivant** (remplace « Démarrer »), activé quand pseudo non vide.
  - **Écran 2** : 
    - Grille de **6 swatches** (nom + pastilles de couleurs `--aA/--aB/--good/--loss`).
    - **Aperçu** : un panneau `.f5` Premium statique (données d'exemple figées : MMR 1024, ▲+42, Diamond II, momentum, boost, streak) dans un conteneur dont la classe `t0..t5` change au clic/survol d'un swatch → recoloration live (mêmes tokens que l'app).
    - Bouton **Démarrer l'overlay**.
- Sélection par défaut : **Octane** (index 0). Le swatch sélectionné est mis en évidence (bordure accent).
- Au clic Démarrer : `window.setup.save({ platform, username, theme })` (theme = index 0-5).

## 3. IPC + flux (`setup-preload.js`, `main.js`)

- `setup-preload.js` : `save` inchangé (passe l'objet tel quel ; `theme` ajouté au payload).
- `save-setup` (main.js) : lit `data.theme` (clamp `0..THEME_COUNT-1`, défaut 0), écrit `cfg.overlay.theme`.
- **Déclenchement 1er lancement** : dans `save-setup`, si `!overlayStarted` (= tout premier setup) **et** `!cfg.overlay.tutoSeen` :
  1. `startOverlay()`
  2. `openHub()`
  3. signaler au Hub d'afficher la page touches (one-shot, via le push : `_showKeys: true`)
  4. `cfg.overlay.tutoSeen = true; saveConfig(cfg)` (auto-affichage une seule fois)
  - Reconfiguration (`Ctrl+Alt+P`, overlay déjà démarré) : pas de ré-ouverture auto.
  - **IMPORTANT : ne JAMAIS forcer le HUD in-game visible.** `startOverlay()` ne change pas la visibilité (le HUD reste caché tant que RocketLeague n'est pas au premier plan). Aucun appel à `forceShow`/`setOverlayVisible(true)` au 1er lancement. Seul le **Hub** (fenêtre dashboard) s'affiche.
- `pushHub()` inclut déjà `_theme` (fait précédemment) ; ajoute `_showKeys` seulement sur le push one-shot du 1er lancement.

## 4. Page touches (`hub.html`)

- Surcouche `#keys` (position absolue, couvre le Hub), masquée par défaut, affichée via classe `body.show-keys`.
- **Thémée** : utilise les tokens courants (themes.css déjà lié au Hub). Cartes/cellules sur fond `var(--card)`/`var(--line)`, chips de touche en `var(--aA)`.
- **Contenu** (groupes, libellés FR clairs) :
  - **Affichage** : `Ctrl+Alt+H` Montrer / cacher l'overlay · `Ctrl+Alt+Flèches` Déplacer
  - **Apparence** : `Ctrl+Alt+F` Changer de forme · `Ctrl+Alt+T` Changer de thème
  - **Stats** : `Ctrl+Alt+1/2/3` Playlist (1v1/2v2/3v3) · `Ctrl+Alt+R` Réinitialiser la session · `Ctrl+Alt+Espace` Ouvrir/fermer ce tableau de bord
  - **Réglages** : `Ctrl+Alt+S` Fréquence de rafraîchissement · `Ctrl+Alt+D` Présence Discord · `Ctrl+Alt+P` Reconfigurer le pseudo
  - Touches debug (`W`/`G`/`E`) **non listées** (minimalisme).
- **Bouton ?** : petite pastille en coin du Hub (`#keys-toggle`) → bascule `body.show-keys`.
- **Échap** : si page touches ouverte → la ferme (ne ferme pas le Hub) ; sinon comportement existant (ferme le Hub). Clic sur le fond de la surcouche → ferme aussi.

## 5. Hors périmètre (YAGNI)

- Pas de rebind des touches (affichage seul).
- Pas d'aperçu live des thèmes dans le Hub (l'aperçu vit dans le setup ; le Hub applique juste le thème).
- Pas de réorganisation du dashboard.
- Pas de persistance d'un « thème survolé » : seul le clic sélectionne.

## 6. Tests

- Aucune logique pure nouvelle dans `lib/` → suite `node:test` inchangée (doit rester verte).
- Vérification **manuelle (GUI)** :
  - 1er lancement (config absente) : setup 2 écrans, aperçu recolore, Démarrer → Hub + page touches visibles.
  - `tutoSeen` posé → relance n'ouvre plus la page touches d'office.
  - Bouton ? ouvre/ferme ; Échap ferme la page touches puis (2e appui) le Hub.
  - Le thème choisi s'applique au HUD, à Premium et au Hub.
