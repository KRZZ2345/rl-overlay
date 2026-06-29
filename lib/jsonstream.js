'use strict';

// Découpe un flux TCP de JSON concaténé (sans délimiteur) en objets complets.
// La Stats API de Rocket League (127.0.0.1:49123) envoie des objets JSON collés ;
// on compte les accolades (en ignorant celles dans les chaînes) pour isoler chaque
// objet de premier niveau. Pur, tolérant (un objet illisible est ignoré), gère les
// chunks partiels entre deux appels. Logique testable, sans I/O.
function createJsonStream(onValue) {
  let buf = '';
  return function push(chunk) {
    buf += chunk;
    let depth = 0, inStr = false, esc = false, objStart = -1, consumed = 0;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') { if (depth === 0) objStart = i; depth++; }
      else if (c === '}') {
        if (depth > 0) {
          depth--;
          if (depth === 0) {
            const slice = buf.slice(objStart, i + 1);
            try { onValue(JSON.parse(slice)); } catch { /* objet incomplet/corrompu : ignoré */ }
            consumed = i + 1;
            objStart = -1;
          }
        }
      }
    }
    // garde la fin non consommée (objet partiel ou espaces) pour le prochain chunk
    buf = buf.slice(consumed);
    // garde-fou anti-explosion mémoire si jamais un flux part en vrille
    if (buf.length > 1_000_000) buf = '';
  };
}

module.exports = { createJsonStream };
