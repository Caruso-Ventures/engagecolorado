#!/usr/bin/env node
/**
 * Engage Colorado — Pull Investor Directory data from Caruso Ventures site
 *
 * What this does:
 *   1. Locates the cv_website repo (the source of truth for the
 *      Caruso Ventures investor directory).
 *   2. Optionally `git pull`s it so we have the latest published data.
 *   3. Reads src/data/investors.ts and parses out:
 *        - export const investors: Investor[] = [...]
 *        - export const tickerStats = [...]
 *   4. Writes assets/investors-data.js inside Engage Colorado, preserving
 *      every field, every firm, every word.
 *
 * Usage:
 *   node scripts/pull-investor-directory.mjs
 *   node scripts/pull-investor-directory.mjs --no-git   # skip `git pull`
 *   node scripts/pull-investor-directory.mjs --src=/abs/path/to/investors.ts
 *
 * Exit codes: 0 = success, 1 = error.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ── Config ─────────────────────────────────────────────────────────────
// Where the Caruso Ventures repo lives on this machine. Adjust if you
// ever move it. The script will fall back to a few common locations.
const CV_REPO_CANDIDATES = [
  "/Users/gibsonsiegert/Desktop/VS CODE/cv_website",
  path.resolve(ROOT, "../cv_website"),
  path.resolve(ROOT, "../CV_website"),
  path.resolve(ROOT, "../../cv_website"),
];

const REL_INVESTORS_PATH = "src/data/investors.ts";
const OUT_PATH = path.join(ROOT, "assets/investors-data.js");

// ── Argv ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const noGit = args.includes("--no-git");
const srcOverride = args.find((a) => a.startsWith("--src="))?.slice("--src=".length);

// ── Helpers ────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(msg) { console.log(msg); }
function ok(msg)  { console.log(`${c.green}✓${c.reset} ${msg}`); }
function info(msg){ console.log(`${c.cyan}ℹ${c.reset} ${msg}`); }
function warn(msg){ console.log(`${c.yellow}⚠${c.reset} ${msg}`); }
function fail(msg){ console.error(`${c.red}✗ ${msg}${c.reset}`); process.exit(1); }

function findCvRepo() {
  if (srcOverride) {
    if (!fs.existsSync(srcOverride)) {
      fail(`--src override does not exist: ${srcOverride}`);
    }
    return { repoRoot: null, investorsPath: srcOverride };
  }
  for (const candidate of CV_REPO_CANDIDATES) {
    const investorsPath = path.join(candidate, REL_INVESTORS_PATH);
    if (fs.existsSync(investorsPath)) {
      return { repoRoot: candidate, investorsPath };
    }
  }
  fail(
    `Could not find cv_website repo. Looked in:\n  - ${CV_REPO_CANDIDATES.join(
      "\n  - "
    )}\nPass --src=/abs/path/to/investors.ts to override.`
  );
}

function gitPull(repoRoot) {
  if (noGit) {
    info("Skipping git pull (--no-git)");
    return;
  }
  try {
    const status = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    if (status) {
      warn(
        `cv_website has uncommitted local changes; pulling anyway.\n${c.dim}${status}${c.reset}`
      );
    }
    info(`git pull in ${repoRoot}…`);
    const out = execSync("git pull --ff-only", {
      cwd: repoRoot,
      encoding: "utf8",
    });
    log(c.dim + out.trim() + c.reset);
  } catch (e) {
    warn(`git pull failed (continuing with local copy): ${e.message.split("\n")[0]}`);
  }
}

/**
 * Extract a TS object/array literal from a source string by name.
 * Returns the literal text from the first '[' or '{' through its matching close.
 *
 * The investors.ts file uses simple JSON-ish literals, but we still need to
 * count brackets carefully because strings (and template strings) can contain
 * brackets.
 */
function extractExportedLiteral(source, exportName) {
  // Match `export const NAME[: Type] = ` and capture position right after `=`
  const re = new RegExp(
    `export\\s+const\\s+${exportName}(?:\\s*:[^=]+)?\\s*=\\s*`,
    "m"
  );
  const m = re.exec(source);
  if (!m) {
    throw new Error(`Could not find "export const ${exportName} =" in source`);
  }
  let i = m.index + m[0].length;
  // Skip whitespace
  while (i < source.length && /\s/.test(source[i])) i++;
  const open = source[i];
  if (open !== "[" && open !== "{") {
    throw new Error(
      `Expected '[' or '{' after "${exportName} =", got "${open}"`
    );
  }
  const close = open === "[" ? "]" : "}";

  // Walk the source counting brackets while respecting strings & comments.
  let depth = 0;
  let j = i;
  let inString = null; // '"' | "'" | "`"
  let escape = false;

  for (; j < source.length; j++) {
    const ch = source[j];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === inString) { inString = null; continue; }
      continue;
    }
    // Line comment
    if (ch === "/" && source[j + 1] === "/") {
      const eol = source.indexOf("\n", j);
      j = eol === -1 ? source.length : eol;
      continue;
    }
    // Block comment
    if (ch === "/" && source[j + 1] === "*") {
      const end = source.indexOf("*/", j + 2);
      j = end === -1 ? source.length : end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        return source.slice(i, j + 1);
      }
    }
  }
  throw new Error(`Unbalanced brackets while parsing ${exportName}`);
}

