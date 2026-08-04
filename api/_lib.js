// Shared helpers for the /api functions. Underscore prefix keeps this file
// from being deployed as its own serverless function.

const SITE_URL = 'https://www.engagecolorado.org';
const DEFAULT_LIST_ID = '3baceb2cd8';

// Campaigns manually excluded from every listing surface.
const HIDDEN_IDS = new Set([
  'ae6238b5a8', // earlier duplicate of "Michael Dougherty for Attorney General"
]);

// One predicate for "is this campaign an Engage Colorado newsletter" so the
// articles list (/api/newsletters) and /sitemap.xml can never disagree.
// Accepts either the conventional "Engage Colorado" subject prefix or the
// canonical internal naming pattern (Engage [Colorado] Newsletter N) — the
// latter catches sends where the editor wrote a candidate-led subject line.
function isEngageNewsletter(c) {
  const settings = c.settings || {};
  const subject = settings.subject_line || '';
  const internal = settings.title || '';
  const link = c.archive_url || c.long_archive_url || '';
  if (!link) return false;
  if (HIDDEN_IDS.has(c.id)) return false;
  // Exclude unrelated brands sent on the same Mailchimp list.
  if (/\bboulder\b/i.test(internal)) return false;
  return (
    /^engage colorado\b/i.test(subject) ||
    /^engage(\s+colorado)?\s+newsletter\s+\d+/i.test(internal)
  );
}

function slugify({ title, pubDate, id }) {
  const date = (pubDate || '').slice(0, 10) || 'undated';
  const cleanTitle = (title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return `${date}-${cleanTitle}-${id}`;
}

function extractIdFromSlug(slug) {
  const m = /-([a-f0-9]{8,32})$/.exec(slug);
  return m ? m[1] : '';
}

// Mailchimp newsletter palette → Engage Colorado site palette.
// Applied at the proxy so prior campaigns render in the site palette when
// displayed on engagecolorado.org. Inbox copies and the public mailchi.mp
// archive are untouched (immutable).
const PALETTE_MAP = {
  '#003275': '#1a3a52', // primary navy → dusk-mountain blue
  '#001C4F': '#0f2638', // deep navy → deeper dusk
  '#001030': '#0a1a26', // darkest navy
  '#FFD525': '#b86b34', // gold → terracotta
  '#C7453B': '#1a3a52', // flag red → drop, replace with navy (depoliticize)
  '#3A7D5C': '#2d4a3e', // green → forest green
  '#3D4F6B': '#1f2937', // slate blue 1 → slate
  '#5C6A7E': '#718096', // slate blue 2 → light slate
  '#8FA3C4': '#9ab0c2', // light slate blue → desaturated
  '#B0C4E0': '#c5d2dd', // lighter slate blue → desaturated
  '#EAEEF4': '#f0f4f8', // very light blue → neutral light
  '#DDD8CE': '#e5e7eb', // beige → neutral hairline
  '#F7F5F0': '#fafaf7', // cream → warm off-white
};

function recolor(html) {
  if (!html) return html;
  let out = html;
  for (const [from, to] of Object.entries(PALETTE_MAP)) {
    out = out.replace(new RegExp(from, 'gi'), to);
  }
  return out;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  SITE_URL,
  DEFAULT_LIST_ID,
  HIDDEN_IDS,
  isEngageNewsletter,
  slugify,
  extractIdFromSlug,
  PALETTE_MAP,
  recolor,
  escapeHtml,
};
