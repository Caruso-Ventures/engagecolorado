# Investor Directory — Supabase Data Source

**Status:** Approved (design)
**Date:** 2026-05-21
**Author:** Gibson Siegert (with Claude)
**Target file:** `investor-directory.html` + `assets/`

## Goal

Wire the Engage Colorado Investor Directory page to read live data from the
same Supabase project that powers `cv_website` (project: `Colorado Tech
Directory`, ref: `llnmuexkqbchmyzneiey`). The current static
`assets/investors-data.js` becomes a first-paint fallback rather than the
source of truth.

The page's HTML, CSS, and renderer (`assets/investor-directory.js`) do not
change visually — only how data flows in.

## Non-goals

- Redesigning the page's look or palette.
- Replacing or removing the `npm run pull-investors` script (it still writes
  the static fallback file).
- Adding a build step, framework, or server.
- Adding admin/edit UI on this site.

## Architecture

Mirror cv_website's investor-directory data layer exactly, translated from
React + TypeScript to vanilla JS for a static page:

| cv_website (React/TS) | Engage Colorado (vanilla JS) |
|---|---|
| `process.env.NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | `window.EC_SUPABASE_URL` / `_ANON_KEY` set in `assets/supabase-config.js` |
| `@supabase/supabase-js` via npm | `@supabase/supabase-js@2` loaded as ES module from `esm.sh` |
| `src/lib/supabase.ts` → `fetchInvestors()` | `assets/supabase-investors.js` → `window.ECFetchInvestors()` |
| Realtime subscription in `useEffect` | `window.ECSubscribeInvestors(onChange)` called from `investor-directory.js` |
| `generatedInvestors` static const | Existing `window.EC_INVESTORS` from `assets/investors-data.js` |
| `setInvestors(next)` → React re-render | New `replaceInvestors(next)` helper → reassign module ref → existing render pipeline |

## Components

### 1. `assets/supabase-config.js` (new)

Plain script. No imports. Sets two globals before any Supabase code loads:

```js
window.EC_SUPABASE_URL = "https://llnmuexkqbchmyzneiey.supabase.co";
window.EC_SUPABASE_ANON_KEY = "<anon key from .env.local>";
```

The anon key is safe to embed in client JS — Supabase designs it for browser
use, and Row-Level Security policies enforce access control. This matches
cv_website's `NEXT_PUBLIC_*` pattern (those env vars are inlined into the
shipped JS bundle at build time).

### 2. `assets/supabase-investors.js` (new, ES module)

Loaded as `<script type="module">`. Imports `createClient` from
`https://esm.sh/@supabase/supabase-js@2`. Exposes two functions on `window`:

#### `window.ECFetchInvestors(): Promise<Investor[]>`

Byte-for-byte port of `cv_website/src/lib/supabase.ts::fetchInvestors`. Runs
seven parallel `select` queries:

| # | Table | Filter / order |
|---|---|---|
| 1 | `cid_investors` | `is_published = true`, order by `sort_order`, then `name` |
| 2 | `cid_stages` | order by `sort_order` |
| 3 | `cid_sectors` | order by `label` |
| 4 | `cid_investor_stages` | (no filter) |
| 5 | `cid_investor_sectors` | (no filter) |
| 6 | `cid_investor_locations` | order by `is_primary desc`, then `id` |
| 7 | `cid_portfolio_companies` | order by `sort_order` |

Stitches the results client-side into the `Investor` shape consumed by
`assets/investor-directory.js`. The shape (matches `window.EC_INVESTORS`):

```ts
{
  name: string
  website?: string
  stages: string[]            // labels, in stage sort_order
  founded: string             // "" if null, else String(founded_year)
  checkSize: string           // prettyRange(check_size_bracket)
  aum: string                 // prettyRange(aum_bracket)
  hq: string                  // formatHq(locations) — "City, ST" or "City, ST & City, ST"
  description: string         // "" if null
  portfolio: string[]         // company_name values, in sort_order
  sectors: string[]           // labels
}
```

Helpers, ported verbatim from cv_website:

```js
function prettyRange(s) {
  return s ? s.replace(/(\S)–(\S)/g, "$1 – $2") : "";
}

function formatHq(locs) {
  if (!locs?.length) return "";
  const sorted = [...locs].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary)
  );
  return sorted
    .map(l => (l.state ? `${l.city}, ${l.state}` : String(l.city)))
    .join(" & ");
}
```

If any of the seven queries errors, `ECFetchInvestors` throws. The caller in
`investor-directory.js` catches and logs; the static-file render stays
on-screen.

#### `window.ECSubscribeInvestors(onChange): () => void`

Subscribes to `postgres_changes` (event: `*`) on all seven `cid_*` tables in
the `public` schema, on a single channel named `cid-directory`. Any change
debounces 150ms and calls `ECFetchInvestors()`, then invokes
`onChange(newList)`. Returns an unsubscribe function that removes the channel
and clears the debounce timer.

