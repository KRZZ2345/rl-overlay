'use strict';

// Serveur HTTP local (127.0.0.1) pour OBS. Sert l'OVERLAY RÉEL (index.html + ses
// assets) pour que la Browser Source affiche la forme + le thème choisis, alimenté
// par l'endpoint /state (JSON). Bind localhost uniquement -> aucune expo réseau.

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function startObsServer(opts = {}) {
  const port = opts.port || 49200;
  const getState = opts.getState || (() => ({}));
  const log = opts.log || (() => {});
  const root = __dirname;

  const server = http.createServer((req, res) => {
    try {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      if (url === '/state' || url === '/state.json') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(getState() || {}));
        return;
      }
      // Fichier statique sous la racine projet ('/' -> overlay index.html).
      const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
      const file = path.normalize(path.join(root, rel));
      if (!file.startsWith(root)) { res.writeHead(403); res.end(''); return; } // anti-traversal
      const ext = path.extname(file).toLowerCase();
      if (!MIME[ext] || !fs.existsSync(file)) { res.writeHead(404); res.end(''); return; }
      res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(file));
    } catch (e) {
      res.writeHead(500); res.end('');
      log('obs req: ' + e.message);
    }
  });
  server.on('error', (e) => log('obs server: ' + e.message));
  server.listen(port, '127.0.0.1', () => log('obs server: http://127.0.0.1:' + port));
  return { stop: () => { try { server.close(); } catch {} }, port };
}

module.exports = { startObsServer };
