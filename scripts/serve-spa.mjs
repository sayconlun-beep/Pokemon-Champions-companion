import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 4173);
const root = join(process.cwd(), 'dist');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const clean = normalize(decoded).replace(/^([.][.][/\\])+/, '');
  return join(root, clean);
}

async function resolveFile(urlPath) {
  let file = safePath(urlPath);
  if (existsSync(file)) {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
    if (existsSync(file)) return file;
  }

  const hasExtension = Boolean(extname(urlPath.split('?')[0] || ''));
  if (!hasExtension) return join(root, 'index.html');
  return null;
}

createServer(async (req, res) => {
  try {
    const file = await resolveFile(req.url || '/');
    if (!file || !existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(error instanceof Error ? error.message : 'Server error');
  }
}).listen(port, () => {
  console.log(`SPA preview server running at http://localhost:${port}`);
});
