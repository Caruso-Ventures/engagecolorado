#!/usr/bin/env node
/**
 * Engage Colorado — Pull Colorado Tech Directory from Supabase
 *
 * Fetches all companies from the Colorado Tech Directory Supabase project
 * and writes assets/tech-data.js for use by tech-directory.html.
 *
 * Usage:
 *   node scripts/pull-tech-directory.mjs
 *
 * Requires: SUPABASE_TECH_DIR_KEY in .env.local or set as env var.
 * Project ref: llnmuexkqbchmyzneiey (Colorado Tech Directory)
 *
 * Exit codes: 0 = success, 1 = error.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SUPABASE_URL = "https://llnmuexkqbchmyzneiey.supabase.co";
const OUT_PATH = path.join(ROOT, "assets/tech-data.js");

// Public anon key (same one shipped in assets/supabase-config.js). The
// `companies` table is readable by `anon` via RLS, so a service-role key is
// optional — it's only needed if you ever want to read unpublished rows.
const PUBLIC_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsbm11ZXhrcWJjaG15em5laWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDgwMjQsImV4cCI6MjA5NDI4NDAyNH0.gRRbvj7ymEkVuD3jxDxpje8oiXOMssnSqW_kdC9USX4";

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
};

function loadKey() {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/SUPABASE_TECH_DIR_KEY=([^\n\r]+)/);
    if (match) return match[1].trim();
  }
  const fromEnv = process.env.SUPABASE_TECH_DIR_KEY;
  if (fromEnv) return fromEnv;
  // No service-role key configured — fall back to the public anon key, which
  // can read all published companies (the same data the live site fetches).
  return PUBLIC_ANON_KEY;
}

async function fetchCompanies(key) {
  // Columns + embeds mirror assets/supabase-tech.js so the static snapshot is
  // shape-identical to the live data (funding, IPO/exit, key people, investors).
  const select = [
    "id", "slug", "name", "city", "founded", "stage", "size", "industry",
    "website", "linkedin", "description",
    "is_portfolio", "is_endeavor",
    "last_funded_date", "last_funded_round", "last_funded_amount_text",
    "valuation_text",
    "ipo_date", "ipo_symbol", "ipo_exchange", "ipo_valuation_text",
    "exit_date", "exit_acquirer", "exit_valuation_text",
    "company_people(role,sort_order,people(full_name))",
    "company_investors(sort_order,investors(name))",
  ].join(",");

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?select=${select}&order=name.asc&limit=10000`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase fetch failed (${res.status}): ${text}`);
  }

  return res.json();
}

function computeStats(companies) {
  const cityCount = new Set(companies.map((co) => co.city).filter(Boolean)).size;
  const industryCount = new Set(companies.map((co) => co.industry).filter(Boolean)).size;

  const industryCounts = {};
  for (const co of companies) {
    if (co.industry) industryCounts[co.industry] = (industryCounts[co.industry] || 0) + 1;
  }
  const topIndustries = Object.entries(industryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return [
    { value: String(companies.length), label: "Colorado Companies" },
    { value: String(cityCount), label: "Cities Represented" },
    { value: String(industryCount), label: "Tech Industries" },
    { value: String(topIndustries[0][1]), label: topIndustries[0][0] },
    { value: String(topIndustries[1][1]), label: topIndustries[1][0] },
    { value: String(topIndustries[2][1]), label: topIndustries[2][0] },
  ];
}

function buildOutputJs(companies, stats) {
  const normalized = companies.map((co) => {
    const people = (co.company_people || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((cp) => {
        const name = cp.people && cp.people.full_name;
        return name ? { name, role: cp.role || "" } : null;
      })
      .filter(Boolean);

    const investors = (co.company_investors || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((ci) => ci.investors && ci.investors.name)
      .filter(Boolean);

    return {
      id: co.id,
      slug: co.slug ?? "",
      name: co.name ?? "",
      city: co.city ?? "",
      founded: co.founded ?? null,
      stage: co.stage ?? "",
      size: co.size ?? "",
      industry: co.industry ?? "",
      website: co.website ?? "",
      linkedin: co.linkedin ?? "",
      description: co.description ?? "",
      lastFundedDate: co.last_funded_date ? String(co.last_funded_date) : "",
      lastFundedRound: co.last_funded_round ?? "",
      lastFundedAmount: co.last_funded_amount_text ?? "",
      valuation: co.valuation_text ?? "",
      ipoDate: co.ipo_date ?? "",
      ipoSymbol: co.ipo_symbol ?? "",
      ipoExchange: co.ipo_exchange ?? "",
      ipoValuation: co.ipo_valuation_text ?? "",
      exitDate: co.exit_date ?? "",
      exitAcquirer: co.exit_acquirer ?? "",
      exitValuation: co.exit_valuation_text ?? "",
      isPortfolio: co.is_portfolio ?? false,
      isEndeavor: co.is_endeavor ?? false,
      people,
      investors,
    };
  });

  const date = new Date().toISOString().split("T")[0];
  return [
    `// Engage Colorado — Colorado Tech Directory data`,
    `// Generated: ${date} (${companies.length} companies)`,
    `// Source: Supabase project llnmuexkqbchmyzneiey`,
    `// DO NOT EDIT — regenerate with: node scripts/pull-tech-directory.mjs`,
    ``,
    `window.EC_TECH_COMPANIES = ${JSON.stringify(normalized, null, 2)};`,
    ``,
    `window.EC_TECH_STATS = ${JSON.stringify(stats, null, 2)};`,
  ].join("\n");
}

(async () => {
  console.log(`\n${c.blue}${c.bold}Engage Colorado — Pull Tech Directory${c.reset}`);

  let key;
  try {
    key = loadKey();
    console.log(`${c.dim}  key loaded${c.reset}`);
  } catch (err) {
    console.error(`\n${c.red}Error: ${err.message}${c.reset}\n`);
    process.exit(1);
  }

  console.log(`${c.dim}  fetching companies from Supabase…${c.reset}`);
  let companies;
  try {
    companies = await fetchCompanies(key);
  } catch (err) {
    console.error(`\n${c.red}Error: ${err.message}${c.reset}\n`);
    process.exit(1);
  }
  console.log(`${c.green}  ✓ ${companies.length} companies fetched${c.reset}`);

  const stats = computeStats(companies);
  const output = buildOutputJs(companies, stats);

  fs.writeFileSync(OUT_PATH, output, "utf8");
  console.log(`${c.green}  ✓ wrote ${path.relative(ROOT, OUT_PATH)}${c.reset}`);
  console.log(`\n${c.bold}Done.${c.reset} Update ${c.dim}?v=N${c.reset} in tech-directory.html if you bumped the dataset.\n`);
})();
