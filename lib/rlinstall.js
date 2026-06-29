'use strict';

// Localise l'installation de Rocket League (Epic / Steam) et active la Stats API
// officielle en écrivant DefaultStatsAPI.ini (PacketSendRate>0). Le parsing
// (manifests Epic, libraryfolders Steam) est pur/testable ; les accès disque sont
// isolés dans findRocketLeague()/enableStatsApi().

const fs = require('fs');
const path = require('path');

// --- Parsing pur ---

// Manifest Epic (.item, JSON). Renvoie InstallLocation si c'est Rocket League.
function parseEpicManifest(json) {
  let m; try { m = typeof json === 'string' ? JSON.parse(json) : json; } catch { return null; }
  if (!m) return null;
  const name = (m.DisplayName || '') + ' ' + (m.MandatoryAppFolderName || '') + ' ' + (m.LaunchExecutable || '');
  if (/rocket\s*league|rocketleague/i.test(name)) return m.InstallLocation || null;
  return null;
}

// libraryfolders.vdf de Steam -> liste des chemins de bibliothèques.
function parseSteamLibraryFolders(text) {
  const out = [];
  if (!text) return out;
  // lignes du type:  "path"   "D:\\SteamLibrary"
  const re = /"path"\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(text))) out.push(m[1].replace(/\\\\/g, '\\'));
  return out;
}

// Un dossier d'install est valide s'il contient TAGame\Config.
function configDir(installDir) {
  return installDir ? path.join(installDir, 'TAGame', 'Config') : null;
}

// --- Accès disque ---

function homeDrive() { return process.env.SystemDrive || 'C:'; }

// Rassemble les dossiers d'install candidats (Epic manifests + Steam libs + communs).
function rlInstallCandidates() {
  const out = [];
  const push = (p) => { if (p && !out.includes(p)) out.push(p); };

  // Epic
  try {
    const md = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
    for (const f of fs.readdirSync(md)) {
      if (!f.endsWith('.item')) continue;
      try { push(parseEpicManifest(fs.readFileSync(path.join(md, f), 'utf8'))); } catch {}
    }
  } catch {}

  // Steam
  const steamRoots = [
    path.join(homeDrive() + '\\', 'Program Files (x86)', 'Steam'),
    path.join(homeDrive() + '\\', 'Program Files', 'Steam'),
  ];
  for (const root of steamRoots) {
    for (const vdf of [path.join(root, 'steamapps', 'libraryfolders.vdf'), path.join(root, 'config', 'libraryfolders.vdf')]) {
      try { for (const lib of parseSteamLibraryFolders(fs.readFileSync(vdf, 'utf8'))) push(path.join(lib, 'steamapps', 'common', 'rocketleague')); } catch {}
    }
    push(path.join(root, 'steamapps', 'common', 'rocketleague'));
  }

  // Communs
  push(path.join(homeDrive() + '\\', 'Program Files', 'Epic Games', 'rocketleague'));
  push(path.join(homeDrive() + '\\', 'Program Files (x86)', 'Epic Games', 'rocketleague'));
  return out;
}

// Renvoie le 1er dossier d'install dont TAGame\Config existe, sinon null.
function findRocketLeague() {
  for (const dir of rlInstallCandidates()) {
    try { if (fs.existsSync(configDir(dir))) return dir; } catch {}
  }
  return null;
}

// Patche le contenu de DefaultStatsAPI.ini pour mettre PacketSendRate à `rate`.
// Pur : prend l'ancien contenu (ou ''), renvoie le nouveau. Crée la section si absente.
function patchIniContent(content, rate = 30) {
  const section = '[TAGame.MatchStatsExporter_TA]';
  // Normalise d'abord les fins de ligne (\r seul ou \r\n -> \n). Évite qu'un \r
  // orphelin colle PacketSendRate à la ligne de commentaire (= valeur ignorée).
  const c = (content || '').replace(/\r\n?/g, '\n');
  let out;
  if (!c.includes(section)) {
    out = `${section}\nPort=49123\nPacketSendRate=${rate}\n`;
  } else if (/^[^\S\n]*PacketSendRate[^\S\n]*=/m.test(c)) {
    // [^\S\n] = espace horizontal seulement (ne traverse pas les retours ligne)
    out = c.replace(/^[^\S\n]*PacketSendRate[^\S\n]*=.*$/m, `PacketSendRate=${rate}`);
  } else {
    out = c.replace(section, `${section}\nPacketSendRate=${rate}`);
  }
  return out.replace(/\n/g, '\r\n'); // CRLF Windows
}

// Active la Stats API : écrit l'ini dans installDir (ou auto-détecté).
// Renvoie { ok, installDir, iniPath, rate, alreadyOn, error }.
function enableStatsApi(installDir, rate = 30) {
  const dir = installDir || findRocketLeague();
  if (!dir) return { ok: false, error: 'install-not-found' };
  const iniPath = path.join(configDir(dir), 'DefaultStatsAPI.ini');
  let cur = '';
  try { cur = fs.readFileSync(iniPath, 'utf8'); } catch {}
  const alreadyOn = /PacketSendRate\s*=\s*([1-9]\d*)/.test(cur);
  const next = patchIniContent(cur, rate);
  try {
    fs.writeFileSync(iniPath, next);
    return { ok: true, installDir: dir, iniPath, rate, alreadyOn };
  } catch (e) {
    return { ok: false, installDir: dir, iniPath, error: e.code === 'EPERM' || e.code === 'EACCES' ? 'need-admin' : e.message };
  }
}

module.exports = {
  parseEpicManifest, parseSteamLibraryFolders, patchIniContent, configDir,
  rlInstallCandidates, findRocketLeague, enableStatsApi,
};
