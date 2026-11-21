import assert from 'node:assert/strict';
import test from 'node:test';
import { removeBlockState } from './blockPostState.js';

test('removing a block also removes its contentByBlockId value', () => {
  const state = {
    blocks: [{ id: 'image-1', type: 'image', x: 0, y: 0, w: 4, h: 4, align: 'left', props: {} }],
    contentByBlockId: { 'image-1': { kind: 'image', url: 'https://example.com/image.jpg', alt: '' } },
    validationErrorsByBlockId: { 'image-1': 'bad' },
    selectedBlockId: 'image-1',
  };
  const current = removeBlockState(state, 'image-1');
  assert.equal(current.blocks.length, 0);
  assert.equal(current.contentByBlockId['image-1'], undefined);
  assert.equal(current.selectedBlockId, null);
});