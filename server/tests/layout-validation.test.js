const test = require('node:test');
const assert = require('node:assert/strict');
const { assertPostUpdatedAt, assertTemplateNotInUse, safeMediaUrl, validatePostPayload, validateTemplatePayload, validateBlockContent } = require('../src/services/layout-validation.service');
const { buildPublicLayoutPostRouter } = require('../src/routes/layout-post-public.routes');

const validTemplate = () => ({
  name: '  Mẫu chính  ',
  description: null,
  schemaVersion: 1,
  blocks: [
    { id: 'a', type: 'header', x: 0, y: 0, w: 12, h: 3, align: 'left', props: { title: 'Tiêu đề', injected: 'bad' } },
    { id: 'b', type: 'text', x: 0, y: 4, w: 8, h: 6, align: 'center', props: { content: '<p>Nội dung</p>', extra: 'bad' } },
  ],
});

test('template validation trims name and strips unknown props', () => {
  const result = validateTemplatePayload(validTemplate());
  assert.equal(result.name, 'Mẫu chính');
  assert.deepEqual(result.blocks[0].props, { title: 'Tiêu đề' });
  assert.deepEqual(result.blocks[1].props, { content: '<p>Nội dung</p>' });
});

test('template validation rejects duplicate ids', () => {
  const payload = validTemplate();
  payload.blocks[1].id = 'a';
  assert.throws(() => validateTemplatePayload(payload), /id bị trùng/);
});

test('template validation rejects overlapping blocks with block-specific messages', () => {
  const payload = validTemplate();
  payload.blocks[1].y = 0;
  assert.throws(() => validateTemplatePayload(payload), /Block thứ 2.*chồng lên block a/);
});

test('template validation rejects invalid coordinates and unsupported types', () => {
  const payload = validTemplate();
  payload.blocks[1].x = 10;
  payload.blocks[1].type = 'unknown';
  assert.throws(() => validateTemplatePayload(payload), /loại block chưa được hỗ trợ/);
});

test('template validation rejects payloads over 200KB', () => {
  const payload = validTemplate();
  payload.blocks[1].props.content = 'a'.repeat(210 * 1024);
  assert.throws(() => validateTemplatePayload(payload), /200 KB/);
});

test('checkbox content rejects duplicate labels', () => {
  assert.throws(() => validateBlockContent('checkbox', { kind: 'checkbox', selections: [{ label: 'A', checked: false }, { label: 'A', checked: true }] }, { options: ['A', 'A'] }), /label trùng/);
});

test('checkbox content rejects more than ten selections', () => {
  assert.throws(() => validateBlockContent('checkbox', { kind: 'checkbox', selections: Array.from({ length: 11 }, (_, index) => ({ label: `A${index}`, checked: false })) }, { options: Array.from({ length: 11 }, (_, index) => `A${index}`) }), /too_big|10|number/i);
});

test('checkbox content rejects multiple checked values when disabled', () => {
  assert.throws(() => validateBlockContent('checkbox', { kind: 'checkbox', selections: [{ label: 'A', checked: true }, { label: 'B', checked: true }] }, { options: ['A', 'B'], allowMultiple: false }), /không cho phép/);
});

test('checkbox content strips unknown selection keys', () => {
  const result = validateBlockContent('checkbox', { kind: 'checkbox', selections: [{ label: 'A', checked: false, injected: '<script>' }] }, { options: ['A'] });
  assert.deepEqual(result.selections[0], { label: 'A', checked: false });
});

test('new block props allow valid configurations and strip foreign keys', () => {
  const payload = validTemplate();
  payload.blocks.push(
    { id: 'q', type: 'question', x: 0, y: 11, w: 6, h: 5, align: 'left', props: { templateId: '123e4567-e89b-12d3-a456-426614174000', heading: 'Hỏi', injected: 1 } },
    { id: 'c', type: 'checkbox', x: 6, y: 11, w: 6, h: 5, align: 'left', props: { options: ['A', 'B'], allowMultiple: false, injected: 1 } },
    { id: 'i', type: 'image', x: 0, y: 17, w: 6, h: 6, align: 'left', props: { fit: 'contain', ratio: '1:1', borderRadius: 12, injected: 1 } },
  );
  const result = validateTemplatePayload(payload);
  assert.deepEqual(result.blocks[2].props, { templateId: '123e4567-e89b-12d3-a456-426614174000', heading: 'Hỏi' });
  assert.deepEqual(result.blocks[3].props, { options: ['A', 'B'], allowMultiple: false });
  assert.deepEqual(result.blocks[4].props, { fit: 'contain', ratio: '1:1', borderRadius: 12 });
});

