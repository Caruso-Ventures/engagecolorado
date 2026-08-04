const { DEFAULT_LIST_ID, isEngageNewsletter } = require('./_lib.js');

module.exports = async function handler(req, res) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID || DEFAULT_LIST_ID;

  if (!apiKey) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      campaigns: [],
      warning:
        'MAILCHIMP_API_KEY is not configured on this deployment. Add it in Vercel project settings.',
    });
  }

  const dc = apiKey.split('-').pop();
  if (!dc) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      campaigns: [],
      error: 'MAILCHIMP_API_KEY is missing the datacenter suffix (e.g. abcd1234-us18).',
    });
  }

  const url =
    `https://${dc}.api.mailchimp.com/3.0/campaigns` +
    `?status=sent&count=25&sort_field=send_time&sort_dir=DESC&list_id=${encodeURIComponent(listId)}` +
    `&fields=campaigns.id,campaigns.settings.subject_line,campaigns.settings.title,campaigns.settings.preview_text,campaigns.archive_url,campaigns.long_archive_url,campaigns.send_time`;

  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `apikey ${apiKey}`,
        'User-Agent': 'engagecolorado.vercel.app (newsletter fetcher)',
      },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({
        campaigns: [],
        warning: `Mailchimp API returned ${r.status}. ${text.slice(0, 240)}`,
      });
    }

    const data = await r.json();
    const campaigns = (data.campaigns || [])
      .filter(isEngageNewsletter)
      .map((c) => ({
        id: c.id || '',
        title:
          (c.settings && (c.settings.subject_line || c.settings.title)) || 'Untitled',
        link: c.archive_url || c.long_archive_url || '',
        pubDate: c.send_time || '',
        description: (c.settings && c.settings.preview_text) || '',
      }));

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({ campaigns });
  } catch (err) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      campaigns: [],
      error: String((err && err.message) || err),
    });
  }
};
