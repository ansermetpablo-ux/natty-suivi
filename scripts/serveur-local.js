/* scripts/serveur-local.js — servir le dépôt en local, pour vérifier dans un navigateur
   ═══════════════════════════════════════════════════════════════════════════════════
   node scripts/serveur-local.js [port]        (défaut : 4196)

   ⚠️ POURQUOI CE FICHIER EST DANS LE DÉPÔT ET PAS DANS UN DOSSIER TEMPORAIRE.
   `.claude/launch.json` avait accumulé QUATRE entrées mortes — chacune pointant
   vers le dossier de travail éphémère d'une session terminée. Elles échouent
   toutes en `MODULE_NOT_FOUND`, et la suivante en rajoutait une cinquième. Un
   chemin relatif au dépôt survit aux sessions ; un chemin de scratchpad, non.

   ⚠️ Et pas `python3 -m http.server` : il échoue en `PermissionError` sur ce Mac
   (le bac à sable lui refuse `os.getcwd()` au moment d'analyser ses arguments).
   C'était la première entrée de launch.json, morte elle aussi.

   Sert la racine du dépôt telle quelle — donc `/assets/...` et `/www/...`
   résolvent comme en production. Aucun cache, pour qu'une modification se voie
   au rechargement sans avoir à forcer quoi que ce soit. */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 4196;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  /* ⚠️ `application/wasm` est OBLIGATOIRE, pas cosmétique :
     `WebAssembly.instantiateStreaming()` refuse tout autre type et
     MediaPipe échoue alors sur un message qui parle de réseau. */
  '.wasm': 'application/wasm',
  '.tflite':'application/octet-stream'
};

/* ── Écriture d'une image recompressée par le navigateur ──────────────────────
   POST /__ecrire  { chemin: 'assets/img/decouverte/xxx.jpg', b64: '…' }

   ⚠️ POURQUOI CETTE ROUTE EXISTE. Le catalogue veut ses photos en deux tailles
   (860 px et 400 px), et cette machine n'a NI sharp NI ImageMagick — le seul
   `convert` du PATH est l'utilitaire Windows de conversion de système de
   fichiers, à ne surtout pas invoquer. Le navigateur, lui, sait redimensionner
   et encoder en JPEG ; il ne savait simplement pas rendre le résultat au
   disque. Sans cette route, il fallait faire transiter 185 000 caractères de
   base64 à la main pour UNE image.

   ⚠️ Elle n'écrit que sous `assets/img/`, et ce serveur ne quitte jamais la
   machine de développement : il n'est ni dans `www/` (le bundle natif) ni dans
   `api/` (les routes déployées). */
const ECRITURE_OK = path.join(ROOT, 'assets', 'img');

function ecrire(req, res) {
  let corps = '';
  req.on('data', c => { corps += c; if (corps.length > 40e6) req.destroy(); });
  req.on('end', () => {
    try {
      const { chemin, b64 } = JSON.parse(corps);
      const f = path.resolve(ROOT, chemin);
      if (!f.startsWith(ECRITURE_OK)) { res.writeHead(403).end('hors assets/img'); return; }
      fs.mkdirSync(path.dirname(f), { recursive: true });
      const buf = Buffer.from(b64, 'base64');
      fs.writeFileSync(f, buf);
      res.writeHead(200, { 'Content-Type': 'application/json' })
         .end(JSON.stringify({ ok: true, chemin, octets: buf.length }));
    } catch (e) {
      res.writeHead(400).end(String(e.message));
    }
  });
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.split('?')[0] === '/__ecrire') { ecrire(req, res); return; }

  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/menu.html';

  const f = path.join(ROOT, rel);
  // Un `..` dans l'URL sortirait du dépôt : on sert le dépôt, rien d'autre.
  if (!f.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }

  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + rel); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log('Dépôt servi sur http://localhost:' + PORT));
