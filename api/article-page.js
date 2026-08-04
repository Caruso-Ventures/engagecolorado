// Server-renders an Engage Colorado article page with per-article OG tags
// and inlined newsletter body. Replaces the client-side article.html flow
// so crawlers, link unfurlers, and AI agents see real content.

const fs = require('fs');
const path = require('path');
const { SITE_URL, slugify, extractIdFromSlug, recolor, escapeHtml } = require('./_lib.js');

const TEMPLATE_PATH = path.join(__dirname, '_article-template.html');

let TEMPLATE_HTML = '';
try {
  TEMPLATE_HTML = fs.readFileSync(TEMPLATE_PATH, 'utf8');
} catch (e) {
  console.error('article-page: failed to load article.html template', e);
}

// Conservative sanitizer. Mailchimp content is author-trusted but we strip
// anything that could break the parent page (script, style, frame containers,
// event handlers, javascript: URLs).
function sanitize(html) {
  if (!html) return '';
  let out = html;
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<title\b[\s\S]*?<\/title>/gi, '');
  out = out.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
  out = out.replace(/<object\b[\s\S]*?<\/object>/gi, '');
  out = out.replace(/<embed\b[^>]*\/?>/gi, '');
  out = out.replace(/<link\b[^>]*\/?>/gi, '');
  out = out.replace(/<meta\b[^>]*\/?>/gi, '');
  out = out.replace(/<base\b[^>]*\/?>/gi, '');
  out = out.replace(/<\/?(html|head|body)\b[^>]*>/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  out = out.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"');
  out = out.replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");
  // Force external links to open in a new tab (Mailchimp default).
  out = out.replace(/<a\b([^>]*?)>/gi, (m, attrs) => {
    if (/target\s*=/.test(attrs)) return `<a${attrs}>`;
    return `<a${attrs} target="_blank" rel="noopener">`;
  });
  return out;
}

// Mailchimp pads preview_text with repeated &nbsp;&zwnj; for inbox spacing.
// Strip that padding and trim to a clean description.
function cleanPreviewText(s) {
  if (!s) return '';
  let out = String(s);
  // Decode the most common Mailchimp padding patterns to their chars
  // so a single regex catches them regardless of escaping.
  out = out.replace(/&nbsp;|&#160;| /g, ' ').replace(/&zwnj;|&#8204;|‌/g, '');
  // Collapse runs of spaces from the now-removed padding.
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}

function plainText(html, maxLen) {
  if (!html) return '';
  // Drop script/style/title content first — their inner text is not body copy.
  // Also drop the Mailchimp hidden preview-text span (display:none holder).
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<title\b[\s\S]*?<\/title>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<span[^>]*style="[^"]*display\s*:\s*none[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<div[^>]*style="[^"]*display\s*:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  const t = cleanPreviewText(stripped.replace(/<[^>]+>/g, ' '));
  return t.length > maxLen ? t.slice(0, maxLen).replace(/\s+\S*$/, '') + '…' : t;
}

function formatDateDisplay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function fetchCampaign(apiKey, dc, id) {
  const auth = { Authorization: `apikey ${apiKey}`, 'User-Agent': 'engagecolorado.vercel.app (article-page SSR)' };
  const metaUrl =
    `https://${dc}.api.mailchimp.com/3.0/campaigns/${id}` +
    `?fields=id,settings.subject_line,settings.title,settings.preview_text,send_time,archive_url,long_archive_url`;
  const contentUrl = `https://${dc}.api.mailchimp.com/3.0/campaigns/${id}/content`;

  const [metaRes, contentRes] = await Promise.all([
    fetch(metaUrl, { headers: auth }),
    fetch(contentUrl, { headers: auth }),
  ]);

  if (!metaRes.ok) return null;
  const meta = await metaRes.json();
  const content = contentRes.ok ? await contentRes.json() : { html: '' };

  return {
    id: meta.id,
    title: ((meta.settings && (meta.settings.subject_line || meta.settings.title)) || 'Untitled').trim(),
    previewText: ((meta.settings && meta.settings.preview_text) || '').trim(),
    sendTime: meta.send_time || '',
    archiveUrl: meta.archive_url || meta.long_archive_url || '',
    html: content.html || '',
  };
}

