export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  }

  const body = await request.json();
  const name = ((body.first_name || '') + ' ' + (body.last_name || '')).trim();

  if (!name) {
    return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
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
      title: body.title || null,
      company: body.company || null,
      email: body.email ? body.email.toLowerCase().trim() : null,
      tags: [],
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const err = await res.json();
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
