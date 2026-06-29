---
name: patch-notes
description: Génère/met à jour les notes de version (patch notes) de l'overlay RL affichées dans le Hub. Ajoute une entrée en tête de `patchnotes.js` à partir des changements depuis la dernière release. Utiliser pour "génère les patch notes", "écris les nouveautés", "mets à jour patchnotes", "note de version", avant une release. Mots-clés : "patch notes", "nouveautés", "changelog", "note de version".
---

# Patch notes

Maintient `patchnotes.js` à la racine — la source unique de la page **Nouveautés** du Hub.
La page s'ouvre automatiquement au **1er lancement après un update** (main.js compare
`overlay.lastSeenVersion` à `app.getVersion()`) et manuellement via le bouton 🎁 du Hub.

## Quand l'utiliser

- **Avant une release** (cf. [[release-github]]) : ajouter l'entrée de la nouvelle version
  AVANT de bumper/taguer, pour que le zip publié contienne ses propres notes.
- Quand l'utilisateur demande d'écrire/mettre à jour les nouveautés.

## Procédure

1. **Déterminer la version cible.** Lire `package.json` → `version`. Si on prépare une
   release avec bump, utiliser la version qui SERA publiée (ex. patch `1.1.0` → `1.1.1`).
2. **Collecter les changements** depuis la dernière entrée de `patchnotes.js` :
   ```bash
   git log --oneline "v$(node -p "require('./patchnotes.js')||0" 2>/dev/null)"..HEAD
   ```
   En pratique : `git log --oneline <dernier-tag>..HEAD` (le dernier tag = version en tête
   de `patchnotes.js`). Lire les commits `feat:`/`fix:` et résumer en langage JOUEUR
   (pas de jargon technique : "9 formes d'overlay", pas "refactor du layout engine").
3. **Rédiger l'entrée** et la **prépendre** (index 0) à `window.PATCH_NOTES` :
   ```js
   {
     version: 'X.Y.Z',          // == package.json à la release
     date: 'YYYY-MM-DD',        // date du jour
     title: 'Titre court',      // thème de la version
     items: [
       { icon: '🎨', text: 'Phrase courte, orientée joueur, ce qui change pour lui.' },
       // 3 à 7 items. Icône emoji par item.
     ],
     themes: [],                // option : [{ name, a, b }] pastilles dégradé (couleurs hex)
     images: [],                // option : ['img/xxx.png'] captures, copiées dans img/
   }
   ```
4. **Vérifier le rendu** : `node --check patchnotes.js`. Idéalement lancer le Hub
   (Ctrl+Alt+Espace en jeu, ou via le skill [[run-rl-overlay]]) et cliquer 🎁.

## Conventions

- **Plus récent en premier** (index 0 = version courante).
- **`version` doit matcher `package.json`** au moment de la release — sinon la détection
  post-update affiche la mauvaise entrée ou rien.
- **Ton joueur, pas dev** : décrire le bénéfice visible, pas l'implémentation.
- **Icône par item** : un emoji cohérent (🎨 thème, 🔷 forme, 📊 stats, ⌨️ touches, 🔄 update, 🐛 fix).
- **Images** : poser les `.png` dans `img/` et référencer `img/nom.png`. Sans image, laisser `[]`.
- **Pastilles thèmes** (`themes`) : `a`/`b` = tokens `--aA`/`--aB` du thème dans `themes.css`.

## Gotchas

- Ne PAS confondre avec `tutoSeen` (1er install → page touches). La page Nouveautés est
  pilotée par `lastSeenVersion` (1er lancement après update).
- `patchnotes.js` est chargé par `hub.html` via `<script src>` et expose `window.PATCH_NOTES`.
  C'est un fichier navigateur : pas de `require`/`module.exports`.
- Le zip de release doit inclure `patchnotes.js` (il est à la racine, déjà embarqué par
  `build-run.ps1` qui package tout le dossier).
