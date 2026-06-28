# Skills — rl-overlay

Skills projet pour bosser sur l'overlay Rocket League. Un dossier = un skill (`SKILL.md` + frontmatter).

| Skill | Quand |
|---|---|
| [stats-pipeline](stats-pipeline/SKILL.md) | Calcul MMR/streak/momentum/insights/goals/daily — toucher à `lib/`, ajouter une métrique, chiffre faux. |
| [test-suite](test-suite/SKILL.md) | Lancer/écrire les tests `node:test`, TDD sur `lib/`. |
| [overlay-ui](overlay-ui/SKILL.md) | Rendu `index.html` — formes HUD, thèmes, layouts, hotkeys, animations. |
| [tracker-api](tracker-api/SKILL.md) | Scrape MMR tracker.gg (`tracker.js`) — playlists, Cloudflare, plateforme. |
| [debug-overlay](debug-overlay/SKILL.md) | Bug runtime Electron — crash boot, invisible, logs userData, IPC. |
| [release-build](release-build/SKILL.md) | Packager le zip distribuable, checklist release. |

Cycle build+run (driver PowerShell) : voir le skill existant `run-rl-overlay` dans `.claude/skills/`.