function renderHTML({ campaign, canonicalUrl, canonicalPath }) {
  if (!TEMPLATE_HTML) return '<!doctype html><title>Template missing</title>';

  const title = campaign.title;
  const description =
    cleanPreviewText(campaign.previewText) ||
    plainText(campaign.html, 280) ||
    'Newsletter from Engage Colorado.';
  const ogImage = `${SITE_URL}/api/og?title=${encodeURIComponent(title)}`;
  const dateDisplay = formatDateDisplay(campaign.sendTime);
  const body = recolor(sanitize(campaign.html));

  const escTitle = escapeHtml(title);
  const escDesc = escapeHtml(description);
  const escCanonical = escapeHtml(canonicalUrl);
  const escOgImage = escapeHtml(ogImage);

  let html = TEMPLATE_HTML;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escTitle} — Engage Colorado</title>`);
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escDesc}" />`);
  html = html.replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="article" />`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escTitle}" />`);
  html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escDesc}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escCanonical}" />`);
  html = html.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escOgImage}" />`);
  html = html.replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escTitle}" />`);
  html = html.replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escDesc}" />`);
  html = html.replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escOgImage}" />`);

  if (!/<link rel="canonical"/i.test(html)) {
    html = html.replace(
      /<meta name="viewport"[^>]*>/,
      (m) => `${m}\n  <link rel="canonical" href="${escCanonical}" />`,
    );
  }

  // The slug URL (/articles/:slug) is one path-segment deep, so any
  // relative asset hrefs in the template (assets/site.css, articles.html,
  // index.html#anchor, etc.) would resolve under /articles/. Add a <base>
  // so they all resolve from the site root.
  html = html.replace(
    /<meta charset="UTF-8"[^>]*>/i,
    (m) => `${m}\n  <base href="/" />`,
  );

  html = html.replace(/<body>/, '<body data-ssr="1">');

  html = html.replace(
    /<h1 class="article-headline" id="articleHeadline">[\s\S]*?<\/h1>/,
    `<h1 class="article-headline" id="articleHeadline">${escTitle}</h1>`,
  );
  html = html.replace(
    /<div class="article-meta" id="articleMeta">[\s\S]*?<\/div>/,
    `<div class="article-meta" id="articleMeta">${escapeHtml(dateDisplay)}</div>`,
  );
  html = html.replace(
    /<div class="article-frame-wrap" id="frameWrap">[\s\S]*?<\/div>\s*<div class="article-footer">/,
    `<div class="article-frame-wrap" id="frameWrap">\n    <article class="article-body-inline">${body}</article>\n  </div>\n\n  <div class="article-footer">`,
  );

  return html;
}

function notFoundHTML() {
  return (
    '<!doctype html><meta charset="utf-8">' +
    '<title>Article not found — Engage Colorado</title>' +
    '<h1>Article not found</h1>' +
    '<p><a href="/articles.html">All articles</a></p>'
  );
}

module.exports = async function handler(req, res) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(503).send('Mailchimp API key not configured.');
  }
  const dc = apiKey.split('-').pop();
  if (!dc) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(503).send('Mailchimp API key malformed.');
  }

  const q = req.query || {};
  const rawId = String(q.id || '').trim();
  const rawSlug = String(q.slug || '').trim();

  let id = rawId;
  if (!id && rawSlug) id = extractIdFromSlug(rawSlug);

  if (!id || !/^[a-f0-9]{6,32}$/i.test(id)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(404).send(notFoundHTML());
  }

  const campaign = await fetchCampaign(apiKey, dc, id).catch(() => null);
  if (!campaign) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(404).send(notFoundHTML());
  }

  const canonicalSlug = slugify({ title: campaign.title, pubDate: campaign.sendTime, id: campaign.id });
  const canonicalPath = `/articles/${canonicalSlug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  // Legacy ?id= URL → 301 to canonical slug.
  if (rawId && !rawSlug) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Location', canonicalPath);
    return res.status(301).end();
  }
  // Stale slug (title changed) → 301 to current canonical.
  if (rawSlug && rawSlug !== canonicalSlug) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Location', canonicalPath);
    return res.status(301).end();
  }

  const html = renderHTML({ campaign, canonicalUrl, canonicalPath });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(html);
};

module.exports.slugify = slugify;
module.exports.extractIdFromSlug = extractIdFromSlug;
module.exports.sanitize = sanitize;
module.exports.cleanPreviewText = cleanPreviewText;
module.exports.plainText = plainText;
module.exports.renderHTML = renderHTML;
