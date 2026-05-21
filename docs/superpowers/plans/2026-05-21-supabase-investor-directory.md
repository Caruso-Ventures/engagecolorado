# Supabase Investor Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Investor Directory's static data source with a live Supabase fetch + realtime subscription, mirroring the cv_website implementation, while keeping the existing static `investors-data.js` file as a first-paint fallback.

**Architecture:** Two new client-side files (`supabase-config.js` + `supabase-investors.js` as an ES module loading `@supabase/supabase-js@2` from `esm.sh`) ported byte-for-byte from `cv_website/src/lib/supabase.ts`. Existing `investor-directory.js` gets a small bootstrap block and a `replaceInvestors()` helper. The renderer, HTML, and CSS are untouched.

**Tech Stack:** Vanilla JS (ES modules + classic scripts), `@supabase/supabase-js@2` via `esm.sh`, Supabase project `llnmuexkqbchmyzneiey` ("Colorado Tech Directory"), Python's built-in `http.server` for local testing.

**Spec:** [docs/superpowers/specs/2026-05-21-supabase-investor-directory-design.md](../specs/2026-05-21-supabase-investor-directory-design.md)

---

## File Map

| Path | Action | Purpose |
|---|---|---|
| `assets/supabase-config.js` | Create | Globals: `EC_SUPABASE_URL`, `EC_SUPABASE_ANON_KEY` |
| `assets/supabase-investors.js` | Create | ES module exposing `ECFetchInvestors()` and `ECSubscribeInvestors()` |
| `assets/investor-directory.js` | Modify | Add `replaceInvestors()` helper + Supabase bootstrap block; convert `const investors` → `let investors`; recompute `allSectors` |
| `investor-directory.html` | Modify | Add two `<script>` tags above the existing investor scripts |

No tests — this is a static site with no test infrastructure. Verification is manual via browser DevTools (covered in Task 5). This matches the project's existing pattern (no test files anywhere in the repo).

---

## Task 1: Add Supabase config globals

**Files:**
- Create: `assets/supabase-config.js`

- [ ] **Step 1: Create the config file**

Create `assets/supabase-config.js` with this exact content (anon key copied from `.env.local`):

```js
/* Engage Colorado — Supabase config
 * Globals for the Investor Directory's live data source.
 * The anon key is intentionally public; Row-Level Security policies
 * enforce read access in Supabase. Matches cv_website's
 * NEXT_PUBLIC_SUPABASE_* pattern.
 */
window.EC_SUPABASE_URL = "https://llnmuexkqbchmyzneiey.supabase.co";
window.EC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsbm11ZXhrcWJjaG15em5laWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDgwMjQsImV4cCI6MjA5NDI4NDAyNH0.gRRbvj7ymEkVuD3jxDxpje8oiXOMssnSqW_kdC9USX4";
```

- [ ] **Step 2: Verify file loads with no errors**

Start the local server (skip if already running):

```bash
cd "/Users/gibsonsiegert/Desktop/VS CODE/Engage Colorado"
python3 -m http.server 8000
```

Open `http://localhost:8000/assets/supabase-config.js` in a browser. Expected: file content displays as text. No 404.

- [ ] **Step 3: Commit**

```bash
git add assets/supabase-config.js
git commit -m "Add Supabase config globals for Investor Directory"
```

---

## Task 2: Add Supabase data module (fetch + subscribe)

**Files:**
- Create: `assets/supabase-investors.js`

This task ports `cv_website/src/lib/supabase.ts` verbatim. The two helpers (`prettyRange`, `formatHq`) and the seven-query `fetchInvestors` body are exact copies — only the surrounding boilerplate changes (ES module export → `window.*` assignment).

- [ ] **Step 1: Create the module file**

Create `assets/supabase-investors.js` with this exact content:

