// Palette recoloring lives in _lib.js (shared with the SSR article page).
const { recolor } = require('./_lib.js');

module.exports = async function handler(req, res) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      html: '',
      warning:
        'MAILCHIMP_API_KEY is not configured on this deployment. Add it in Vercel project settings.',
    });
  }

  const id = (req.query && req.query.id) || '';
  if (!id || !/^[a-f0-9]{1,64}$/i.test(id)) {
    return res.status(400).json({ html: '', error: 'invalid or missing id' });
  }

  const dc = apiKey.split('-').pop();
  if (!dc) {
    return res.status(500).json({
      html: '',
      error: 'MAILCHIMP_API_KEY is missing the datacenter suffix.',
    });
  }

  const url = `https://${dc}.api.mailchimp.com/3.0/campaigns/${id}/content`;

  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `apikey ${apiKey}`,
        'User-Agent': 'engagecolorado.vercel.app (campaign content)',
      },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(200).json({
        html: '',
        warning: `Mailchimp API returned ${r.status}. ${text.slice(0, 240)}`,
      });
    }

    const data = await r.json();
    // 5-minute fresh cache + 1-hour stale-while-revalidate. Protects
    // against Mailchimp API rate limits under traffic spikes (e.g. press
    // coverage). New palette changes propagate within 5 minutes globally.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.setHeader('x-recolored', '1');
    return res.status(200).json({
      html: recolor(data.html || ''),
      plain_text: data.plain_text || '',
    });
  } catch (err) {
    return res.status(200).json({
      html: '',
      error: String((err && err.message) || err),
    });
  }
};
