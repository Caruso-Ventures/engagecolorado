# Engage Colorado — Design Notes

Working document for deferred decisions and editorial intent. Not user-facing — kept in the repo so the next person who touches the site has context.

## Current palette

| Role | Hex | Notes |
|---|---|---|
| `--bg` (page background) | `#fafaf7` | Warm off-white, preserves editorial feel |
| `--paper` (cards) | `#ffffff` | Clean white for card surfaces |
| `--ink` (headlines) | `#0f2638` | Deep dusk-mountain navy |
| `--mid` (body) | `#1f2937` | Slate |
| `--light` (secondary) | `#718096` | Light slate |
| `--rule` (hairlines) | `#e5e7eb` | Neutral gray |
| `--accent` (primary) | `#1a3a52` | Dusk-mountain blue — toolbar, primary actions |
| `--gold` (legacy var name, terracotta value) | `#b86b34` | Terracotta — active states, eyebrows, primary accent. Variable name is `--gold` for compatibility but the color is terracotta. |
| `--green` (secondary accent) | `#2d4a3e` | Forest green — preserved from original palette |
| Bear Roars purple | `#3a2566` / `#322044` | Used in sponsor strip + Communities eyebrow |
| Communities tint | `#f4ede0` | Soft sandstone bg for editorial section |

**Editorial principle behind the palette:** civic-of-place, not civic-of-polity. The site reads as Rocky Mountain dusk (navy + sandstone + forest green) rather than US flag (navy + gold + red). Red is intentionally absent from branding — reserved for error states only.

## Top chrome (3 fixed strips)

1. **Toolbar** (72px) — Engage Colorado · Home / Latest / Related / About / Subscribe
2. **Bear Roars sponsor strip** (50px) — `Presented by · The Bear Roars · Candid conversations on Colorado innovation · Listen →`
3. **Featured editorial strip** (47px) — `Featured · Bringing Coloradans Together — Boulder Roots Music Fest · Read →`

Total fixed chrome: ~169px. Body padding-top: 172px. Section anchor scroll-margin-top: 184px.

