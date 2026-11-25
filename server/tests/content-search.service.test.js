const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createContentSearch,
  normalizeSearchText,
  rankContent,
} = require('../src/services/content-search.service');

const documents = [
  {
    id: 'guide-printer',
    slug: 'cach-ket-noi-may-in-bill',
    title: 'Cách kết nối máy in bill qua Bluetooth',
    excerpt: 'Hướng dẫn cài đặt máy in hóa đơn cho cửa hàng.',
    tags: ['máy in bill', 'Bluetooth'],
    topic: { name: 'Cài Đặt Máy In', slug: 'cai-dat-may-in' },
    publishedAt: '2026-11-23T00:00:00.000Z',
  },
  {
    id: 'guide-checkout',
    slug: 'cai-dat-thanh-toan',
    title: 'Cài đặt thanh toán cho cửa hàng',
    excerpt: 'Tích hợp nhiều phương thức thanh toán.',
    tags: ['cửa hàng'],
    topic: { name: 'Thanh toán', slug: 'thanh-toan' },
    publishedAt: '2026-11-24T00:00:00.000Z',
  },
  {
    id: 'guide-topic-match',
    slug: 'bao-tri-may-in',
    title: 'Bảo trì thiết bị bán hàng',
    excerpt: 'Cách bảo quản thiết bị.',
    tags: ['bảo trì'],
    topic: { name: 'Máy in hóa đơn', slug: 'may-in-hoa-don' },
    publishedAt: '2026-11-22T00:00:00.000Z',
  },
];

test('normalizeSearchText ignores Vietnamese accents and punctuation', () => {
  assert.equal(normalizeSearchText('  HƯỚNG DẪN: cài đặt máy-in  '), 'huong dan cai dat may in');
});

test('rankContent matches accented titles and tags from an unaccented query', () => {
  const results = rankContent('guide', documents, 'ket noi may in bill');
  assert.equal(results[0].item.id, 'guide-printer');
  assert.equal(results[0].matchedBy, 'title');
  assert.ok(results.some(result => result.item.id === 'guide-topic-match'));
});

test('rankContent prioritizes a title match over a topic match', () => {
  const results = rankContent('guide', documents, 'may in hoa don');
  assert.equal(results[0].item.id, 'guide-printer');
  assert.equal(results[0].matchedBy, 'title');
  assert.ok(results.some(result => result.item.id === 'guide-topic-match'));
});

test('rankContent tolerates a one-character typo and filters by guide topic', () => {
  const fuzzy = rankContent('guide', documents, 'bluetoth');
  assert.equal(fuzzy[0].item.id, 'guide-printer');

  const filtered = rankContent('guide', documents, 'may in', { topic: 'thanh-toan' });
  assert.ok(filtered.every(result => result.item.topic.slug === 'thanh-toan'));
});

test('rankContent matches the opening article text without returning it in results', async () => {
  let calls = 0;
  const model = {
    findAll: async options => {
      calls += 1;
      assert.ok(options.attributes.some(attribute => Array.isArray(attribute) && attribute[1] === 'content'));
      return [{
        ...documents[0],
        content: '<p>Quy trình kết nối máy in với Bluetooth từng bước.</p>'.repeat(20),
        toJSON() { return { ...this }; },
      }];
    },
  };
  const service = createContentSearch({ GuideModel: model, cacheTtlMs: 1000 });

  const first = await service.search({ type: 'guide', q: 'bluetooth tung buoc' });
  const second = await service.search({ type: 'guide', q: 'bluetooth tung buoc' });

  assert.equal(first.items[0].id, 'guide-printer');
  assert.equal(Object.hasOwn(first.items[0], 'content'), false);
  assert.equal(Object.hasOwn(first.items[0], 'searchFields'), false);
  assert.equal(calls, 1);
  assert.equal(second.total, 1);
});

test('search service does not load the database for queries shorter than two normalized characters', async () => {
  const service = createContentSearch({
    BlogModel: { findAll: async () => { throw new Error('Unexpected database query'); } },
  });

  assert.deepEqual(await service.search({ type: 'blog', q: ' a ' }), {
    items: [],
    total: 0,
    page: 1,
    totalPages: 0,
  });
});