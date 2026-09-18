/**
 * Tiny static server for the landing page (`bun run site:serve`).
 * Uses node APIs so it shares the server/ project's type setup.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'website');
const port = Number(process.env.PORT ?? 8090);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, safe === '/' || safe === '\\' ? 'index.html' : safe);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}).listen(port, () => {
  console.log(`Landing page serving ${root}`);
  console.log(`> http://localhost:${port}`);
});
