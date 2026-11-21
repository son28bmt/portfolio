import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBlockLayout, overlaps } from './layout.js';

test('normalizes loaded blocks so overlapping blocks are moved below earlier blocks', () => {
  const result = normalizeBlockLayout([
    { id: 'first', type: 'text', x: 0, y: 0, w: 12, h: 9, align: 'left', props: {} },
    { id: 'second', type: 'text', x: 0, y: 4, w: 12, h: 6, align: 'left', props: {} },
  ]);

  assert.equal(result.adjusted, true);
  assert.equal(overlaps(result.blocks[0], result.blocks[1]), false);
  assert.equal(result.blocks[1].x, 0);
  assert.ok(result.blocks[1].y >= result.blocks[0].y + result.blocks[0].h);
});