**Trade-off acknowledged:** 3 stacked strips is heavy for laptop viewports (~19% of vertical space). If chrome ever feels too dominant, the Featured strip is the first to demote (it's editorial promotion that could move into the page rather than the chrome).

## Deferred decisions

### Logo / brand mark
- Currently the wordmark "Engage Colorado" is set in italic Newsreader serif — no logo image.
- **Deferred** until someone designs one with intent. If pursued: explore a Rockies silhouette, sunrise abstraction, or a "C" / "EC" monogram. Avoid generic ringed monograms.

### Mailchimp template recolor (future newsletters)
- The `/api/campaign.js` proxy recolors **existing** Mailchimp campaign HTML on the way to the site. This makes Issue 1 and Issue 2 render in the new palette on `engagecolorado.org/article.html?id=...`.
- **Cannot fix:** sent emails in inboxes (immutable), Mailchimp public archive (`mailchi.mp/...`).
- **Future newsletters need template update in Mailchimp dashboard.** Color mapping for that work:

| Old (Mailchimp) | New (site palette) |
|---|---|
| `#003275` (primary navy) | `#1a3a52` |
| `#001C4F` (deep navy) | `#0f2638` |
| `#001030` (darkest navy) | `#0a1a26` |
| `#FFD525` (gold) | `#b86b34` |
| `#C7453B` (flag red) | drop / replace with navy `#1a3a52` |
| `#3A7D5C` (green) | `#2d4a3e` |
| `#3D4F6B` / `#5C6A7E` slate blues | `#1f2937` / `#718096` |
| `#8FA3C4` / `#B0C4E0` light slate blues | `#9ab0c2` / `#c5d2dd` |
| `#EAEEF4` light blue tint | `#f0f4f8` |
| `#DDD8CE` beige | `#e5e7eb` |
| `#F7F5F0` cream | `#fafaf7` |

### Topics dropdown in toolbar
- Architectural placeholder for when categories arrive. Toolbar currently: Home / Latest / Related / About / Subscribe.
- When the third article is published in a different beat, add `Topics ▾` between Latest and Related. Likely first categories: Innovation Policy / Civic Engagement / Voices.

### CMS migration
- Static HTML works for ~5 pages. Will not scale to 100 articles, multiple contributors, topical archives, search.
- **Trigger to revisit:** when content > 20 pieces OR a 2nd contributor regularly publishes.
- Likely options: Astro / Eleventy (markdown), Sanity / Contentful (headless CMS), or full Substack/Ghost migration.

### Modal subscribe pattern
- Currently the toolbar Subscribe button anchors to `/index.html#newsletter` — visitors leave the page they're reading.
- **Better UX:** modal that subscribes in-place. Pattern was already in `article.html` (since removed during toolbar consolidation).
- **Deferred** — not blocking, anchor pattern is fine for now.

## Editorial voice notes

The publication uses "we" — the same "we" appears in the homepage hero, the Communities lede, and the About page founder note. Coherence across surfaces is intentional: visitors who land on any page should hear the same voice.

- **Don't** drift into both-sidesism as content scales — the editorial position is "civic invitation across the spectrum + championing innovation," not "balanced coverage of all viewpoints."
- **Don't** add disclaimer language preempting accusations no one is making. The footer used to disclaim affiliation with "the Engage Coalition" — but no such coalition exists. Removed.
- **Do** use editorial voice on featured content ("we believe...", "we're championing...") — distinguishes a publication from a list of links.

## Architectural notes

- Shared chrome (toolbar + sponsor strip + featured strip + body offset + scroll margins) lives in `assets/site.css` — single source of truth across all 5 pages.
- Page-specific styles stay inline in each HTML file (matches existing pattern).
- API proxy pattern: `api/newsletters.js` and `api/campaign.js` fetch from Mailchimp and serve to the browser. The proxy gives one chokepoint to transform every newsletter the site renders — used for the recoloring above.

## What got removed

For the next reader: these were intentional removals, not oversights.

- **Hero manifesto** moved from homepage to `/about` (homepage now leads with Latest + Communities, not mission text)
- **"Independence" section** on `/about` merged into "What this is" (was redundant)
- **"What to expect" section** on `/about` deleted (boilerplate, said nothing)
- **CoInnovation Future** removed from related initiatives (per request)
- **Engage Coalition disclaimer** removed from footer (referenced something that doesn't exist)
- **Old gradient CTA cards** (Bear Roars, Boulder Roots Fest, Ensuring Colorado peers on the homepage) — Bear Roars promoted to dedicated band, BRMF promoted to Communities section, Ensuring Colorado moved to `/related` page. (The dead `.cta-card` CSS went away with the Aug 2026 rundown-homepage rebuild.)
- **Standalone tech directory implementation** (`tech-directory.html` + `assets/tech-data.js` + `assets/tech-directory.js` + `assets/supabase-tech.js` + `scripts/pull-tech-directory.mjs`) — superseded June 2026 by the embedded `tech-directory-app/` iframe on the merged `/investor-directory` page; the leftover assets were deleted in the Aug 2026 audit. Recover from git history if ever needed.
- **Article-page subscribe modal + client-side fetch fallback** — the SSR route (`/api/article-page`) always inlines content, so the client fetch path could never run; the modal's opener button was removed with the old toolbar. Both deleted from `api/_article-template.html` in the Aug 2026 audit.

## Editor auth (added Aug 2026)

`/edit` saves now go through `/api/save-section.js`, which checks the passphrase
server-side against `EC_EDIT_TOKEN` and writes with the service-role key
(`SUPABASE_TECH_DIR_KEY`). **Before go-live:** set both env vars in Vercel, then
drop the anon UPDATE policy so direct writes stop working:

```sql
drop policy ec_home_sections_anon_update on public.ec_home_sections;
```