test('new block props reject invalid enums and excess options', () => {
  const cases = [
    ['question', { heading: 'x'.repeat(101) }],
    ['image', { fit: 'stretch' }],
    ['video', { ratio: '2:1' }],
    ['checkbox', { options: Array.from({ length: 11 }, (_, index) => `A${index}`) }],
  ];
  cases.forEach(([type, props]) => {
    const payload = validTemplate();
    payload.blocks.push({ id: type, type, x: 0, y: 30, w: 12, h: 2, align: 'left', props });
    assert.throws(() => validateTemplatePayload(payload), new RegExp(`${type}|lựa chọn|enum|Invalid`));
  });
});

const validPost = () => ({
  title: ' Bài thử ',
  layout: [{ id: 'text', type: 'text', x: 0, y: 0, w: 12, h: 4, align: 'left', props: { content: '' } }],
  content: { text: { kind: 'richText', html: '<p>Nội dung</p>' } },
  status: 'draft',
});

test('post validation rejects content kind mismatches and unknown block ids', () => {
  const wrongKind = validPost(); wrongKind.content.text = { kind: 'image', url: '', alt: '' };
  assert.throws(() => validatePostPayload(wrongKind), /content.kind/);
  const unknownBlock = validPost(); unknownBlock.content.unknown = { kind: 'richText', html: '' };
  assert.throws(() => validatePostPayload(unknownBlock), /không tồn tại trong layout/);
});

test('post validation sanitizes rich text and rejects javascript media URL', () => {
  const post = validPost(); post.content.text.html = '<p onerror="alert(1)">OK<script>alert(1)</script></p>';
  const result = validatePostPayload(post);
  assert.doesNotMatch(result.content.text.html, /script|onerror/i);
  const imagePost = { title: 'Ảnh', layout: [{ id: 'image', type: 'image', x: 0, y: 0, w: 6, h: 4, align: 'left', props: {} }], content: { image: { kind: 'image', url: 'javascript:alert(1)', alt: '' } } };
  assert.throws(() => validatePostPayload(imagePost), /URL ảnh/);
});

test('old question content is normalized to empty', () => {
  const post = { title: 'Hỏi', layout: [{ id: 'q', type: 'question', x: 0, y: 0, w: 6, h: 4, align: 'left', props: {} }], content: { q: { kind: 'question', prompt: 'cũ', required: true } } };
  assert.deepEqual(validatePostPayload(post).content.q, { kind: 'empty' });
});

test('post validation rejects total JSON over 1MB and stale updatedAt', () => {
  const post = validPost(); post.content.text.html = 'a'.repeat(101 * 1024);
  assert.throws(() => validatePostPayload(post), /100 KB/);
  const largePost = { title: 'Lớn', layout: [], content: {} };
  for (let index = 0; index < 11; index += 1) {
    largePost.layout.push({ id: `text-${index}`, type: 'text', x: 0, y: index * 2, w: 12, h: 1, align: 'left', props: {} });
    largePost.content[`text-${index}`] = { kind: 'richText', html: 'a'.repeat(99 * 1024) };
  }
  assert.throws(() => validatePostPayload(largePost), /1 MB/);
  assert.throws(() => assertPostUpdatedAt(new Date('2026-01-01'), '2026-01-02'), /Bài đã được sửa ở nơi khác/);
});

test('deleting a template in use reports a count-aware 409 error', () => {
  assert.throws(() => assertTemplateNotInUse(3), (error) => error.status === 409 && error.code === 'LAYOUT_TEMPLATE_IN_USE' && error.message === 'Mẫu đang được dùng bởi 3 bài');
});

test('internal upload URLs reject traversal, host-like paths, slashes, and controls', () => {
  ['/uploads/../secret.jpg', '/uploads/%2e%2e/secret.jpg', '/uploads//host/file.jpg', '/uploads/\\file.jpg', '/uploads/\u0000file.jpg'].forEach((value) => assert.throws(() => safeMediaUrl(value, 'Ảnh'), /không hợp lệ/));
  assert.equal(safeMediaUrl('/uploads/images/photo.jpg', 'Ảnh'), '/uploads/images/photo.jpg');
});

