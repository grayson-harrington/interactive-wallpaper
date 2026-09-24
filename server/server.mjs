// Production server for the interactive wallpaper.
//
// Serves the Vite build (dist/) plus two things a generic static server can't:
//   GET  /api/wallpapers     live readdir of the photo folder (no rebuild needed)
//   GET  /wallpapers/<file>  the photos themselves
//   GET  /api/voronoi-images, /voronoi-images/<file>  same, for images/voronoi/
//   (folders: images/wallpapers and images/voronoi; override with
//    WALLPAPER_DIR / VORONOI_DIR)
//   GET  /api/state          small shared key/value state (current selection,
//   PUT  /api/state          auto-cycle, L-system settings, input-test report)
//                            so a browser tab can steer what Plash shows.
//
// No dependencies: plain node:http so launchd can run it with nothing but node.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const WALLPAPER_DIR = path.resolve(process.env.WALLPAPER_DIR || path.join(ROOT, 'images', 'wallpapers'));
const VORONOI_DIR = path.resolve(process.env.VORONOI_DIR || path.join(ROOT, 'images', 'voronoi'));
// live image folders: /api/<name> lists, /<name>/<file> serves
const IMAGE_DIRS = { wallpapers: WALLPAPER_DIR, 'voronoi-images': VORONOI_DIR };
const STATE_FILE = path.join(ROOT, '.state.json');
const PORT = Number(process.env.PORT || 4747);
const HOST = process.env.HOST || '127.0.0.1';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.bmp']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.bmp': 'image/bmp',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

// ---- shared state -------------------------------------------------------

let state = { rev: 0, updatedAt: 0, values: {} };
try {
  state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
} catch {
  // first run, or unreadable file: start empty
}

let saveTimer = null;
function persistState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fsp.writeFile(STATE_FILE, JSON.stringify(state, null, 2)).catch((err) => {
      console.error('failed to persist state:', err.message);
    });
  }, 250);
}

// ---- helpers ------------------------------------------------------------

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    'Content-Type': MIME['.json'],
    'Cache-Control': 'no-store',
  });
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function sendFile(req, res, filePath, cacheControl) {
  let stat;
  try {
    stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    return false;
  }
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': cacheControl,
    'Last-Modified': stat.mtime.toUTCString(),
  });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// ---- routes -------------------------------------------------------------

async function listImages(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((n) => IMAGE_EXT.has(path.extname(n).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  for (const [name, dir] of Object.entries(IMAGE_DIRS)) {
    if (pathname === `/api/${name}`) {
      try {
        return sendJson(res, 200, { dir, files: await listImages(dir) });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }
    if (pathname.startsWith(`/${name}/`)) {
      // basename only: never let a request escape the folder
      const file = path.basename(pathname.slice(name.length + 2));
      if (!IMAGE_EXT.has(path.extname(file).toLowerCase())) return send(res, 404, 'not found');
      const ok = await sendFile(req, res, path.join(dir, file), 'no-cache');
      return ok ? undefined : send(res, 404, 'not found');
    }
  }

  if (pathname === '/api/state') {
    if (req.method === 'GET') return sendJson(res, 200, state);
    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        const patch = JSON.parse(await readBody(req));
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('expected object');
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) delete state.values[k];
          else state.values[k] = v;
        }
        state.rev += 1;
        state.updatedAt = Date.now();
        persistState();
        return sendJson(res, 200, state);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    return send(res, 405, 'method not allowed');
  }

  if (pathname === '/api/health') return sendJson(res, 200, { ok: true });

  // static build
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
  const rel = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST, rel);
  if (!filePath.startsWith(DIST)) return send(res, 403, 'forbidden');
  if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');

  const hashed = rel.startsWith(`${path.sep}assets${path.sep}`) && /-[\w-]{8,}\.\w+$/.test(rel);
  const cache = hashed ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (await sendFile(req, res, filePath, cache)) return;

  // SPA fallback
  if (await sendFile(req, res, path.join(DIST, 'index.html'), 'no-cache')) return;
  send(res, 503, 'dist/ not built yet: run `npm run build`');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(res, 500, 'internal error');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`interactive wallpaper: http://localhost:${PORT}  (photos: ${WALLPAPER_DIR})`);
});