```js
/* Engage Colorado — Investor Directory Supabase data layer
 *
 * Port of cv_website/src/lib/supabase.ts to a browser ES module.
 * Loads @supabase/supabase-js@2 from esm.sh — no build step required.
 *
 * Exposes on window:
 *   ECFetchInvestors()                  -> Promise<Investor[]>
 *   ECSubscribeInvestors(onChange)      -> () => void  (unsubscribe)
 *
 * Both are no-ops if window.EC_SUPABASE_URL is not set, so the page
 * still functions with only the static fallback file.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = window.EC_SUPABASE_URL;
const key = window.EC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("EC: Supabase config missing; live directory disabled.");
} else {
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const CID_TABLES = [
    "cid_investors",
    "cid_stages",
    "cid_sectors",
    "cid_investor_stages",
    "cid_investor_sectors",
    "cid_investor_locations",
    "cid_portfolio_companies",
  ];

  function prettyRange(s) {
    return s ? s.replace(/(\S)–(\S)/g, "$1 – $2") : "";
  }

  function formatHq(locs) {
    if (!locs || !locs.length) return "";
    const sorted = [...locs].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary)
    );
    return sorted
      .map((l) => (l.state ? `${l.city}, ${l.state}` : String(l.city)))
      .join(" & ");
  }

  function groupBy(rows) {
    const m = new Map();
    for (const r of rows) {
      const a = m.get(r.investor_id) || [];
      a.push(r);
      m.set(r.investor_id, a);
    }
    return m;
  }

  async function fetchInvestors() {
    const [
      { data: investors, error: e1 },
      { data: stages, error: e2 },
      { data: sectors, error: e3 },
      { data: investorStages, error: e4 },
      { data: investorSectors, error: e5 },
      { data: locations, error: e6 },
      { data: portfolio, error: e7 },
    ] = await Promise.all([
      supabase
        .from("cid_investors")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("cid_stages").select("*").order("sort_order"),
      supabase.from("cid_sectors").select("*").order("label"),
      supabase.from("cid_investor_stages").select("*"),
      supabase.from("cid_investor_sectors").select("*"),
      supabase
        .from("cid_investor_locations")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("id", { ascending: true }),
      supabase.from("cid_portfolio_companies").select("*").order("sort_order"),
    ]);

    const err = e1 || e2 || e3 || e4 || e5 || e6 || e7;
    if (err) throw err;

    const stageById = new Map((stages || []).map((s) => [s.id, s]));
    const sectorById = new Map((sectors || []).map((s) => [s.id, s]));

    const stagesByInv = groupBy(investorStages || []);
    const sectorsByInv = groupBy(investorSectors || []);
    const locsByInv = groupBy(locations || []);
    const portByInv = groupBy(portfolio || []);

    return (investors || []).map((inv) => {
      const stageRows = (stagesByInv.get(inv.id) || [])
        .map((r) => stageById.get(r.stage_id))
        .filter(Boolean)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const sectorRows = (sectorsByInv.get(inv.id) || [])
        .map((r) => sectorById.get(r.sector_id))
        .filter(Boolean);

      return {
        name: inv.name,
        website: inv.website || undefined,
        stages: stageRows.map((s) => s.label),
        founded: inv.founded_year ? String(inv.founded_year) : "",
        checkSize: prettyRange(inv.check_size_bracket),
        aum: prettyRange(inv.aum_bracket),
        hq: formatHq(locsByInv.get(inv.id) || []),
        description: inv.description || "",
        portfolio: (portByInv.get(inv.id) || []).map((p) => p.company_name),
        sectors: sectorRows.map((s) => s.label),
      };
    });
  }

  function subscribe(onChange) {
    let pending = null;

    const refresh = async () => {
      try {
        const next = await fetchInvestors();
        onChange(next);
      } catch (err) {
        console.error("EC: Supabase refresh failed", err);
      }
    };

    const channel = supabase.channel("cid-directory");
    for (const table of CID_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (pending) clearTimeout(pending);
          pending = setTimeout(refresh, 150);
        }
      );
    }
    channel.subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }

  window.ECFetchInvestors = fetchInvestors;
  window.ECSubscribeInvestors = subscribe;
}
```

- [ ] **Step 2: Verify module loads in the browser**

The module won't run until referenced from `investor-directory.html` (Task 4), so quick sanity-check it by opening a one-off test page. Create a scratch file at `/tmp/ec-supabase-test.html`:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>EC Supabase test</title></head>
<body>
<script src="http://localhost:8000/assets/supabase-config.js"></script>
<script type="module" src="http://localhost:8000/assets/supabase-investors.js"></script>
<script type="module">
  // Wait a tick for the module to attach window.ECFetchInvestors
  setTimeout(async () => {
    const list = await window.ECFetchInvestors();
    console.log("Got", list.length, "investors");
    console.log(list[0]);
    document.body.textContent = "Got " + list.length + " investors. See console.";
  }, 250);
