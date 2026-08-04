// Generates /sitemap.xml from the same Mailchimp campaign source the rest
// of the site uses, plus the static top-level pages. Served via vercel.json
// rewrite from /sitemap.xml → /api/sitemap.

const { SITE_URL, DEFAULT_LIST_ID, slugify, isEngageNewsletter } = require('./_lib.js');

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/articles', priority: '0.9', changefreq: 'weekly' },
  { path: '/investor-directory', priority: '0.8', changefreq: 'weekly' },
  { path: '/ensuring-colorado', priority: '0.8', changefreq: 'monthly' },
  { path: '/honest-assessment', priority: '0.7', changefreq: 'monthly' },
  { path: '/vision', priority: '0.7', changefreq: 'monthly' },
  { path: '/bear-roars', priority: '0.6', changefreq: 'monthly' },
  { path: '/related', priority: '0.6', changefreq: 'monthly' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
];

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchCampaigns(apiKey, listId) {
  const dc = apiKey.split('-').pop();
  if (!dc) return [];
  const url =
    `https://${dc}.api.mailchimp.com/3.0/campaigns` +
    `?status=sent&count=200&sort_field=send_time&sort_dir=DESC&list_id=${encodeURIComponent(listId)}` +
    `&fields=campaigns.id,campaigns.settings.subject_line,campaigns.settings.title,campaigns.archive_url,campaigns.long_archive_url,campaigns.send_time`;

  const r = await fetch(url, {
    headers: {
      Authorization: `apikey ${apiKey}`,
      'User-Agent': 'engagecolorado.vercel.app (sitemap)',
    },
  });
  if (!r.ok) return [];
  const data = await r.json();
  // Same predicate as /api/newsletters so the sitemap can never list a
  // campaign the articles page hides (or vice versa).
  return (data.campaigns || [])
    .filter(isEngageNewsletter)
    .map((c) => ({
      id: c.id || '',
      title: ((c.settings && (c.settings.subject_line || c.settings.title)) || '').trim(),
      pubDate: c.send_time || '',
    }));
}

module.exports = async function handler(req, res) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID || DEFAULT_LIST_ID;

  let articles = [];
  if (apiKey) {
    articles = await fetchCampaigns(apiKey, listId).catch(() => []);
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  for (const p of STATIC_PAGES) {
    urls.push(
      `  <url>\n` +
        `    <loc>${escapeXml(SITE_URL + p.path)}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>${p.changefreq}</changefreq>\n` +
        `    <priority>${p.priority}</priority>\n` +
        `  </url>`,
    );
  }

  for (const c of articles) {
    const loc = `${SITE_URL}/articles/${slugify(c)}`;
    const lastmod = (c.pubDate || '').slice(0, 10) || today;
    urls.push(
      `  <url>\n` +
        `    <loc>${escapeXml(loc)}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>yearly</changefreq>\n` +
        `    <priority>0.8</priority>\n` +
        `  </url>`,
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join('\n') +
    `\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
};
