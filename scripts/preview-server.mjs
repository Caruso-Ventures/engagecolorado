#!/usr/bin/env node
/**
 * Engage Colorado — local preview server.
 *
 * A tiny static file server that mimics the Vercel production routing the
 * site relies on, so previews behave like the deployed site:
 *   - cleanUrls: /investor-directory  → investor-directory.html
 *   - rewrite:   /tech-directory      → investor-directory.html (tech view)
 *   - directory index: /tech-directory-app → /tech-directory-app/index.html
 *
 * Usage: node scripts/preview-server.mjs [port]
 * (Note: /api/* serverless functions are NOT executed here — static pages only.)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 3010;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// Explicit rewrites (mirrors vercel.json).
const REWRITES = {
  "/tech-directory": "/investor-directory.html",
};

function resolveFile(urlPath) {
  // Strip query/hash.
  let p = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  if (REWRITES[p.replace(/\/+$/, "")]) p = REWRITES[p.replace(/\/+$/, "")];

  const candidates = [];
  if (p === "/" || p === "") candidates.push("index.html");
  candidates.push(p.replace(/^\//, ""));
  // cleanUrls: try .html and /index.html
  if (!path.extname(p)) {
    candidates.push(p.replace(/^\//, "") + ".html");
    candidates.push(p.replace(/^\/|\/$/g, "") + "/index.html");
  }
  for (const c of candidates) {
    const abs = path.join(ROOT, c);
    if (abs.startsWith(ROOT) && fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return null;
}

http
  .createServer((req, res) => {
    const file = resolveFile(req.url);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404 Not Found: " + req.url);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`\n  Engage Colorado preview running:`);
    console.log(`    Investor + Tech directory →  http://localhost:${PORT}/investor-directory`);
    console.log(`    Tech view (direct link)   →  http://localhost:${PORT}/tech-directory`);
    console.log(`    Home                       →  http://localhost:${PORT}/\n`);
  });
