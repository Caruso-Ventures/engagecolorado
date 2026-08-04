// Confirm page for approving or rejecting a signature from the notification email.
//
// This page lives on the site, not on CV Central, because Supabase's function
// gateway forces `default-src 'none'; sandbox` onto HTML responses and `sandbox`
// without allow-forms kills form submission. Here we control the headers.
//
// The site holds no secret and cannot mint a link: it relays the token to CV
// Central, which verifies it and performs the decision. GET only reads — mail
// clients and security scanners prefetch links, and a prefetch must never publish
// someone to a public letter.

const REVIEW_FN = 'https://ebymnydncfxtbeoyugsc.supabase.co/functions/v1/ensuring-colorado-review';

function esc(v) {
  return String(v == null ? '' : v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const STYLE = `body{font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
max-width:34rem;margin:3rem auto;padding:0 1.25rem;color:#1f2937}
h1{font-size:1.35rem;margin:0 0 1rem}
dl{display:grid;grid-template-columns:auto 1fr;gap:.4rem 1rem;margin:0 0 1.5rem}
dt{font-weight:600;color:#4b5563}dd{margin:0;overflow-wrap:anywhere}
.warn{background:#fef3c7;border-left:3px solid #d97706;padding:.75rem 1rem;margin:0 0 1.5rem}
button{font:inherit;padding:.7rem 1.4rem;border:0;border-radius:6px;color:#fff;cursor:pointer}
.approve{background:#15803d}.reject{background:#b91c1c}
footer{margin-top:2rem;font-size:.85rem;color:#6b7280}`;

const FALLBACK = `<footer>If this is not what you expected, leave it — nothing has changed.
Signatures stay in the review queue until someone decides.</footer>`;

function send(res, status, title, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Our own CSP, which actually reaches the browser here. No external references,
  // which also stops the token leaking through Referer.
  res.setHeader('Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(status).send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`);
}

module.exports = async function handler(req, res) {
  const token = req.method === 'POST'
    ? (req.body && (req.body.t || (typeof req.body === 'string' && new URLSearchParams(req.body).get('t'))))
    : (req.query && req.query.t);

  if (!token) {
    send(res, 400, 'Missing link', '<h1>This link is incomplete</h1>' + FALLBACK);
    return;
  }

  if (req.method === 'GET') {
    let data;
    try {
      const r = await fetch(`${REVIEW_FN}?t=${encodeURIComponent(token)}&format=json`);
      data = await r.json();
    } catch (_) {
      send(res, 502, 'Unavailable', '<h1>Could not reach the review service</h1>' + FALLBACK);
      return;
    }

    if (data.status === 'already_decided') {
      const when = data.decided_at ? new Date(data.decided_at).toUTCString() : 'earlier';
      send(res, 200, 'Already decided',
        `<h1>Already ${esc(data.decided)}</h1><p><strong>${esc(data.request && data.request.name)}</strong>
         was ${esc(data.decided)} ${esc(when)}${data.decided_by ? ` by ${esc(data.decided_by)}` : ''}.
         Nothing has changed.</p>` + FALLBACK);
      return;
    }
    if (data.status !== 'ok') {
      const msg = data.reason === 'expired'
        ? `<h1>This link has expired</h1><p>Approval links last 72 hours. The signature is
           still in the review queue — nothing was lost and nothing has changed.</p>`
        : `<h1>This link isn't valid</h1><p>It may have been altered in transit.
           Nothing has changed.</p>`;
      send(res, 400, 'Link not valid', msg + FALLBACK);
      return;
    }

    const q = data.request || {};
    const verb = data.action === 'approve' ? 'Approve' : 'Reject';
    send(res, 200, `${verb} signature`, `
      <h1>${esc(verb)} this signature?</h1>
      <dl>
        <dt>Name</dt><dd>${esc(q.name)}</dd>
        <dt>Email</dt><dd>${esc(q.email)}</dd>
        <dt>Title</dt><dd>${esc(q.title || '—')}</dd>
        <dt>Company</dt><dd>${esc(q.company || '—')}</dd>
        <dt>Note</dt><dd>${esc(q.note || '—')}</dd>
      </dl>
      <p>${data.action === 'approve'
        ? 'Approving publishes this name on the public letter.'
        : 'Rejecting leaves the letter unchanged and creates no record for this person.'}</p>
      <form method="POST">
        <input type="hidden" name="t" value="${esc(token)}">
        <button class="${esc(data.action)}" type="submit">${esc(verb)}</button>
      </form>
      <footer>Nothing has happened yet — this only takes effect when you press the button.</footer>`);
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, 'Not allowed', '<h1>Method not allowed</h1>');
    return;
  }

  let outcome;
  try {
    const form = new URLSearchParams({ t: token });
    const r = await fetch(REVIEW_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    outcome = { ok: r.ok, html: await r.text() };
  } catch (_) {
    send(res, 502, 'Unavailable', '<h1>Could not reach the review service</h1>' + FALLBACK);
    return;
  }

  // CV Central renders its own outcome HTML; it contains no form, so the gateway's
  // sandbox header is harmless. Pass it through rather than re-deriving the result.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(outcome.ok ? 200 : 502).send(outcome.html);
};
