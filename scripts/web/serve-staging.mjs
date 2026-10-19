/* ───────────────────────────────────────────────────────────────────────────
   Serve a built web root for staging.lomonec.com  —  docs/WEB-STANDALONE.md

       node scripts/web/serve-staging.mjs <root> [--port 8150]

   Why this exists rather than `python3 -m http.server`: staging.lomonec.com is
   a cloudflared tunnel, so every response passes through Cloudflare's edge
   cache, and .js is one of the extensions Cloudflare caches by default. The
   first build of this work was served with Cache-Control: max-age=14400 and
   the edge then handed out that sw.js for hours — a rebuilt service worker
   never reached the browser, its install kept failing against files the new
   bundle no longer had, and the app silently had no offline shell at all. One
   stale file is the whole difference between testing the build you made and
   testing the one before it.

   So: no-store on everything the browser must not get a stale copy of, and a
   short, revalidated life for the heavy assets. Cloudflare honours no-store
   and keeps nothing. This is a STAGING server — it is not hardened and is not
   for production traffic.
   ─────────────────────────────────────────────────────────────────────────── */
import { createServer } from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { resolve, normalize, extname, join } from "node:path";

const argAfter = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const rootArg = process.argv[2];
if (!rootArg || rootArg.startsWith("--")) throw new Error("usage: node scripts/web/serve-staging.mjs <root> [--port 8150]");
const ROOT = resolve(process.cwd(), rootArg.replace(/^~(?=\/)/, process.env.HOME || "~"));
const PORT = Number(argAfter("--port") || 8150);
if (!existsSync(ROOT)) throw new Error("no such root: " + ROOT);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
};
/* the files where a stale copy changes how the app BEHAVES */
const neverStore = (p) => /(^|\/)(sw\.js|be-build\.js|index\.html|manifest\.json)$/.test(p) || p.endsWith("/");

createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { res.writeHead(400).end(); return; }
  if (p.endsWith("/")) p += "index.html";
  const safe = normalize(p).replace(/^(\.\.(\/|$))+/, "");
  const file = join(ROOT, safe);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  let st;
  try { st = statSync(file); } catch (e) { res.writeHead(404, { "content-type": "text/plain" }).end("not found\n"); return; }
  if (st.isDirectory()) { res.writeHead(301, { location: p.replace(/\/?$/, "/") }).end(); return; }
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "content-length": st.size,
    "cache-control": neverStore(safe) ? "no-store" : "public, max-age=60, must-revalidate",
    "x-be-staging": "1",
  });
  createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`staging root ${ROOT}\nlistening on http://127.0.0.1:${PORT}`));