test('server media validator follows shared URL vectors', async () => {
  const { mediaUrlVectors } = await import('../../shared/layout-post-renderer/media-url-vectors.js');
  for (const vector of mediaUrlVectors) {
    if (vector.valid) assert.doesNotThrow(() => safeMediaUrl(vector.value, 'URL'));
    else assert.throws(() => safeMediaUrl(vector.value, 'URL'));
  }
});

test('richText sanitizes img schemes, links, scripts, handlers, and styles', () => {
  const post = validPost();
  post.content.text.html = '<p style="color:red;text-align:center" onerror="x"><img src="javascript:alert(1)" onerror="x"><img src="https://cdn.example/image.jpg"><a href="javascript:bad">bad</a><script>x</script></p>';
  const result = validatePostPayload(post);
  assert.doesNotMatch(result.content.text.html, /script|onerror|javascript:|color:red/i);
  assert.match(result.content.text.html, /text-align:center/);
  assert.match(result.content.text.html, /https:\/\/cdn\.example\/image\.jpg/);
});

test('published PUT path uses strict publish validation', () => {
  const post = validPost();
  post.status = 'published';
  post.title = '';
  assert.throws(() => validatePostPayload(post, { publishing: post.status === 'published' }), /Tiêu đề/);
});

test('optimistic locking accepts the exact response timestamp and rejects a 1ms-stale client', () => {
  assert.doesNotThrow(() => assertPostUpdatedAt(new Date('2026-01-01T10:00:00.100Z'), '2026-01-01T10:00:00.100Z'));
  assert.throws(() => assertPostUpdatedAt(new Date('2026-01-01T10:00:00.101Z'), '2026-01-01T10:00:00.100Z'), /Bài đã được sửa/);
});

test('public layout post route returns only published public fields', async () => {
  const express = require('express');
  const app = express();
  const model = { findOne: async ({ where }) => where.id === 'p1' && where.status === 'published' ? { toJSON: () => ({ id: 'p1', title: 'Public', layout: [], content: {}, publishedAt: '2026-01-01', createdBy: 'secret' }) } : null };
  app.use('/public', buildPublicLayoutPostRouter(model));
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/public/p1`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
    assert.deepEqual(Object.keys(body).sort(), ['content', 'id', 'layout', 'publishedAt', 'title']);
    const draft = await fetch(`http://127.0.0.1:${port}/public/draft`);
    assert.equal(draft.status, 404);
    assert.equal(draft.headers.get('cache-control'), 'no-store');
    const missing = await fetch(`http://127.0.0.1:${port}/public/missing`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('cache-control'), 'no-store');
  } finally { server.close(); }
});

test('public layout post questions endpoint uses only active shared templates', async () => {
  const express = require('express');
  const app = express();
  const postModel = { findOne: async ({ where }) => where.id === 'p1' && where.status === 'published' ? { layout: JSON.stringify([{ type: 'question', props: { templateId: 't1' } }]) } : (where.id === 'p2' ? { layout: [{ type: 'question', props: { templateId: 't2' } }] } : null) };
  const templateModel = { findOne: async ({ where }) => where.id === 't1' && where.isActive === true && where.guideId === null ? { id: 't1', name: 'Form', fields: [{ key: 'q', label: 'Câu hỏi', type: 'text', required: true, maxLength: 100 }] } : null };
  app.use('/public', buildPublicLayoutPostRouter(postModel, templateModel));
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const found = await fetch(`http://127.0.0.1:${port}/public/p1/questions`);
    assert.equal(found.status, 200);
    assert.equal(found.headers.get('cache-control'), 'public, max-age=60');
    assert.deepEqual(Object.keys(await found.json()).sort(), ['fields', 'id', 'name']);
    const inactive = await fetch(`http://127.0.0.1:${port}/public/p2/questions`);
    assert.equal(inactive.status, 200);
    assert.equal(inactive.headers.get('cache-control'), 'no-store');
    assert.equal(await inactive.text(), 'null');
    const missing = await fetch(`http://127.0.0.1:${port}/public/missing/questions`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('cache-control'), 'no-store');
  } finally { server.close(); }
});