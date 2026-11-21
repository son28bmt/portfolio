import assert from 'node:assert/strict';
import test from 'node:test';
import { getGridItemStyle, isRenderableBlock, orderMobileBlocks } from './rendererUtils.js';
import { mediaUrlVectors, safeUrl, videoEmbedUrl } from './media.js';

test('renderer maps grid coordinates to CSS grid placement', () => {
  assert.deepEqual(getGridItemStyle({ x: 2, y: 4, w: 3, h: 5 }), { gridColumn: '3 / span 3', gridRow: '5 / span 5' });
});

test('renderer orders mobile blocks by y then x', () => {
  const result = orderMobileBlocks([{ id: 'b', y: 2, x: 0 }, { id: 'c', y: 1, x: 3 }, { id: 'a', y: 1, x: 0 }]);
  assert.deepEqual(result.map((item) => item.id), ['a', 'c', 'b']);
});

test('renderer ignores unknown block types without crashing', () => {
  assert.equal(isRenderableBlock('unknown'), false);
  assert.equal(isRenderableBlock('image'), true);
});

test('renderer media helper follows shared URL vectors', () => {
  for (const vector of mediaUrlVectors) assert.equal(Boolean(safeUrl(vector.value)), vector.valid, vector.value);
});

test('renderer keeps YouTube no-cookie and Vimeo embeds on the approved hosts', () => {
  assert.equal(videoEmbedUrl('https://www.youtube.com/watch?v=abc1234'), 'https://www.youtube-nocookie.com/embed/abc1234');
  assert.equal(videoEmbedUrl('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');
  assert.equal(videoEmbedUrl('https://evil.example/video/123456789'), '');
});