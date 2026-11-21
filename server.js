'use strict';
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const root = __dirname;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const PORT = Number(process.env.PORT) || 5173;
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch { res.writeHead(400).end('Bad URL'); return; }
  const file = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`КОНТАКТ BLOODLINE → http://localhost:${PORT}`));
