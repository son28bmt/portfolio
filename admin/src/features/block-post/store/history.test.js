import assert from 'node:assert/strict';
import test from 'node:test';
import { HISTORY_LIMIT, pushHistory, redoState, undoState } from './history.js';

const state = (blocks = [], contentByBlockId = {}) => ({ blocks, contentByBlockId, past: [], future: [], present: blocks });

test('undoing a move keeps text typed after the move', () => {
  let current = state([{ id: 'a', x: 0, y: 0 }], { a: { kind: 'richText', html: 'before' } });
  current = pushHistory(current, { blocks: [{ id: 'a', x: 1, y: 0 }], contentByBlockId: current.contentByBlockId });
  current = { ...current, contentByBlockId: { a: { kind: 'richText', html: 'typed after move' } } };
  current = undoState(current);
  assert.deepEqual(current.blocks, [{ id: 'a', x: 0, y: 0 }]);
  assert.deepEqual(current.contentByBlockId, { a: { kind: 'richText', html: 'typed after move' } });
});

test('undoing delete restores content, while undoing add drops content', () => {
  let current = state([{ id: 'a' }], { a: { kind: 'richText', html: 'keep me' } });
  current = pushHistory(current, { blocks: [], contentByBlockId: {} });
  current = undoState(current);
  assert.deepEqual(current.contentByBlockId, { a: { kind: 'richText', html: 'keep me' } });

  current = state([], {});
  current = pushHistory(current, { blocks: [{ id: 'b' }], contentByBlockId: { b: { kind: 'richText', html: 'new block' } } });
  current = undoState(current);
  assert.deepEqual(current.blocks, []);
  assert.deepEqual(current.contentByBlockId, {});
  current = redoState(current);
  assert.deepEqual(current.contentByBlockId, { b: { kind: 'richText', html: 'new block' } });
});

test('history is limited to 50 and a new operation clears future', () => {
  let current = state();
  for (let i = 0; i < 60; i += 1) current = pushHistory(current, { blocks: [{ id: String(i) }], contentByBlockId: {} });
  assert.equal(current.past.length, HISTORY_LIMIT);
  current = undoState(current);
  assert.equal(current.future.length, 1);
  current = pushHistory(current, { blocks: [{ id: 'new' }], contentByBlockId: {} });
  assert.equal(current.future.length, 0);
});

test('dirty snapshots return to clean after undo and redo', () => {
  const saved = state([{ id: 'a', x: 0 }], { a: { kind: 'richText', html: 'saved' } });
  const moved = pushHistory(saved, { blocks: [{ id: 'a', x: 1 }], contentByBlockId: saved.contentByBlockId });
  const undone = undoState(moved);
  assert.equal(JSON.stringify(undone.blocks), JSON.stringify(saved.blocks));
  assert.equal(JSON.stringify(undone.contentByBlockId), JSON.stringify(saved.contentByBlockId));
  const redone = redoState(undone);
  assert.equal(redone.blocks[0].x, 1);
  assert.deepEqual(redone.contentByBlockId, saved.contentByBlockId);
});