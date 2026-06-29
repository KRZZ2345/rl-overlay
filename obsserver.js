'use strict';

// Petit serveur HTTP local (127.0.0.1) servant la page OBS (obs.html) + un
// endpoint /state JSON (match live + session). À coller comme Browser Source
// dans OBS. Bind localhost uniquement -> aucune exposition réseau.

const http = require('http');
const fs = require('fs');
const path = require('path');

function startObsServer(opts = {}) {
  const port = opts.port || 49200;
  const getState = opts.getState || (() => ({}));
  const log = opts.log || (() => {});
  const htmlPath = path.join(__dirname, 'obs.html');

  const server = http.createServer((req, res) => {
    try {
      const url = (req.url || '/').split('?')[0];
      if (url === '/state' || url === '/state.json') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(getState() || {}));
        return;
      }
      if (url === '/themes.css') { // tokens des 15 thèmes (partagés avec overlay/Hub)
        res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(path.join(__dirname, 'themes.css'), 'utf8'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(htmlPath, 'utf8'));
    } catch (e) {
      res.writeHead(500); res.end('');
      log('obs req: ' + e.message);
    }
  });
  server.on('error', (e) => log('obs server: ' + e.message)); // EADDRINUSE -> on log, pas de crash
  server.listen(port, '127.0.0.1', () => log('obs server: http://127.0.0.1:' + port));
  return { stop: () => { try { server.close(); } catch {} }, port };
}

module.exports = { startObsServer };