</script>
</body></html>
```

Open `file:///tmp/ec-supabase-test.html` (with the python server still running on port 8000). Expected: page shows "Got N investors" where N matches the `is_published = true` count on cv_website's directory (likely the full 65 or close to it). DevTools console shows a sample investor object with the keys `name`, `website`, `stages`, `founded`, `checkSize`, `aum`, `hq`, `description`, `portfolio`, `sectors`.

If you see 0 investors: RLS policies on the `cid_*` tables don't allow anon read. Verify by loading cv_website's directory in another tab — if it works there, the policies exist; double-check the anon key in `supabase-config.js` is correct. If cv_website's also shows 0, stop and flag for fix before proceeding.

- [ ] **Step 3: Clean up scratch file and commit**

```bash
rm /tmp/ec-supabase-test.html
git add assets/supabase-investors.js
git commit -m "Add Supabase data module for Investor Directory"
```

---

## Task 3: Wire the renderer to accept live data

**Files:**
- Modify: `assets/investor-directory.js`

The renderer currently does `const investors = window.EC_INVESTORS || []` and computes `allSectors` once at module init. We need to make both reassignable so a `replaceInvestors()` helper can swap them in after the Supabase fetch resolves, then re-run the existing render pipeline.

- [ ] **Step 1: Convert `const investors` to `let investors`**

In `assets/investor-directory.js`, line 6:

Replace:
```js
  const investors = window.EC_INVESTORS || [];
```

With:
```js
  let investors = window.EC_INVESTORS || [];
```

- [ ] **Step 2: Convert `const allSectors` to `let allSectors`**

In `assets/investor-directory.js`, line 109:

Replace:
```js
  const allSectors = [...new Set(investors.flatMap((f) => f.sectors))].sort();
```

With:
```js
  let allSectors = [...new Set(investors.flatMap((f) => f.sectors))].sort();
```

- [ ] **Step 3: Add the `replaceInvestors()` helper**

In `assets/investor-directory.js`, add this function immediately **before** the `// ── Init ──` comment near line 424 (i.e., right after the existing helpers section, before `buildTicker()` is called):

```js
  // ── Supabase live data hook ──
  function replaceInvestors(next) {
    if (!Array.isArray(next) || next.length === 0) return;
    investors = next;
    allSectors = [...new Set(investors.flatMap((f) => f.sectors))].sort();
    // Rebuild the sector menu so newly-seen sectors appear (and removed ones go).
    // Active selections survive because state.activeSectors is a separate Set.
    buildSectorMenu();
    renderSectorMenu();
    renderSectorBtn();
    // Close any open autocomplete so it doesn't show stale suggestions.
    state.acOpen = false;
    if (acDropdown) acDropdown.classList.remove("open");
    renderFirms();
  }
```

The `next.length === 0` guard prevents an empty fetch (e.g., transient RLS failure that returns `[]` instead of throwing) from wiping out the static fallback that's already on-screen.

- [ ] **Step 4: Add the Supabase bootstrap block at the very end of the IIFE**

In `assets/investor-directory.js`, the file currently ends with:

```js
  // ── Init ──
  buildTicker();
  buildStageMenu();
  buildSectorMenu();
  renderStageBtn();
  renderSectorBtn();
  renderFirms();
})();
```

Replace that block with:

```js
  // ── Init ──
  buildTicker();
  buildStageMenu();
  buildSectorMenu();
  renderStageBtn();
  renderSectorBtn();
  renderFirms();

  // ── Live data from Supabase (mirrors cv_website investor-directory) ──
  // Polls for the module to finish loading, since it's <script type="module">
  // and may resolve after this classic script runs.
  function startLiveSync() {
    if (typeof window.ECFetchInvestors !== "function") return false;
    window.ECFetchInvestors()
      .then(replaceInvestors)
      .catch((err) => console.error("EC: Supabase initial fetch failed", err));
    if (typeof window.ECSubscribeInvestors === "function") {
      window.ECSubscribeInvestors(replaceInvestors);
    }
    return true;
  }
  if (!startLiveSync()) {
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (startLiveSync() || tries > 40) clearInterval(interval);
    }, 50);
  }
})();
```

The polling loop (max ~2s) handles the case where the ES module hasn't attached `window.ECFetchInvestors` yet by the time this classic script runs. If the module is missing entirely (config absent), the loop times out silently after 40 tries and the page works with static data only.

- [ ] **Step 5: Commit**

```bash
git add assets/investor-directory.js
git commit -m "Add replaceInvestors helper and Supabase bootstrap to renderer"
```

---

## Task 4: Wire the two new scripts into the HTML

