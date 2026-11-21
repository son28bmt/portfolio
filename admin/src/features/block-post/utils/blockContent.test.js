import assert from 'node:assert/strict';
import test from 'node:test';
import { syncCheckboxSelections } from '../../../../../shared/layout-post-renderer/syncCheckboxSelections.js';
import { mediaUrlVectors } from '../../../../../shared/layout-post-renderer/media-url-vectors.js';
import { safeUrl } from '../../../../../shared/layout-post-renderer/media.js';

test('keeps checked state for existing labels and defaults new options to false', () => {
  assert.deepEqual(syncCheckboxSelections(['A', 'B', 'C'], [{ label: 'A', checked: true }, { label: 'C', checked: false }]), [
    { label: 'A', checked: true }, { label: 'B', checked: false }, { label: 'C', checked: false },
  ]);
});

test('drops removed options and trims blanks', () => {
  assert.deepEqual(syncCheckboxSelections(['A', '', 'B'], [{ label: 'A', checked: true }, { label: 'removed', checked: true }]), [
    { label: 'A', checked: true }, { label: 'B', checked: false },
  ]);
});

test('single choice keeps only first checked item', () => {
  assert.deepEqual(syncCheckboxSelections(['A', 'B'], [{ label: 'A', checked: true }, { label: 'B', checked: true }], false), [
    { label: 'A', checked: true }, { label: 'B', checked: false },
  ]);
});

test('admin media helper follows shared URL vectors', () => {
  for (const vector of mediaUrlVectors) assert.equal(Boolean(safeUrl(vector.value)), vector.valid, vector.value);
});