/**
 * Convert a TS object-literal string (uses unquoted keys, single quotes,
 * trailing commas) into JSON the safe way: evaluate it as JS in a
 * sandboxed Function. This trusts the source repo.
 */
function evalLiteral(literalText) {
  // Allow trailing commas etc by letting JS parse it directly.
  // We wrap in `(...)` so object-literals aren't mistaken for blocks.
  // eslint-disable-next-line no-new-func
  const fn = new Function(`return (${literalText});`);
  return fn();
}

function buildOutputJs({ investors, tickerStats, srcPath, repoCommit }) {
  const stamp = new Date().toISOString();
  const header = `/* Engage Colorado — Investor Directory data
 *
 * AUTO-GENERATED. Do not edit by hand.
 * Generator:   scripts/pull-investor-directory.mjs
 * Source:      ${srcPath}
 * cv_website:  ${repoCommit || "(unknown)"}
 * Pulled:      ${stamp}
 *
 * To refresh:  npm run pull-investors
 *              (or: node scripts/pull-investor-directory.mjs)
 */
`;
  // We pretty-print with 2 spaces. JSON.stringify is safe and identical
  // to what humans would write, just with quoted keys.
  const investorsJson = JSON.stringify(investors, null, 2);
  const tickerJson = JSON.stringify(tickerStats, null, 2);
  return `${header}
window.EC_INVESTORS = ${investorsJson};

window.EC_TICKER_STATS = ${tickerJson};
`;
}

function getRepoCommit(repoRoot) {
  if (!repoRoot) return null;
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────
function main() {
  console.log(`${c.bold}${c.blue}Pull Script from CV Investor Directory${c.reset}`);
  const { repoRoot, investorsPath } = findCvRepo();
  if (repoRoot) ok(`Found cv_website at ${repoRoot}`);
  else ok(`Using --src override: ${investorsPath}`);

  if (repoRoot) gitPull(repoRoot);

  const repoCommit = getRepoCommit(repoRoot);
  if (repoCommit) info(`cv_website commit: ${repoCommit}`);

  const source = fs.readFileSync(investorsPath, "utf8");

  let investors, tickerStats;
  try {
    const investorsLiteral = extractExportedLiteral(source, "investors");
    investors = evalLiteral(investorsLiteral);
  } catch (e) {
    fail(`Failed to parse investors[]: ${e.message}`);
  }
  try {
    const tickerLiteral = extractExportedLiteral(source, "tickerStats");
    tickerStats = evalLiteral(tickerLiteral);
  } catch (e) {
    fail(`Failed to parse tickerStats[]: ${e.message}`);
  }

  if (!Array.isArray(investors) || investors.length === 0) {
    fail("Parsed investors is empty or not an array");
  }
  if (!Array.isArray(tickerStats) || tickerStats.length === 0) {
    fail("Parsed tickerStats is empty or not an array");
  }

  // Validate shape on the first entry to catch silent regressions.
  const requiredFields = [
    "name", "stages", "founded", "checkSize", "aum", "hq",
    "description", "portfolio", "sectors",
  ];
  for (const f of requiredFields) {
    if (!(f in investors[0])) {
      fail(`Investor object missing field "${f}" — schema may have changed`);
    }
  }

  // Read existing output (if any) to detect actual changes.
  let prevText = null;
  try { prevText = fs.readFileSync(OUT_PATH, "utf8"); } catch {}

  const outText = buildOutputJs({
    investors,
    tickerStats,
    srcPath: investorsPath,
    repoCommit,
  });

  fs.writeFileSync(OUT_PATH, outText);
  ok(`Wrote ${OUT_PATH}`);
  info(`  ${investors.length} investors, ${tickerStats.length} ticker stats`);

  // Diff summary: by firm name.
  if (prevText) {
    const prevNames = matchAllNames(prevText);
    const nextNames = new Set(investors.map((i) => i.name));
    const added = [...nextNames].filter((n) => !prevNames.has(n));
    const removed = [...prevNames].filter((n) => !nextNames.has(n));
    if (added.length === 0 && removed.length === 0) {
      info("No firm additions or removals vs. previous local copy.");
    }
    if (added.length)   ok(`Added (${added.length}): ${added.join(", ")}`);
    if (removed.length) warn(`Removed (${removed.length}): ${removed.join(", ")}`);
  }

  console.log(`\n${c.green}${c.bold}Done.${c.reset} The Engage Colorado Investor Directory is now in sync.`);
}

function matchAllNames(text) {
  const out = new Set();
  // Cheap extraction — find all `"name": "..."` occurrences.
  const re = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.add(m[1].replace(/\\"/g, '"'));
  }
  return out;
}

main();
