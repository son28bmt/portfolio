import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTemplateBlocks } from './layoutSchema.js';

test('normalizes template blocks when API returns a JSON string or wrapped object', () => {
  const block = { id: 'text-1', type: 'text', x: 0, y: 0, w: 12, h: 4, align: 'left', props: { content: '<p>ok</p>' } };
  assert.equal(normalizeTemplateBlocks(JSON.stringify([block])).blocks.length, 1);
  assert.equal(normalizeTemplateBlocks(JSON.stringify({ blocks: [block] })).blocks.length, 1);
  assert.deepEqual(normalizeTemplateBlocks({ items: [block] }).blocks, []);
});