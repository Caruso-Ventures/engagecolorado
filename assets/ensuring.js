// ── Tab routing ──────────────────────────────────────────
const TABS = ['home','letter','press','signatories','sign','contact'];

function showTab(name, navEl, skipHistory) {
  TABS.forEach(t => {
    document.getElementById('tab-'+t).classList.remove('active');
  });
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if (navEl) navEl.classList.add('active');
  if (!skipHistory) history.pushState({ tab: name }, '', '#' + name);
  window.scrollTo({top:0, behavior:'smooth'});
}

window.addEventListener('popstate', function(e) {
  var tab = (e.state && e.state.tab) || 'home';
  var navMap = { letter: 1, press: 2, signatories: 3, sign: 4, contact: 5 };
  var navEl = navMap[tab] ? document.querySelector('.nav-links a:nth-child(' + navMap[tab] + ')') : null;
  showTab(tab, navEl, true);
});

// ── Signatory data (loaded from Supabase) ────────────────
let SIGNATORIES = [];

async function loadSignatories() {
  try {
    const res = await fetch(
      'https://ebymnydncfxtbeoyugsc.supabase.co/rest/v1/v_ensuring_colorado_signatories?select=name,title,company,tags&order=name',
      { headers: { 'apikey': 'sb_publishable_FUy7Rkwm1fEcOEVtJpDepQ_RujArhHi' } }
    );
    if (!res.ok) throw new Error('Failed to fetch');
    SIGNATORIES = await res.json();
  } catch (e) {
    console.error('Failed to load signatories:', e);
    // Distinguish "couldn't load" from "none yet" so a network blip doesn't
    // render 'Be the first to add your name' over a 300-signature list.
    if (!SIGNATORIES.length) {
      var grid = document.getElementById('sig-grid');
      if (grid) grid.innerHTML = '<div class="sig-empty">Couldn\'t load signatories — please refresh to try again.</div>';
      return;
    }
  }
  renderSignatories();
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function initials(name) {
  return name.replace(/\(.*?\)/g, '').trim().split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase();
}

let activeFilters = new Set();

const makeCard = (s) => {
  const safeName = escapeHTML(s.name);
  return `
  <div class="sig-card">
    <div class="sig-avatar">${escapeHTML(initials(s.name))}</div>
    <div>
      <div class="sig-name">${safeName}</div>
      ${s.title ? `<div class="sig-title">${escapeHTML(s.title)}</div>` : ''}
    </div>
  </div>`;
};

function setFilter(btn) {
  const f = btn.dataset.filter;
  if (f === 'all') {
    activeFilters.clear();
    document.querySelectorAll('.sig-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else {
    document.querySelector('.sig-filter-btn[data-filter="all"]').classList.remove('active');
    if (activeFilters.has(f)) {
      activeFilters.delete(f);
      btn.classList.remove('active');
      if (activeFilters.size === 0) {
        document.querySelector('.sig-filter-btn[data-filter="all"]').classList.add('active');
      }
    } else {
      activeFilters.add(f);
      btn.classList.add('active');
    }
  }
  filterSignatories();
}

function filterSignatories() {
  const query = (document.getElementById('sig-search')?.value || '').toLowerCase();
  const grid = document.getElementById('sig-grid');
  if (!grid) return;
  const filtered = SIGNATORIES.filter(s => {
    const matchesTag = (s.tags || []).some(t => activeFilters.has(t));
    const matchesFilter = activeFilters.size === 0 || matchesTag;
    const matchesSearch = !query ||
      s.name.toLowerCase().includes(query) ||
      (s.title || '').toLowerCase().includes(query) ||
      (s.company || '').toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });
  const countEl = document.getElementById('sig-count-num');
  if (countEl) countEl.textContent = 'Showing ' + filtered.length;
  grid.innerHTML = filtered.length
    ? filtered.map(makeCard).join('')
    : '<div class="sig-empty">No signatories match your search.</div>';
}

function renderSignatories() {
  const count = SIGNATORIES.length;
  document.getElementById('sig-count-num').textContent = 'Showing ' + count;
  document.getElementById('hero-count').textContent = (Math.floor(count / 10) * 10) + '+';
  const fc = document.getElementById('featured-count');
  const ac = document.getElementById('all-count');
  if (fc) fc.textContent = count;
  if (ac) ac.textContent = count;

  const preview = document.getElementById('home-sig-preview');

  if (count === 0) {
    filterSignatories();
    if (preview) preview.innerHTML = '<div class="sig-empty" style="padding:24px 0;font-size:0.88rem;">Be the first to add your name.</div>';
    return;
  }

  var ceos = 0, founders = 0, cofounders = 0, partners = 0, chairs = 0;
  SIGNATORIES.forEach(function(s) {
    var t = (s.title || '') + ' ' + (s.company || '');
    if (/\bCEO\b/i.test(t)) ceos++;
    if (/\bFounder\b/i.test(t)) founders++;
    if (/\bCo-Founder\b/i.test(t)) cofounders++;
    if ((s.tags || []).includes('investor') && !/\bVice President\b/i.test(t) && !/\bPrincipal\b/i.test(t)) partners++;
    if (/\bChair/i.test(t)) chairs++;
  });
  var el;
  if ((el = document.getElementById('stat-ceos'))) el.textContent = ceos;
  if ((el = document.getElementById('stat-founders'))) el.textContent = founders;
  if ((el = document.getElementById('stat-cofounders'))) el.textContent = cofounders;
  if ((el = document.getElementById('stat-partners'))) el.textContent = partners;
  if ((el = document.getElementById('stat-chairs'))) el.textContent = chairs;

  filterSignatories();
  if (preview) preview.innerHTML = SIGNATORIES.slice(0,8).map(makeCard).join('');
}

// ── Sign form ────────────────────────────────────────────
async function handleSignSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  const errEl = document.getElementById('sign-error');
  if (errEl) errEl.classList.remove('visible');
  btn.textContent = 'Submitting…';
  btn.disabled = true;

  const data = new FormData(form);
  const first = data.get('first_name') || '';
  const last  = data.get('last_name')  || '';
  const title = data.get('title')      || '';
  const co    = data.get('company')    || '';
  const email = data.get('email')      || '';
  const note  = data.get('note')       || '';
  const website = data.get('website')  || '';

  // The signatory API is the source of truth for the public list — if it
  // fails, tell the user instead of showing a false success.
  let failMsg = '';
  try {
    const res = await fetch('/api/add-signatory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: first, last_name: last, title, company: co, email, note, website }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      failMsg = body.error || ('Submission failed (' + res.status + '). Please try again.');
    }
  } catch (_) {
    failMsg = 'Could not reach the server. Please check your connection and try again.';
  }

  if (failMsg) {
    btn.textContent = 'Submit My Signature';
    btn.disabled = false;
    if (errEl) {
      errEl.textContent = failMsg;
      errEl.classList.add('visible');
    }
    return;
  }

  // Notify the team inbox (best-effort — the signature is already recorded).
  const formAction = form.getAttribute('action');
  if (formAction && !formAction.includes('YOUR_FORM_ID')) {
    try {
      await fetch(formAction, {
        method: 'POST', body: data,
        headers: { 'Accept': 'application/json' }
      });
    } catch(_) {}
  }

  form.style.display = 'none';
  const success = document.getElementById('sign-success');
  const detail = success.querySelector('[data-sign-success-detail]');
  if (detail) {
    detail.textContent = 'Your signature has been received and is pending review. '
      + 'Your name will appear on the letter once confirmed.';
  }
  success.style.display = 'block';
}

// ── Contact form ─────────────────────────────────────────
function selectContact(el, val) {
  document.querySelectorAll('.contact-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('contact_type_val').value = val;
}

async function handleContactSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  const errEl = document.getElementById('contact-error');
  if (errEl) errEl.classList.remove('visible');
  btn.textContent = 'Sending…';
  btn.disabled = true;
  let ok = false;
  try {
    const res = await fetch(form.getAttribute('action'), {
      method: 'POST', body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    });
    ok = res.ok;
  } catch(_) {}
  if (!ok) {
    btn.textContent = 'Send Message';
    btn.disabled = false;
    if (errEl) {
      errEl.textContent = 'Your message could not be sent. Please try again, or email kendall@carusoventures.com directly.';
      errEl.classList.add('visible');
    }
    return;
  }
  form.style.display = 'none';
  document.getElementById('contact-success').style.display = 'block';
}

// ── Share actions ────────────────────────────────────────
const SHARE_URL = encodeURIComponent(window.location.href);
const SHARE_TEXT = encodeURIComponent("Colorado leaders are calling on state officials to secure our innovation future. Read the open letter and add your name.");

function shareLinkedIn(e) {
  e.preventDefault();
  window.open('https://www.linkedin.com/sharing/share-offsite/?url='+SHARE_URL, '_blank', 'width=600,height=500');
}
function shareX(e) {
  e.preventDefault();
  window.open('https://twitter.com/intent/tweet?text='+SHARE_TEXT+'&url='+SHARE_URL, '_blank', 'width=600,height=400');
}
function shareEmail(e) {
  e.preventDefault();
  window.location.href = 'mailto:?subject=Ensuring%20Colorado%27s%20Innovation%20Future&body='+SHARE_TEXT+'%20'+SHARE_URL;
}
function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const el = document.getElementById('copy-label');
    if (el) { el.textContent = 'Copied!'; setTimeout(() => el.textContent = 'Copy Link', 2000); }
  });
}

