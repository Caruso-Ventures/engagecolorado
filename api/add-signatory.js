export const config = { runtime: 'edge' };

const MAX = { name: 100, title: 200, company: 200, email: 320 };

function clamp(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const name = (clamp(body.first_name, MAX.name) + ' ' + clamp(body.last_name, MAX.name)).trim();
  if (!name) {
    return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
  }

  const email = clamp(body.email, MAX.email).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400 });
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/signatories`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      name,
      title: clamp(body.title, MAX.title) || null,
      company: clamp(body.company, MAX.company) || null,
      email: email || null,
      tags: [],
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err.message || '').includes('duplicate')
      ? 'A signatory with that name already exists.'
      : (err.message || 'Failed to add');
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
