const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('../api/_lib.js');
const articlePage = require('../api/article-page.js');

// ── slugify / extractIdFromSlug ─────────────────────────────────────────

test('slugify builds date-title-id slugs', () => {
  assert.equal(
    lib.slugify({ title: 'Engage Colorado — Issue 2!', pubDate: '2026-06-01T12:00:00Z', id: 'abcdef1234' }),
    '2026-06-01-engage-colorado-issue-2-abcdef1234',
  );
});

test('slugify handles missing date and title', () => {
  assert.equal(lib.slugify({ title: '', pubDate: '', id: 'ff00ff00' }), 'undated-untitled-ff00ff00');
});

test('slugify truncates long titles without trailing dash', () => {
  const slug = lib.slugify({ title: 'x'.repeat(200) + ' end', pubDate: '2026-01-01', id: 'aa11' });
  assert.ok(slug.length <= '2026-01-01-'.length + 80 + '-aa11'.length);
  assert.ok(!/--aa11$/.test(slug));
});

test('extractIdFromSlug round-trips with slugify', () => {
  const id = 'deadbeef01';
  const slug = lib.slugify({ title: 'Some Title', pubDate: '2026-05-05', id });
  assert.equal(lib.extractIdFromSlug(slug), id);
});

test('extractIdFromSlug rejects non-hex tails', () => {
  assert.equal(lib.extractIdFromSlug('2026-01-01-hello-world'), '');
});

// ── isEngageNewsletter (shared by /api/newsletters and /sitemap.xml) ───

const campaign = (over) => ({
  id: 'c1',
  archive_url: 'https://mailchi.mp/x/y',
  settings: { subject_line: 'Engage Colorado: Issue 1', title: 'Engage Newsletter 1', preview_text: '' },
  ...over,
});

test('accepts the Engage Colorado subject prefix', () => {
  assert.ok(lib.isEngageNewsletter(campaign()));
});

test('accepts internal naming pattern when subject is candidate-led', () => {
  assert.ok(
    lib.isEngageNewsletter(
      campaign({ settings: { subject_line: 'Michael Dougherty for AG', title: 'Engage Newsletter 3' } }),
    ),
  );
});

test('rejects campaigns without an archive link', () => {
  assert.ok(!lib.isEngageNewsletter(campaign({ archive_url: '', long_archive_url: '' })));
});

test('rejects hidden campaign ids', () => {
  assert.ok(!lib.isEngageNewsletter(campaign({ id: 'ae6238b5a8' })));
});

test('rejects other brands on the same list (boulder)', () => {
  assert.ok(
    !lib.isEngageNewsletter(
      campaign({ settings: { subject_line: 'Engage Colorado special', title: 'Boulder Roots blast' } }),
    ),
  );
});

test('rejects unrelated campaigns', () => {
  assert.ok(
    !lib.isEngageNewsletter(campaign({ settings: { subject_line: 'Weekly digest', title: 'Digest 9' } })),
  );
});

// ── recolor ────────────────────────────────────────────────────────────

test('recolor maps the old palette case-insensitively', () => {
  assert.equal(lib.recolor('color:#FFD525;border:#ffd525'), 'color:#b86b34;border:#b86b34');
});

test('recolor leaves unknown colors alone', () => {
  assert.equal(lib.recolor('color:#123456'), 'color:#123456');
});

// ── sanitize (Mailchimp HTML → inlined article body) ───────────────────

test('sanitize strips script/style/iframe blocks', () => {
  const out = articlePage.sanitize(
    '<p>hi</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe>',
  );
  assert.equal(out.replace(/\s+/g, ''), '<p>hi</p>');
});

test('sanitize strips inline event handlers and javascript: URLs', () => {
  const out = articlePage.sanitize('<a href="javascript:alert(1)" onclick="x()">go</a>');
  assert.ok(!/onclick/i.test(out));
  assert.ok(!/javascript:/i.test(out));
});

test('sanitize forces target=_blank on links that lack one', () => {
  const out = articlePage.sanitize('<a href="https://example.com">x</a>');
  assert.ok(/target="_blank"/.test(out));
  assert.ok(/rel="noopener"/.test(out));
});

// ── renderHTML (guards the template ↔ SSR regex contract) ──────────────

test('renderHTML injects title, meta, and article body into the template', () => {
  const html = articlePage.renderHTML({
    campaign: {
      id: 'abc123ff',
      title: 'Test Issue <One> & Two',
      previewText: 'A preview',
      sendTime: '2026-06-01T12:00:00Z',
      archiveUrl: 'https://mailchi.mp/x',
      html: '<p>Body content here</p>',
    },
    canonicalUrl: 'https://www.engagecolorado.org/articles/2026-06-01-test-abc123ff',
    canonicalPath: '/articles/2026-06-01-test-abc123ff',
  });

  assert.ok(html.includes('<title>Test Issue &lt;One&gt; &amp; Two — Engage Colorado</title>'), 'title replaced');
  assert.ok(html.includes('property="og:title" content="Test Issue &lt;One&gt; &amp; Two"'), 'og:title replaced');
  assert.ok(html.includes('rel="canonical"'), 'canonical inserted');
  assert.ok(html.includes('<base href="/" />'), 'base tag inserted');
  assert.ok(html.includes('<body data-ssr="1">'), 'ssr marker set');
  assert.ok(html.includes('<article class="article-body-inline"><p>Body content here</p></article>'), 'body inlined');
  assert.ok(!html.includes('id="articleLoading"'), 'loading placeholder replaced');
  assert.ok(html.includes('June 1, 2026'), 'date rendered');
});