function openPrintWindow(html) {
  var w = window.open('', '_blank');
  if (!w) {
    alert('Please allow pop-ups for this site to print.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.setTimeout(function() { w.print(); }, 300);
}

function printJointStatement() {
  var content = document.querySelector('#tab-press .letter-body').innerHTML;
  var title = document.querySelector('#tab-press .letter-inner h2').textContent;
  var html = '<!DOCTYPE html><html><head><title>' + title + '</title><style>body{font-family:sans-serif;margin:40px;color:#1a1a2e;line-height:1.7;max-width:800px;margin:40px auto;}h1{font-size:1.5rem;margin-bottom:24px;color:#0a1a26;}ol{padding-left:20px;}ol li{margin-bottom:10px;}p{margin-bottom:16px;}</style></head><body><h1>' + title + '</h1>' + content + '</body></html>';
  openPrintWindow(html);
}

function exportSignatories() {
  if (!SIGNATORIES.length) return;
  var rows = SIGNATORIES.map(function(s) {
    return '<tr><td style="padding:6px 16px 6px 0;font-weight:600;border-bottom:1px solid #eee;">' + escapeHTML(s.name) + '</td><td style="padding:6px 0;color:#555;border-bottom:1px solid #eee;">' + escapeHTML(s.title || '') + '</td></tr>';
  }).join('');
  var html = '<!DOCTYPE html><html><head><title>Signatories - Ensuring Colorado\'s Innovation Future</title><style>body{font-family:sans-serif;margin:40px;color:#1a1a2e;}h1{font-size:1.5rem;margin-bottom:4px;}p{color:#555;margin-bottom:24px;}table{border-collapse:collapse;width:100%;}</style></head><body><h1>Ensuring Colorado\'s Innovation Future</h1><p>' + SIGNATORIES.length + ' Signatories</p><table>' + rows + '</table></body></html>';
  openPrintWindow(html);
}

// ── Init ─────────────────────────────────────────────────
// (admin/session probe dropped — this is the public page ported natively into Engage Colorado)
loadSignatories();

// ── Load tab from URL hash ──────────────────────────────
(function() {
  var hash = window.location.hash.replace('#', '');
  if (hash && TABS.indexOf(hash) !== -1 && hash !== 'home') {
    var navMap = { letter: 1, press: 2, signatories: 3, sign: 4, contact: 5 };
    var navEl = navMap[hash] ? document.querySelector('.nav-links a:nth-child(' + navMap[hash] + ')') : null;
    showTab(hash, navEl, true);
  }
  history.replaceState({ tab: hash || 'home' }, '');
})();
