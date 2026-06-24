// Discord Rich Presence — client IPC minimal, SANS dépendance externe.
// Se connecte au pipe local de Discord (\\.\pipe\discord-ipc-N) et pousse une
// "activité". Aucune injection, aucune lecture du jeu : on parle seulement au
// client Discord déjà ouvert sur la machine. -> 0 risque.
//
// Protocole : trames [op:int32 LE][len:int32 LE][json]. Handshake op=0 avec
// {v:1, client_id}, puis SET_ACTIVITY via op=1.

const net = require('net');

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;

function pipePath(i) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`;
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp';
  return `${base}/discord-ipc-${i}`;
}

class DiscordRPC {
  constructor(clientId) {
    this.clientId = clientId;
    this.sock = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.lastActivity = null; // ré-appliquée dès que la connexion est prête
  }

  connect() {
    if (this.connected || this.connecting || !this.clientId) return;
    this.connecting = true;
    this._tryPipe(0);
  }

  _tryPipe(i) {
    if (i > 9) { this.connecting = false; this._scheduleReconnect(); return; }
    const sock = net.connect(pipePath(i));
    sock.once('error', () => { sock.destroy(); this._tryPipe(i + 1); });
    sock.once('connect', () => {
      this.sock = sock;
      sock.on('error', () => this._down());
      sock.on('close', () => this._down());
      sock.on('data', (buf) => this._onData(buf));
      this._send(OP_HANDSHAKE, { v: 1, client_id: this.clientId });
    });
  }

  _onData(buf) {
    // Décode la trame reçue : [op:int32][len:int32][json]. Sert à distinguer
    // READY (handshake OK) d'une ERROR (ex: client_id invalide).
    try {
      if (buf && buf.length >= 8) {
        const len = buf.readInt32LE(4);
        const json = buf.slice(8, 8 + len).toString('utf8');
        if (typeof this.onFrame === 'function') this.onFrame(json);
      }
    } catch {}
    // Première trame reçue après le handshake = READY : on est en ligne.
    if (!this.connected) {
      this.connected = true;
      this.connecting = false;
      if (this.lastActivity) this._push(this.lastActivity);
    }
  }

  _send(op, data) {
    if (!this.sock) return;
    const json = Buffer.from(JSON.stringify(data), 'utf8');
    const head = Buffer.alloc(8);
    head.writeInt32LE(op, 0);
    head.writeInt32LE(json.length, 4);
    try { this.sock.write(Buffer.concat([head, json])); } catch { this._down(); }
  }

  _push(activity) {
    this._send(OP_FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity },
      nonce: String(Date.now()) + Math.random().toString(36).slice(2)
    });
  }

  /** Définit (ou met à jour) l'activité affichée sur le profil Discord. */
  setActivity(activity) {
    this.lastActivity = activity;
    if (!this.connected) { this.connect(); return; }
    this._push(activity);
  }

  /** Efface l'activité (hors jeu). */
  clear() {
    this.lastActivity = null;
    if (this.connected) this._push(null);
  }

  _down() {
    this.connected = false;
    this.connecting = false;
    if (this.sock) { try { this.sock.destroy(); } catch {} this.sock = null; }
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this.reconnectTimer || !this.clientId) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 10000);
  }

  close() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    try { this.clear(); } catch {}
    if (this.sock) { try { this.sock.destroy(); } catch {} this.sock = null; }
    this.connected = false;
    this.connecting = false;
  }
}

module.exports = { DiscordRPC };
