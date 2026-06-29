'use strict';

// Client de la Stats API officielle de Rocket League (TCP 127.0.0.1:49123).
// EAC-safe : on ne fait que LIRE un socket que le jeu expose une fois l'API activée
// (DefaultStatsAPI.ini). Aucune injection, aucune lecture mémoire. Reconnexion auto
// (ECONNREFUSED tant que RL n'est pas lancé / API non activée).

const net = require('net');
const { createJsonStream } = require('./lib/jsonstream');

function startStatsApi(opts = {}) {
  const port = opts.port || 49123;
  const host = '127.0.0.1';
  const onEvent = opts.onEvent || (() => {});
  const log = opts.log || (() => {});
  const retryMs = opts.retryMs || 5000;

  let sock = null, stopped = false, retry = null;
  const parser = createJsonStream((v) => {
    try { onEvent(v); } catch (e) { log('statsapi onEvent: ' + e.message); }
  });

  function connect() {
    if (stopped) return;
    sock = net.connect(port, host);
    sock.setEncoding('utf8');
    sock.on('connect', () => log('statsapi: connecté ' + host + ':' + port));
    sock.on('data', (d) => parser(d));
    sock.on('error', () => { /* API pas active : on retentera à 'close' */ });
    sock.on('close', () => {
      sock = null;
      if (!stopped) { clearTimeout(retry); retry = setTimeout(connect, retryMs); }
    });
  }
  connect();
  return { stop: () => { stopped = true; clearTimeout(retry); if (sock) { try { sock.destroy(); } catch {} } } };
}

module.exports = { startStatsApi };
