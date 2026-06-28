---
name: tracker-api
description: Travailler sur la récupération MMR via l'API publique tracker.gg (tracker.js). Utiliser pour "le MMR ne remonte pas", "ajoute une playlist", "Cloudflare/403", "change de plateforme", "le scrape échoue", "stats vides". Mots-clés : "tracker.gg", "MMR", "playlist", "Chromium caché", "Cloudflare", "API JSON", "NAME2KEY".
---

# Tracker API (tracker.js)

Récupère le MMR via l'**API JSON publique** de tracker.gg. **Aucune injection, aucune lecture mémoire du jeu** → aucun risque de ban. Charge une fois la page profil publique dans un **Chromium caché** (pose les cookies Cloudflare), puis interroge l'API depuis le contexte de la page (~300 ms).

## Pièces

- `API_BASE` = `https://api.tracker.gg/api/v2/rocket-league/standard/profile`
- `NAME2KEY` : mappe `metadata.name` de l'API → clé interne overlay (ex. `'Ranked Doubles 2v2' → 'ranked-doubles'`).
- `UA` : User-Agent Chrome (cohérence avec le contexte page).
- Exports : `fetchStats`, `closeHidden`.
- Config : `platform` (`epic`/`steam`/...), `username`, `playlist` dans `config.json`.

## Ajouter une playlist

1. Ajouter l'entrée dans `NAME2KEY` (nom exact renvoyé par l'API → clé courte).
2. Brancher la clé côté config/overlay (hotkeys playlist `Ctrl+Alt+1/2/3`).
3. Vérifier que la playlist existe dans le payload du profil testé.

## Déboguer un scrape qui échoue

1. Vérifier `username`/`platform` dans `%APPDATA%\RL Overlay\config.json`.
2. Log : `%APPDATA%\RL Overlay\overlay.log`.
3. Cloudflare/403 → la fenêtre cachée n'a pas posé les cookies : laisser la page profil charger plus longtemps avant l'appel API.
4. `metadata.name` inconnu → manque dans `NAME2KEY` → stat ignorée silencieusement.

## Gotchas

- **Pas de clé API officielle** : on imite le site. Si tracker.gg change la structure du payload ou durcit Cloudflare, le scrape casse — c'est le point de fragilité n°1.
- Le Chromium caché doit être fermé proprement (`closeHidden`) sinon process orphelins.
- Respecter `pollSeconds` (déf 15) — ne pas marteler l'API, risque de rate-limit/Cloudflare challenge.
- Profil **privé** sur tracker.gg → API renvoie vide, pas une erreur. Vérifier la visibilité du profil avant de blâmer le code.
