/**
 * Minimal static file server for the exported web build (`bunx expo export
 * --platform web`). Run `bun run web:build` first, then `bun run web:serve`.
 *
 * Also exposes a same-origin CORS proxy at `/proxy?url=<encoded>` so the
 * web app can reach the WebUntis provider from a browser (the provider
 * itself sends no CORS headers).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

/** Serve the `dist/` directory relative to the process working directory. */
const root = join(process.cwd(), 'dist');
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function sendFile(res: import('node:http').ServerResponse, filePath: string) {
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? host}`);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }

  // Same-origin CORS proxy for the web app.
  const proxyUrl = url.searchParams.get('url');
  if (req.url?.startsWith('/proxy') && proxyUrl) {
    try {
      const target = new URL(proxyUrl);
      if (target.protocol !== 'https:' && target.protocol !== 'http:') {
        res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Only http(s) targets are allowed.');
        return;
      }
      const upstream = await fetch(target, { headers: { 'user-agent': 'actually-usable-calendar' } });
      const body = await upstream.arrayBuffer();
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': upstream.headers.get('cache-control') ?? 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(Buffer.from(body));
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'text/plain' }).end(
        `Proxy failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
    return;
  }

  let pathname = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, pathname);

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (!existsSync(filePath)) {
    // SPA fallback to the root document.
    filePath = join(root, 'index.html');
  }

  sendFile(res, filePath);
}).listen(port, host, () => {
  console.log(`Actually Usable Calendar (web) serving ${root}`);
  console.log(`> http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});