### 3. `assets/investor-directory.js` (modify)

Add at the bottom, after the existing init code:

1. A new module-scoped `replaceInvestors(next)` helper that:
   - Reassigns the local `investors` reference (currently `const investors = window.EC_INVESTORS || []`).
   - Rebuilds the autocomplete and sector lists if they're derived from
     `investors`.
   - Calls the existing `applyFilters()` / `renderFirms()` pipeline.

   Note: the current code uses `const investors`. The implementation will
   convert this to `let investors` (or wrap the array in an object/closure)
   so it can be reassigned. This is a minimal local edit, not a refactor.

2. A bootstrap block run after first paint:

   ```js
   if (typeof window.ECFetchInvestors === "function") {
     window.ECFetchInvestors()
       .then(next => replaceInvestors(next))
       .catch(err => console.error("Supabase fetch failed", err));

     if (typeof window.ECSubscribeInvestors === "function") {
       window.ECSubscribeInvestors(next => replaceInvestors(next));
     }
   }
   ```

   No teardown is needed — the page is static and the subscription lives
   until navigation.

### 4. `investor-directory.html` (modify)

Add two script tags **before** the existing `investors-data.js` and
`investor-directory.js` tags:

```html
<script src="assets/supabase-config.js"></script>
<script type="module" src="assets/supabase-investors.js"></script>
```

The module script is async by default but populates `window.ECFetchInvestors`
on load. Because `investor-directory.js` only calls it from inside its
bootstrap block (which runs after the existing renderer initializes), the
order of resolution is safe: if the module isn't ready at first paint, the
static cards display; when the module finishes loading, the bootstrap block
runs and the Supabase fetch begins.

## Data flow

**Load path (happy):**

1. Browser parses HTML; loads `supabase-config.js` (sync) → globals set.
2. Loads `investors-data.js` (sync) → `window.EC_INVESTORS` populated.
3. Loads `investor-directory.js` (defer) → renders cards from static data
   (first paint).
4. ES module `supabase-investors.js` resolves → defines `ECFetchInvestors`
   and `ECSubscribeInvestors`.
5. Bootstrap block in `investor-directory.js` calls `ECFetchInvestors()` →
   seven parallel REST queries → stitched array → `replaceInvestors(next)` →
   cards re-render.
6. `ECSubscribeInvestors` opens the realtime channel; any subsequent DB edit
   triggers a debounced re-fetch + re-render.

**Load path (Supabase unavailable):**

- Steps 1–3 still run. Step 4 may load but the fetch in step 5 rejects → the
  `.catch` logs the error. Static cards stay on-screen. Identical to
  cv_website's behavior.

**Load path (config missing):**

- If `window.EC_SUPABASE_URL` is unset, `supabase-investors.js` no-ops on
  import (early return in module init). Static cards render normally with
  no errors.

## RLS / database prerequisites

The cv_website Investor Directory already reads from this project with the
anon key, so the required `SELECT` policies on the seven `cid_*` tables must
already exist. Before declaring the implementation done, verify by opening
both sites side-by-side: identical card counts on both = policies are fine.

If counts differ (e.g., Engage Colorado returns 0 cards), the likely cause
is missing `SELECT` policies on one or more of the join tables. Fix by
mirroring cv_website's policies — the implementation plan should call this
out as a verification step, not a blocker.

## Visibility filter

Only `cid_investors.is_published = true` rows are returned, matching
cv_website. Drafts in Supabase do not appear on either site until that flag
is flipped.

## Testing (manual)

Static site, no test suite. Manual verification checklist:

1. **Local dev:** `python3 -m http.server 8000` → open
   `http://localhost:8000/investor-directory.html`. DevTools Network tab
   should show seven 200 responses to
   `llnmuexkqbchmyzneiey.supabase.co/rest/v1/cid_*`. Cards should re-render
   (sometimes invisibly fast) after they resolve.
2. **Realtime check:** in Supabase Studio, toggle one investor's
   `is_published` value. The card should appear/disappear on the open page
   within ~250ms without reload.
3. **Fallback check:** in DevTools, block `*.supabase.co` requests; reload.
   Static cards must still render. Console must log the fetch error but the
   page must not break.
4. **Parity check:** compare card count, names, stages, sectors, and
   portfolio lists with cv_website's Investor Directory. They should match
   exactly (same DB, same filter, same mapping).

## Open questions / risks

- **None blocking.** The cv_website implementation is the reference; this
  spec is a translation of working code into a different host environment.

## Out of scope (explicit)

- Pagination, sorting controls beyond what the page already has.
- Editing investors from Engage Colorado.
- Caching beyond what the browser's HTTP cache provides.
- Migrating `cv_website` away from its current pattern.
- Removing or rewriting `assets/investors-data.js` or
  `scripts/pull-investor-directory.mjs`.
