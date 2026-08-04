// Public sign-ups for the Ensuring Colorado open letter.
//
// Submissions go to a review queue in CV Central and are published only after a
// human approves them — they never land straight on the public letter. We hold a
// token scoped to one CV Central edge function rather than a service_role key,
// because this endpoint is public and unauthenticated.

function esc(v) {
  return String(v == null ? '' : v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function recipients() {
  return (process.env.ENSURING_COLORADO_NOTIFY_TO || '')
    .split(',').map((x) => x.trim()).filter(Boolean);
}

function reviewBase(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `https://${host}/api/review-signature` : '';
}

async function notify(submission, queued, links) {
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.ENSURING_COLORADO_NOTIFY_TO || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || to.length === 0) return;

  const name = `${submission.first_name} ${submission.last_name}`.trim();
  const matched = queued.matched_person_name
    ? `${queued.matched_person_name} (${queued.match_tier})`
    : 'no match — approving will create a new person';

  const rows = [
    ['Name', name],
    ['Email', submission.email],
    ['Title', submission.title || '—'],
    ['Company', submission.company || '—'],
    ['Note', submission.note || '—'],
    ['Matched existing person', matched],
  ].map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`).join('');

  // One email per recipient: the approve/reject links are bound to that address,
  // so a forwarded message is distinguishable from the addressee's own click.
  const sends = to.map((addr) => {
    const pair = (links || {})[addr] || {};
    const buttons = pair.approve && pair.reject
      ? `<p style="margin:20px 0">
           <a href="${pair.approve}" style="background:#15803d;color:#fff;padding:10px 18px;
              border-radius:6px;text-decoration:none;margin-right:10px">Approve</a>
           <a href="${pair.reject}" style="background:#b91c1c;color:#fff;padding:10px 18px;
              border-radius:6px;text-decoration:none">Reject</a>
         </p>`
      : '<p>Queue: <code>v_ensuring_colorado_pending_signatures</code> in CV Central.</p>';

    return fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Ensuring Colorado <dev@carusoventures.com>',
        to: [addr],
        subject: `New Ensuring Colorado signature — ${name}`,
        html: `<p>Awaiting review. <strong>Not</strong> on the public letter until approved.</p>
               <table cellpadding="6">${rows}</table>
               ${buttons}
               <p style="font-size:13px;color:#6b7280">Links last 72 hours. Nothing changes
               until you confirm on the page they open.</p>`,
      }),
    });
  });

  // One recipient's mail failing must not stop the others.
  await Promise.allSettled(sends);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const brokerUrl = process.env.CV_BROKER_URL;
  const brokerToken = process.env.ENSURING_COLORADO_BROKER_TOKEN;
  if (!brokerUrl || !brokerToken) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const submission = {
    first_name: (body.first_name || '').trim(),
    last_name: (body.last_name || '').trim(),
    email: (body.email || '').trim().toLowerCase(),
    title: body.title || null,
    company: body.company || null,
    note: body.note || null,
    website: body.website || null,
  };

  if (!submission.first_name || !submission.last_name) {
    res.status(400).json({ error: 'First and last name are required.' });
    return;
  }
  if (!submission.email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  let queued;
  try {
    const upstream = await fetch(brokerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${brokerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...submission, notify_to: recipients(), review_base: reviewBase(req) }),
    });
    queued = await upstream.json();
    if (!upstream.ok || queued.status === 'error') {
      res.status(upstream.status === 400 ? 400 : 502)
        .json({ error: queued.error || 'Could not record your signature.' });
      return;
    }
  } catch (_) {
    res.status(502).json({ error: 'Could not reach the signature service.' });
    return;
  }

  // The signature is recorded; a failed notification must not report failure.
  if (queued.status === 'pending' && !queued.resubmitted) {
    try {
      await notify(submission, queued, queued.review_links);
    } catch (e) {
      console.error('notify failed (signature is recorded):', e);
    }
  }

  res.status(200).json({ status: queued.status });
};