**Files:**
- Modify: `investor-directory.html`

- [ ] **Step 1: Add the two script tags**

In `investor-directory.html`, locate lines 799–801:

```html
  <script src="assets/topbar.js" defer></script>
  <script src="assets/investors-data.js?v=66" defer></script>
  <script src="assets/investor-directory.js?v=66" defer></script>
```

Replace with:

```html
  <script src="assets/topbar.js" defer></script>
  <script src="assets/supabase-config.js" defer></script>
  <script type="module" src="assets/supabase-investors.js"></script>
  <script src="assets/investors-data.js?v=66" defer></script>
  <script src="assets/investor-directory.js?v=67" defer></script>
```

Two things to note:
- `supabase-config.js` uses `defer` so it executes after the document parses but before `investor-directory.js` runs — guarantees the globals exist when the ES module imports them.
- The `?v=66` on `investor-directory.js` bumps to `?v=67` to bust browser cache for the renderer changes from Task 3.

- [ ] **Step 2: Commit**

```bash
git add investor-directory.html
git commit -m "Load Supabase config and data module on Investor Directory page"
```

---

## Task 5: Manual end-to-end verification

**Files:** None. Browser-based verification only.

- [ ] **Step 1: Start the server (skip if running)**

```bash
cd "/Users/gibsonsiegert/Desktop/VS CODE/Engage Colorado"
python3 -m http.server 8000
```

- [ ] **Step 2: Verify the happy-path load**

Open `http://localhost:8000/investor-directory.html` in a browser. Open DevTools → Network tab → filter "supabase".

Expected:
- Seven REST requests to `llnmuexkqbchmyzneiey.supabase.co/rest/v1/cid_*`, all 200.
- One WebSocket connection to `wss://llnmuexkqbchmyzneiey.supabase.co/realtime/v1/websocket`.
- Cards visible on the page. Compare card count to cv_website's directory (`http://localhost:3000/investor-directory` if running, or the deployed version). The two counts should match exactly.
- Console: no errors. Possibly a warning about realtime auth — that's OK.

- [ ] **Step 3: Verify realtime updates**

Open Supabase Studio for project `Colorado Tech Directory`. Edit one investor's `description` field, save. Switch back to the Engage Colorado tab. The card's description should update within ~250ms with no reload.

If you don't want to mutate prod data: toggle a draft investor's `is_published` from `false` → `true` instead, and watch the card appear; then toggle back.

- [ ] **Step 4: Verify static fallback when Supabase is unreachable**

In DevTools → Network tab → enable "Block request URL" → add `*supabase.co*`. Reload the page.

Expected:
- Page still renders with the static `investors-data.js` content (whatever was last pulled via `npm run pull-investors`).
- Console shows `EC: Supabase initial fetch failed` with the network error.
- The page does NOT go blank.

Remove the block when done.

- [ ] **Step 5: Verify missing-config behavior**

Temporarily comment out the lines in `assets/supabase-config.js`:

```js
// window.EC_SUPABASE_URL = "...";
// window.EC_SUPABASE_ANON_KEY = "...";
```

Reload the page.

Expected:
- Page renders from static data only.
- Console shows `EC: Supabase config missing; live directory disabled.` (warning, not error).
- No failed network requests to Supabase.

Restore `supabase-config.js` afterward.

- [ ] **Step 6: Cross-check parity with cv_website**

Open both pages side-by-side:
- Engage Colorado: `http://localhost:8000/investor-directory.html`
- cv_website: whichever URL you use (local dev or deployed)

Pick three random investors and confirm: same name, same stages, same sectors (order may differ), same portfolio companies (order may differ), same HQ format, same checkSize and AUM strings.

If any field disagrees, the bug is likely in this site's port of `fetchInvestors`, not in cv_website. Compare `assets/supabase-investors.js` against `cv_website/src/lib/supabase.ts` and fix.

- [ ] **Step 7: Final commit if any fixes were needed**

If steps 2–6 surfaced no issues, no commit needed. If you fixed anything, commit:

```bash
git add <fixed files>
git commit -m "Fix issues found during Investor Directory verification"
```

---

## Done criteria

- All five tasks committed.
- `http://localhost:8000/investor-directory.html` displays cards matching cv_website's count.
- DevTools Network tab shows seven 200 responses to `cid_*` endpoints + one realtime WebSocket.
- Editing an investor in Supabase Studio updates the page within ~250ms.
- Blocking `*.supabase.co` falls back to the static file cleanly.
