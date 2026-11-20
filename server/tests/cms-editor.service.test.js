const test = require('node:test');
const assert = require('node:assert/strict');
const slugify = require('../src/utils/slugify');
const {
  sanitizeContent, readingTime, assertStatus, buildSlug, normalizeCmsFields, validateCmsImageUrl,
} = require('../src/services/cms-post.service');
const { assertCmsImageBuffer, MAX_IMAGE_BYTES } = require('../src/services/cms-upload.service');
const { requireRoles } = require('../src/middleware/require-admin.middleware');
const { publishDue } = require('../src/services/cms-scheduler.service');

test('slugify: converts Vietnamese text into a stable URL slug', () => {
  assert.equal(slugify('  Hướng dẫn Đổi Mực In 2026!  '), 'huong-dan-doi-muc-in-2026');
});

test('buildSlug: appends a suffix for a duplicate slug', async () => {
  const seen = new Set(['huong-dan']);
  const Model = { findOne: async ({ where }) => (seen.has(where.slug) ? { id: 'other' } : null) };
  assert.equal(await buildSlug(Model, 'Hướng dẫn', 'huong-dan'), 'huong-dan-2');
});

test('readingTime: returns one minute minimum and rounds by 200 words', () => {
  assert.equal(readingTime(''), '1 min');
  assert.equal(readingTime(`<p>${Array(201).fill('word').join(' ')}</p>`), '2 min');
});

test('sanitizeContent: removes scripts, event handlers, and javascript URLs', () => {
  const html = sanitizeContent('<p onclick="alert(1)">ok</p><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)">');
  assert.match(html, /^<p>ok<\/p><img \/>$/);
  assert.doesNotMatch(html, /script|onerror|onclick|javascript:/i);
});

test('sanitizeContent: preserves an approved YouTube iframe only', () => {
  const html = sanitizeContent('<iframe src="https://www.youtube-nocookie.com/embed/abc123" onload="alert(1)"></iframe><iframe src="https://evil.example/embed/x"></iframe><iframe src="https://youtube.com/watch?v=x"></iframe>');
  assert.match(html, /youtube-nocookie\.com\/embed\/abc123/);
  assert.doesNotMatch(html, /onload|evil\.example|watch\?v/);
});

test('status and scheduledAt: reject invalid status and require a valid schedule', async () => {
  assert.throws(() => assertStatus('deleted'), { status: 400 });
  const Model = { findOne: async () => null };
  await assert.rejects(() => normalizeCmsFields(Model, { title: 'Bài viết', content: '<p>Nội dung</p>', status: 'scheduled' }), { status: 400 });
  const result = await normalizeCmsFields(Model, { title: 'Bài viết', content: '<p>Nội dung</p>', status: 'scheduled', scheduledAt: '2030-01-01T00:00:00.000Z' });
  assert.equal(result.status, 'scheduled');
});

test('image upload validation: rejects invalid magic bytes and files above 5 MB', () => {
  assert.throws(() => assertCmsImageBuffer(Buffer.from('not an image')), { status: 400 });
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(MAX_IMAGE_BYTES)]);
  assert.throws(() => assertCmsImageBuffer(png), { status: 413 });
});

test('CMS roles: rejects a user without editor permission', () => {
  let status; let payload; let called = false;
  requireRoles('owner', 'editor')({ user: { role: 'support' } }, { status: code => { status = code; return { json: body => { payload = body; } }; } }, () => { called = true; });
  assert.equal(status, 403); assert.match(payload.message, /quyền/); assert.equal(called, false);
});

test('CMS image URLs: require the configured CMS R2 prefix', () => {
  const old = process.env.R2_PUBLIC_BASE_URL;
  process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.com/assets';
  assert.doesNotThrow(() => validateCmsImageUrl('https://cdn.example.com/assets/cms/content/a.webp', 'Ảnh'));
  assert.throws(() => validateCmsImageUrl('https://cdn.example.com/assets/projects/a.webp', 'Ảnh'), { status: 400 });
  if (old === undefined) delete process.env.R2_PUBLIC_BASE_URL; else process.env.R2_PUBLIC_BASE_URL = old;
});

test('scheduler: only the instance that claims a due post creates a revision', async () => {
  const post = { id: 'a', authorId: 'author', publishedAt: null };
  const calls = [];
  const Model = {
    findAll: async () => [post],
    update: async (_values, options) => { calls.push(options.where); return [0]; },
    findByPk: async () => { throw new Error('must not load unclaimed post'); },
  };
  assert.equal(await publishDue(Model, 'blog'), 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 'scheduled');
});

test('autosave: uses a numeric CMS version as its optimistic-lock token', async () => {
  const { autosavePost } = require('../src/services/cms-post.service');
  let where;
  const Model = { update: async (_values, options) => { where = options.where; return [0]; } };
  await assert.rejects(() => autosavePost(Model, 'id', { title: 'T', content: '<p>Nội dung</p>', expectedVersion: 3 }), { status: 409 });
  assert.equal(where.cmsVersion, 3);
});