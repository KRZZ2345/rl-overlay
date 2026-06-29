# Design — Overlay "live" via lecture du log RL (sans injection)

Date : 2026-06-29
Statut : à implémenter

## But

Rendre l'overlay quasi temps réel **sans injection ni BakkesMod** (tué par l'anticheat),
en lisant en **lecture seule** le log que Rocket League écrit lui-même. C'est la méthode
des trackers actuels (Landa, OmniStats) et l'effet "MMR en direct" de Mawkzy.

Aujourd'hui : poll aveugle du tracker toutes les 15-60s → MMR/W-L en retard.
Cible : dès qu'un match se termine, fetch tracker **immédiat** → MMR/rang/W-L à jour en
~1-2s. + détection automatique de la playlist jouée.

## Portée (approche 1 validée)
- **Inclus** : détection fin de match → refresh MMR/W-L instantané ; détection début de
  match + playlist → auto-sélection de la playlist affichée + démarrage session.
- **Exclu (YAGNI / impossible sans BakkesMod)** : score/buts/boost en direct *pendant* le
  match (non loggués de façon exploitable) ; indicateur ▲/▼ depuis le MMR interne.

## Source : `Launch.log`
Chemin : `%USERPROFILE%\Documents\My Games\Rocket League\TAGame\Logs\Launch.log`
(override possible via `config.overlay.logPath`). **Lecture seule** (`fs.open` flag `'r'`),
jamais d'écriture, aucun contact avec le process RL → anticheat-safe.

Patterns réels (vérifiés sur le log de la machine) :
- **Début de match / playlist** :
  - `StartMatchmaking ... for playlists (\d+)` 
  - `HandleServerReserved (Reservation=(... Playlist=(\d+) ...))`
- **Fin de match** : chargement de `GFX_WinnerMenu_SF` **ou** `GFX_EndGameMenu_SF`.
- Map playlist id → clé interne (à confirmer en impl ; observé `11` = Ranked Doubles 2v2) :
  `10`→`ranked-duel`, `11`→`ranked-doubles`, `13`→`ranked-standard`. Autres ids (casual,
  extra modes) : ignorés (on ne force pas la playlist).

## Composant : `rllog.js` (nouveau, isolé)
Responsabilité unique : surveiller le log et émettre des événements. Pas d'I/O réseau,
pas d'Electron → testable.
- API : `startLogWatcher({ logPath, onMatchStart(playlistId), onMatchEnd() })` → renvoie
  `stop()`.
- Mécanisme : toutes les ~1s, `fs.stat` la taille. Si grandi → lit l'appended (depuis le
  curseur), découpe en lignes, applique les regex, émet. Si taille < curseur (log
  tronqué/rotation au redémarrage du jeu : `Launch-backup-*.log`) → curseur remis à 0.
- **Au démarrage : curseur = fin du fichier** (on ne rejoue pas l'historique).
- Robustesse : fichier absent → watcher inerte (retente le stat), aucun crash.
- Anti-rebond : `onMatchEnd` ignoré si < 5s depuis le dernier (WinnerMenu + EndGameMenu
  peuvent charger ensemble).

## Câblage `main.js`
- Démarrer le watcher dans `startOverlay()` ; `stop()` dans `will-quit`.
- `onMatchStart(playlistId)` : si mappé à une playlist suivie → `switchPlaylist(key)` (auto)
  + démarre le chrono session si pas déjà.
- `onMatchEnd()` : **rafraîchissement immédiat des stats**, hors de la gate `overlayVisible`
  (le fetch tourne même si la fenêtre n'est pas au premier plan, pour être prêt à
  l'affichage). Comme le tracker.network a son propre délai, on lance une **rafale** :
  fetch à +0s, +6s, +20s, +45s (annulée si un nouveau match commence) → capture la maj
  tracker dès qu'elle arrive.
- Le **focus-watcher** (visibilité) et le **poll périodique** restent comme filet de
  sécurité (poll allongé possible, ex. 60s).

## Erreurs / dégradation
- Log introuvable / chemin custom invalide → log `logFocus`, fallback = comportement actuel
  (poll périodique). Aucune régression.
- Playlist id inconnu → on n'auto-switch pas (on garde le choix manuel).
- fetch tracker en échec (déjà géré) → la rafale réessaie.

## Vérification
1. `node --test` (ajout de tests unitaires `rllog` : feed de lignes → événements attendus,
   gestion troncature/rotation, curseur fin-de-fichier au start).
2. Test manuel : rejouer un `Launch-backup-*.log` existant en l'appendant à un fichier
   temp et vérifier les événements émis.
3. En jeu : finir un match → MMR/W-L se met à jour en ~1-2s ; changer de playlist en file
   d'attente → l'overlay suit.

## Release
Entrée patchnotes ("MMR en direct") → bump → tag → gh release. Auto-update hors-jeu propage.
Nécessite que l'utilisateur ait joué au moins une fois (log présent).
