const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { addClient, sendEvent } = require('../src/services/sse.service');

test('donate SSE route disables proxy buffering and delivers payment updates', async (t) => {
  const app = express();
  app.get('/api/donate/sse/donates/:orderCode', (req, res) => {
    addClient(req, res, 'donate', req.params.orderCode);
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const code = `DNSTREAM${Date.now()}`;
  let reader;
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/donate/sse/donates/${code}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    assert.equal(response.headers.get('x-accel-buffering'), 'no');
    assert.match(response.headers.get('cache-control'), /no-transform/);

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const connected = await reader.read();
    assert.match(decoder.decode(connected.value), /: connected/);

    sendEvent('donate', code, { status: 'paid' });
    const paymentUpdate = await reader.read();
    assert.match(decoder.decode(paymentUpdate.value), /"status":"paid"/);
  } finally {
    if (reader) await reader.cancel();
  }
});