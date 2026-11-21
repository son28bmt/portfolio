import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLayoutPostForSave } from './layoutSchema.js';
import './layoutSchema.data.test.js';

const block = (props = {}) => ({ id: 'q', type: 'question', x: 0, y: 0, w: 12, h: 3, align: 'left', props });

test('Question uses templateId/heading and normalizes legacy question content', () => {
  const result = validateLayoutPostForSave({ title: 'Test', status: 'draft', layout: [block({ inputType: 'short', templateId: '123e4567-e89b-12d3-a456-426614174000', heading: 'Hỏi' })], content: { q: { kind: 'question', prompt: 'old', required: true } } });
  assert.deepEqual(result.layout[0].props, { templateId: '123e4567-e89b-12d3-a456-426614174000', heading: 'Hỏi' });
  assert.deepEqual(result.content.q, { kind: 'empty' });
});

test('published Question requires a template and allows at most one block', () => {
  assert.throws(() => validateLayoutPostForSave({ title: 'Test', status: 'published', layout: [block()], content: {} }), /bộ câu hỏi|template/);
  assert.throws(() => validateLayoutPostForSave({ title: 'Test', status: 'published', layout: [block({ templateId: '123e4567-e89b-12d3-a456-426614174000' }), { ...block({ templateId: '123e4567-e89b-12d3-a456-426614174000' }), id: 'q2', y: 4 }], content: {} }), /tối đa 1/);
});