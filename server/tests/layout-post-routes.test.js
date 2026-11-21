const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { buildLayoutPostRouter } = require('../src/routes/layout-post.routes');
const { registerQuestionRoutes } = require('../src/routes/chat.routes');
const { validateAnswerValues } = require('../src/services/guide-question.service');

const start = async (app) => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
};

const noAuth = (req, res, next) => { req.user = { id: 'user-1', username: 'member' }; next(); };
const noAdmin = (req, res, next) => next();

test('layout post question-templates route is resolved before :id through Express', async () => {
  let listCalled = false;
  const app = express();
  app.use('/api/layout-posts', buildLayoutPostRouter({
    protectMiddleware: noAuth,
    adminMiddleware: noAdmin,
    QuestionTemplate: { findAll: async () => { listCalled = true; return [{ toJSON: () => ({ id: 't1', guideId: null }) }]; } },
    PostModel: { findByPk: async () => { throw new Error('GET /:id was selected'); } },
  }));
  const { server, base } = await start(app);
  try {
    const response = await fetch(`${base}/api/layout-posts/question-templates`);
    assert.equal(response.status, 200);
    assert.equal(listCalled, true);
    assert.deepEqual(await response.json(), [{ id: 't1', guideId: null }]);
  } finally { server.close(); }
});

const buildChatApp = ({ post, template, values, limiter, profile = { email: 'member@example.com' } } = {}) => {
  const app = express();
  app.use(express.json());
  registerQuestionRoutes(app, {
    protectMiddleware: noAuth,
    limiter,
    PostModel: { findOne: async () => post || null },
    ProfileModel: { findByPk: async () => profile },
    findTemplate: async () => template || null,
    validateValues: (fields, input) => values ? values(fields, input) : [{ key: 'name', label: 'Tên', value: input.name || '' }],
    submitGuide: async () => ({ id: 'guide-request' }),
    MessageModel: { create: async payload => ({ ...payload, createdAt: '2026-11-21T00:00:00.000Z' }) },
    formatRequestNumber: () => 'REQ12345',
    emitRequest: () => {},
  });
  return app;
};

const publishedPost = { id: 'post-1', title: 'Bài công khai', layout: [{ type: 'question', props: { templateId: 'server-template' } }] };
const sharedTemplate = { id: 'server-template', name: 'Mẫu dùng chung', fields: [{ key: 'name', label: 'Tên', type: 'text', required: true, maxLength: 10 }] };

test('layout-post-question requires published post and ignores client templateId', async () => {
  const limiter = (req, res, next) => next();
  const app = express();
  app.use(express.json());
  let received;
  registerQuestionRoutes(app, {
    protectMiddleware: noAuth, limiter,
    PostModel: { findOne: async ({ where }) => where.status === 'published' && where.id === 'post-1' ? publishedPost : null },
    ProfileModel: { findByPk: async () => ({ email: 'member@example.com' }) },
    findTemplate: async id => { received = id; return sharedTemplate; },
    validateValues: () => [{ key: 'name', label: 'Tên', value: 'An' }],
    MessageModel: { create: async payload => ({ ...payload, createdAt: new Date().toISOString() }) },
    formatRequestNumber: () => 'REQ12345', emitRequest: () => {},
  });
  const { server, base } = await start(app);
  try {
    const ok = await fetch(`${base}/layout-post-question`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId: 'post-1', templateId: 'client-template', values: { name: 'An' } }) });
    assert.equal(ok.status, 201);
    assert.equal(received, 'server-template');
    const draft = await fetch(`${base}/layout-post-question`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId: 'draft', values: {} }) });
    assert.equal(draft.status, 404);
    const missing = await fetch(`${base}/layout-post-question`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId: 'missing', values: {} }) });
    assert.equal(missing.status, 404);
  } finally { server.close(); }
});

test('layout-post-question rejects inactive and guide-private templates', async () => {
  const limiter = (req, res, next) => next();
  for (const templateId of ['inactive-template', 'guide-private-template']) {
    let queriedId = '';
    const app = express();
    app.use(express.json());
    registerQuestionRoutes(app, {
      protectMiddleware: noAuth, limiter,
      PostModel: { findOne: async ({ where }) => where.status === 'published' ? { ...publishedPost, layout: [{ type: 'question', props: { templateId } }] } : null },
      ProfileModel: { findByPk: async () => ({ email: 'member@example.com' }) },
      findTemplate: async id => { queriedId = id; return null; },
      validateValues: () => [],
      MessageModel: { create: async payload => payload },
      emitRequest: () => {},
    });
    const { server, base } = await start(app);
    try {
      const response = await fetch(`${base}/layout-post-question`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId: 'post-1', values: { name: 'An' } }) });
      assert.equal(response.status, 404);
      assert.equal(queriedId, templateId);
    } finally { server.close(); }
  }
});

test('layout-post-question returns 401 before reaching protected handler when unauthenticated', async () => {
  const app = express();
  app.use(express.json());
  const rejectAuth = (req, res) => res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
  registerQuestionRoutes(app, { protectMiddleware: rejectAuth, limiter: (req, res, next) => next() });
  const { server, base } = await start(app);
  try {
    const response = await fetch(`${base}/layout-post-question`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId: 'post-1', values: {} }) });
    assert.equal(response.status, 401);
  } finally { server.close(); }
});

test('layout-post-question validates required, maxLength, email, tel, and unknown fields through Express', async () => {
  const fields = [
    { key: 'name', label: 'Tên', type: 'text', required: true, maxLength: 3 },
    { key: 'email', label: 'Email', type: 'email', required: true, maxLength: 100 },
    { key: 'phone', label: 'Điện thoại', type: 'tel', required: true, maxLength: 30 },
  ];
  const app = buildChatApp({ post: publishedPost, template: { ...sharedTemplate, fields }, limiter: (req, res, next) => next(), values: validateAnswerValues });
  const { server, base } = await start(app);
  const send = values => fetch(`${base}/layout-post-question`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId: 'post-1', values }) });
  try {
    assert.equal((await send({ email: 'a@b.com', phone: '01234567' })).status, 400);
    assert.equal((await send({ name: 'Long', email: 'a@b.com', phone: '01234567' })).status, 400);
    assert.equal((await send({ name: 'An', email: 'wrong', phone: '01234567' })).status, 400);
    assert.equal((await send({ name: 'An', email: 'a@b.com', phone: 'bad' })).status, 400);
    assert.equal((await send({ name: 'An', email: 'a@b.com', phone: '01234567', injected: 'x' })).status, 400);
    assert.equal((await send({ name: 'An', email: 'a@b.com', phone: '01234567' })).status, 201);
  } finally { server.close(); }
});

test('guide-question and layout-post-question share a five-request hourly limiter', async () => {
  const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, validate: { default: false } });
  const app = buildChatApp({ post: publishedPost, template: sharedTemplate, limiter });
  const { server, base } = await start(app);
  const post = (path) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(path.includes('layout') ? { postId: 'post-1', values: { name: 'An' } } : { guideSlug: 'guide', answers: {} }) });
  try {
    const statuses = [];
    for (const path of ['/guide-question', '/layout-post-question', '/guide-question', '/layout-post-question', '/guide-question', '/layout-post-question']) statuses.push((await post(path)).status);
    assert.deepEqual(statuses.slice(0, 5), [201, 201, 201, 201, 201]);
    assert.equal(statuses[5], 429);
  } finally { server.close(); }
});