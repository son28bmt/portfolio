const test = require('node:test');
const assert = require('node:assert/strict');
const { baseUsername, getGoogleClientIds, verifyGoogleCredential } = require('../src/services/google-auth.service');

test('Google auth: creates safe usernames from verified email prefixes', () => {
  assert.equal(baseUsername('Nguyễn Sơn@example.com'), 'nguynsn');
  assert.match(baseUsername('user.name@example.com'), /^user\.name$/);
});

test('Google auth: accepts multiple configured audiences', () => {
  const previous = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'client-a, client-b';
  assert.deepEqual(getGoogleClientIds(), ['client-a', 'client-b']);
  if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previous;
});

test('Google auth: rejects missing credential or missing server configuration', async () => {
  const previous = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  await assert.rejects(() => verifyGoogleCredential(''), { status: 503 });
  if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previous;
});