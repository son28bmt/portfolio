import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import BlockPostRenderer from './BlockPostRenderer.jsx';

test('server renderer sanitizes content, media, unknown blocks, order, and grid placement', () => {
  const markup = renderToStaticMarkup(<BlockPostRenderer
    layout={[
      { id: 'b', type: 'image', x: 2, y: 4, w: 3, h: 5, align: 'left', props: {} },
      { id: 'unknown', type: 'not-supported', x: 0, y: 0, w: 1, h: 1, align: 'left', props: {} },
      { id: 'a', type: 'text', x: 0, y: 1, w: 4, h: 2, align: 'center', props: {} },
      { id: 'v', type: 'video', x: 1, y: 4, w: 2, h: 3, align: 'left', props: {} },
      { id: 'missing', type: 'footer', x: 0, y: 20, w: 12, h: 2, align: 'left', props: {} },
    ]}
    content={{
      a: { kind: 'richText', html: '<script>alert(1)</script><p onerror="x"><a href="javascript:bad">bad</a><img src="data:image/png;base64,x" /></p>' },
      b: { kind: 'image', url: 'javascript:alert(1)', alt: '' },
      v: { kind: 'video', url: 'https://evil.example/embed/1', poster: '' },
    }}
  />);

  assert.doesNotMatch(markup, /not-supported/);
  assert.doesNotMatch(markup, /<script|onerror|javascript:|data:image/);
  assert.doesNotMatch(markup, /<img|<iframe/);
  assert.ok(markup.indexOf('data-block-id="a"') < markup.indexOf('data-block-id="b"'));
  assert.match(markup, /data-block-id="missing"/);
  assert.match(markup, /grid-column:3 \/ span 3/);
  assert.match(markup, /grid-row:5 \/ span 5/);
});

test('server renderer emits the required iframe referrer policy', () => {
  const markup = renderToStaticMarkup(<BlockPostRenderer
    layout={[{ id: 'video', type: 'video', x: 0, y: 0, w: 12, h: 4, align: 'left', props: {} }]}
    content={{ video: { kind: 'video', url: 'https://www.youtube.com/watch?v=abc1234', poster: '' } }}
  />);
  assert.match(markup, /https:\/\/www\.youtube-nocookie\.com\/embed\/abc1234/);
  assert.match(markup, /referrerPolicy="strict-origin-when-cross-origin"/);
});

test('renderer delegates Question blocks to the question slot', () => {
  const markup = renderToStaticMarkup(<BlockPostRenderer
    layout={[{ id: 'question', type: 'question', x: 0, y: 0, w: 12, h: 3, align: 'left', props: { templateId: 'template-1' } }]}
    slots={{ question: ({ props }) => <div data-testid="question-slot">slot:{props.templateId}</div> }}
  />);
  assert.match(markup, /data-testid="question-slot"/);
  assert.match(markup, /slot:template-1/);
});