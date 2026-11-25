const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildSearchRouter, parseSearchQuery } = require('../src/routes/search.routes');

const start = async (app, t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
};

test('search query parser applies defaults and validates input', () => {
  assert.deepEqual(parseSearchQuery({ type: 'guide', q: 'máy in' }), {
    type: 'guide', q: 'máy in', topic: '', page: 1, limit: 6,
  });
  assert.throws(() => parseSearchQuery({ type: 'blog', q: 'x'.repeat(101) }), { status: 400 });
  assert.throws(() => parseSearchQuery({ type: 'project', q: 'guide' }), { status: 400 });
  assert.throws(() => parseSearchQuery({ type: 'guide', page: '0' }), { status: 400 });
  assert.throws(() => parseSearchQuery({ type: 'guide', topic: 'Invalid Topic' }), { status: 400 });
});

test('search routes expose bounded suggestions and paginated ranked results', async (t) => {
  const calls = [];
  const contentSearch = {
    search: async query => {
      calls.push(query);
      return { items: [{ id: 'post-1' }], total: 1, page: query.page, totalPages: 1 };
    },
  };
  const app = express();
  app.use('/api/search', buildSearchRouter({ contentSearch }));
  const base = await start(app, t);

  const suggestions = await fetch(`${base}/api/search/suggestions?type=blog&q=may%20in`);
  assert.equal(suggestions.status, 200);
  assert.deepEqual(calls[0], { type: 'blog', q: 'may in', topic: '', page: 1, limit: 6 });
  assert.equal((await suggestions.json()).items[0].id, 'post-1');

  const results = await fetch(`${base}/api/search?type=guide&q=may%20in&page=2&limit=9&topic=cai-dat`);
  assert.equal(results.status, 200);
  assert.deepEqual(calls[1], { type: 'guide', q: 'may in', topic: 'cai-dat', page: 2, limit: 9 });

  const invalid = await fetch(`${base}/api/search/suggestions?type=unknown&q=test`);
  assert.equal(invalid.status, 400);
});