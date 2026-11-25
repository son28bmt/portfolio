import assert from 'node:assert/strict';
import test from 'node:test';
import { createSearchService, normalizeSearchText, parseSearchTags, rankSearchDocuments } from './contentSearchUtils.js';

const documents = [
  { id: 'guide-printer', title: 'Cách kết nối máy in bill qua Bluetooth', slug: 'ket-noi-may-in', tags: ['máy in bill'], topic: { name: 'Cài đặt máy in', slug: 'cai-dat-may-in' } },
  { id: 'guide-topic', title: 'Bảo trì thiết bị bán hàng', slug: 'bao-tri', tags: ['bảo trì'], topic: { name: 'Máy in hóa đơn', slug: 'may-in' } },
];

test('client search normalization removes Vietnamese accents', () => {
  assert.equal(normalizeSearchText('CÁCH sử dụng máy in bill'), 'cach su dung may in bill');
});

test('client search parses legacy string and JSON tags', () => {
  assert.deepEqual(parseSearchTags('["máy in", "AIBAT"]'), ['máy in', 'AIBAT']);
  assert.deepEqual(parseSearchTags('máy in, AIBAT'), ['máy in', 'AIBAT']);
});

test('client search prioritizes accented title matches without accents', () => {
  const results = rankSearchDocuments(documents, 'cach ket noi may in', { type: 'guide' });
  assert.equal(results[0].id, 'guide-printer');
  assert.equal(results[0].matchedBy, 'title');
});

test('client search matches a one-character typo and respects topic filters', () => {
  assert.equal(rankSearchDocuments(documents, 'bluetoth', { type: 'guide' })[0].id, 'guide-printer');
  const filtered = rankSearchDocuments(documents, 'may in', { type: 'guide', topic: 'cai-dat-may-in' });
  assert.ok(filtered.every(item => item.topic.slug === 'cai-dat-may-in'));
});

test('client search falls back to legacy guide API when production search route is missing', async () => {
  const requests = [];
  const api = { get: async (path, options) => {
    requests.push({ path, params: options?.params });
    if (path === '/search') {
      const error = new Error('Search route is not deployed.');
      error.response = { status: 404 };
      throw error;
    }
    if (path === '/guides') {
      return {
        data: {
          total: 1,
          totalPages: 1,
          items: [{
            id: 'guide-printer',
            slug: 'cach-su-dung-may-in-bill-aibat',
            title: 'CÁCH SỬ DỤNG MÁY IN BILL AIBAT',
            excerpt: 'Hướng dẫn sử dụng máy in bill.',
            tags: ['máy in bill', 'AIBAT'],
            topic: { name: 'Cài Đặt Máy In', slug: 'cai-dat-may-in' },
          }],
        },
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  } };

  const searchContent = createSearchService(api);
  const result = await searchContent({ type: 'guide', q: 'cách', limit: 6 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 'guide-printer');
  assert.equal(result.items[0].matchedBy, 'title');
  assert.deepEqual(requests.map(request => request.path), ['/search', '/guides']);
});