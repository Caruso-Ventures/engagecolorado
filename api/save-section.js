// Server-side write path for the homepage content editor (/edit).
//
// The editor previously PATCHed ec_home_sections straight from the browser
// with the public anon key, gated only by a passphrase visible in the page
// source. This endpoint replaces that: the browser sends the passphrase in
// the x-edit-token header, the server compares it against EC_EDIT_TOKEN and
// writes with the service-role key.
//
// Go-live checklist (both required, in this order):
//   1. Set EC_EDIT_TOKEN and SUPABASE_TECH_DIR_KEY (service role for project
//      llnmuexkqbchmyzneiey) in Vercel project settings and redeploy.
//   2. Drop the anon UPDATE policy so direct writes stop working:
//        drop policy ec_home_sections_anon_update on public.ec_home_sections;

const SUPABASE_URL = 'https://llnmuexkqbchmyzneiey.supabase.co';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.EC_EDIT_TOKEN;
  const serviceKey = process.env.SUPABASE_TECH_DIR_KEY;
  if (!token || !serviceKey) {
    return res.status(503).json({
      error:
        'Editor not configured: set EC_EDIT_TOKEN and SUPABASE_TECH_DIR_KEY in Vercel project settings.',
    });
  }

  if ((req.headers['x-edit-token'] || '') !== token) {
    return res.status(401).json({ error: 'Wrong passphrase.' });
  }

  const body = req.body || {};

  // Passphrase check for the /edit gate — no write performed.
  if (body.verify) return res.status(200).json({ ok: true });

  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 0) {
    return res.status(400).json({ error: 'Invalid section id.' });
  }

  const clamp = (v, max) => String(v == null ? '' : v).slice(0, max);
  const patch = {
    title: clamp(body.title, 200),
    blurb: clamp(body.blurb, 2000),
    cta: clamp(body.cta, 100),
    updated_at: new Date().toISOString(),
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/ec_home_sections?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    return res.status(502).json({ error: `Save failed (${r.status}). ${text.slice(0, 200)}` });
  }
  return res.status(200).json({ ok: true });
};
