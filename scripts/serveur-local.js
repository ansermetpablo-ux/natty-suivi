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
  '.woff2':'font/woff2'
};

http.createServer((req, res) => {
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
