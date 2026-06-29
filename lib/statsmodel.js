'use strict';

// Transforme les données brutes de la Stats API (event UpdateState) en un modèle
// simple pour l'overlay. Pur/testable. Le `Data` de l'API est du JSON STRINGIFIÉ
// -> parseData() le décode.

function parseData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

// Identifie le joueur local parmi Players : par PrimaryId, sinon par pseudo,
// sinon le joueur spectatoré (Target), sinon l'unique joueur (freeplay).
function localPlayer(players, ident, target) {
  if (!Array.isArray(players) || players.length === 0) return null;
  const id = ident && ident.primaryId;
  const u = ((ident && ident.username) || '').toLowerCase();
  return (
    (id && players.find((p) => p.PrimaryId === id)) ||
    (u && players.find((p) => (p.Name || '').toLowerCase() === u)) ||
    (target && target.Name && players.find((p) => p.Name === target.Name)) ||
    (players.length === 1 ? players[0] : null) ||
    null
  );
}

// Modèle de match depuis le Data (déjà parsé) d'un UpdateState.
function matchModel(data, ident) {
  const d = parseData(data);
  if (!d) return { inMatch: false };
  const g = d.Game || {};
  const teams = Array.isArray(g.Teams) ? g.Teams : [];
  const me = localPlayer(d.Players, ident, g.Target);
  const myTeam = me ? me.TeamNum : (g.Target && g.Target.TeamNum);
  const scoreOf = (n) => { const t = teams.find((x) => x.TeamNum === n); return t ? (t.Score || 0) : 0; };
  const teamScore = myTeam != null ? scoreOf(myTeam) : 0;
  const oppScore = teams.filter((t) => t.TeamNum !== myTeam).reduce((a, t) => a + (t.Score || 0), 0);
  return {
    inMatch: Array.isArray(d.Players) && d.Players.length > 0,
    time: g.TimeSeconds || 0,
    overtime: !!g.bOvertime,
    replay: !!g.bReplay,
    hasWinner: !!g.bHasWinner,
    myTeam: myTeam != null ? myTeam : null,
    teamScore,
    oppScore,
    me: me ? {
      name: me.Name, goals: me.Goals || 0, saves: me.Saves || 0, shots: me.Shots || 0,
      assists: me.Assists || 0, score: me.Score || 0, demos: me.Demos || 0, boost: me.Boost || 0,
    } : null,
  };
}

// Résultat W/L/N depuis deux scores (fin de match).
function resultFromScores(mine, theirs) {
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'N';
}

module.exports = { parseData, localPlayer, matchModel, resultFromScores };
