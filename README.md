# RL Overlay — sans injection, sans ban

Overlay transparent par-dessus Rocket League qui affiche :
- **MMR** de la playlist choisie
- **Streak** de victoires/défaites
- **Wins / Losses de la session**

Aucune DLL injectée, aucune lecture mémoire du jeu. On lit seulement ton
**profil public** sur le Tracker Network et on pose une fenêtre transparente
au-dessus du jeu. → 0 risque de ban.

## Installation

### Version .exe (simple)

1. Dézippe `RL-Overlay-win-x64.zip`.
2. Lance `RL Overlay.exe`.
3. **Au premier lancement**, une fenêtre de config s'ouvre : choisis ta
   plateforme et entre **ton** pseudo exact (le même que sur ton profil Tracker,
   profil public). Clique « Démarrer l'overlay ».

> Ton pseudo et tes stats sont enregistrés dans ton dossier `userData`
> (`%APPDATA%\RL Overlay\`), **propre à ta machine**. Rien n'est partagé : chaque
> utilisateur voit ses propres stats.

Pour corriger plateforme/pseudo plus tard : **Ctrl+Alt+P**.

### Version source (dev)

1. Installe [Node.js](https://nodejs.org) (LTS).
2. Dans ce dossier :
   ```
   npm install
   npm start
   ```
   La fenêtre de config s'ouvre au premier lancement (pas de fichier à éditer).

> Mets Rocket League en **Plein écran fenêtré (Borderless)** pour que l'overlay
> reste visible par-dessus.

## Raccourcis

- **Ctrl+Alt+R** : remet la session à zéro (wins/losses/streak)
- **Ctrl+Alt+E** : déclenche l'easter egg (son rare de défaite) à la demande
- **Ctrl+Alt+T** : change le **thème** couleur (8 thèmes)
- **Ctrl+Alt+F** : change la **forme** de l'overlay (9 formes : Complète, Compacte, Pro, Stats, Barre, Mini, Boost, Colonne, Texte). La forme **Boost** encadre la jauge de boost — centre-la dessus avec Ctrl+Alt+Flèches.
- **Ctrl+Alt+Flèches** : déplace l'overlay (12 px par appui), position sauvegardée
- **Ctrl+Alt+D** : active / désactive la **présence Discord** (MMR live sur ton profil)
- **Ctrl+Alt+P** : rouvre l'écran de config (corriger plateforme / pseudo)
- **Ctrl+Alt+1** : suivre le **Ranked Duel 1v1**
- **Ctrl+Alt+2** : suivre le **Ranked Doubles 2v2**
- **Ctrl+Alt+3** : suivre le **Ranked Standard 3v3**

> Les touches 1/2/3 *nues* servent aux quick chats en jeu, d'où le combo
> **Ctrl+Alt** pour ne pas les voler à Rocket League.

## Comment ça marche (W/L automatiques)

L'overlay interroge ton MMR toutes les `pollSeconds`. Quand le MMR change :
- MMR **monte** → +1 victoire, streak +1
- MMR **descend** → +1 défaite, streak -1

⚠️ Le MMR public se met à jour **après** le match (quelques secondes à 1 min),
donc l'overlay réagit en fin de partie, pas pendant.

### Compteurs du jour (tous modes)

- **Wins / Losses / Streak** = **total du jour, tous modes confondus** (1v1,
  2v2, 3v3, Hoops, Rumble, Dropshot, Snowday, Heatseeker, 4v4, Casual). Une
  victoire est détectée dès que le MMR d'un mode monte ; une défaite quand il
  baisse. Donc peu importe le mode joué, ça compte.
- **Buts / Saves** = total du jour, tous modes (stats carrière).
- Tout se remet à zéro automatiquement au changement de date.
- Le **MMR affiché en grand** suit la playlist choisie (Ctrl+Alt+1/2/3).
- `Ctrl+Alt+R` remet à zéro le total W/L du jour.

## Si « MMR introuvable »

Le Tracker Network (Cloudflare) bloque parfois les requêtes automatiques.
Vérifie d'abord que ton profil est **public** et que `username`/`platform`
sont corrects en ouvrant :
`https://rocketleague.tracker.network/rocket-league/profile/<platform>/<username>/overview`

Si ça persiste, on peut basculer en **mode manuel** (touches W/L au clavier).

## Présence Discord (MMR live sur ton profil)

Affiche `2v2 • 761 MMR` / `Champion I • Division II — 4V 2D (🔥3)` sur ton profil
Discord pendant que tu joues. **Sans injection** : on parle juste au client
Discord local (pipe IPC). 0 risque de ban.

Activation (1 min) :

1. Va sur https://discord.com/developers/applications → **New Application**,
   nomme-la (ex. « Rocket League » — c'est le nom affiché sous « joue à … »).
2. Copie l'**Application ID** (onglet *General Information*).
3. Ouvre `%APPDATA%\RL Overlay\config.json` et renseigne :
   ```json
   "discord": { "enabled": true, "clientId": "TON_APPLICATION_ID", "largeImageKey": "", "showProfileButton": true }
   ```
4. Relance l'overlay. La présence apparaît dès que Rocket League est au premier
   plan (et disparaît hors jeu). Toggle rapide : **Ctrl+Alt+D**.

Optionnel — **image de rang** : onglet *Rich Presence → Art Assets*, uploade une
image (ex. clé `rl`), puis mets `"largeImageKey": "rl"`.

## Compiler en .exe

```
npm run build
```
Le .exe portable est généré dans `dist/`.
