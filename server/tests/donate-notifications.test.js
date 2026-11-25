const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const axios = require('axios');
const { buildDonateRouter } = require('../src/routes/donate.routes');

const webhookPayload = {
  id: 'sepay-txn-123',
  content: 'DNTEST123456',
  transferAmount: 50000,
};

const startDonateApp = async (t, envOverrides = {}) => {
  const config = {
    SEPAY_WEBHOOK_SECRET: 'test-sepay-secret',
    TELEGRAM_NOTIFICATIONS_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'test-telegram-token',
    TELEGRAM_CHAT_ID: '-1001234567890',
    TELEGRAM_MESSAGE_THREAD_ID: '27',
    ...envOverrides,
  };
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  const donation = {
    id: 'donation-1',
    orderCode: webhookPayload.content,
    donorName: 'Nguyễn Văn A',
    amount: 50000,
    status: 'pending',
    providerTxnId: null,
    paidAt: null,
    update: t.mock.fn(async (changes) => {
      Object.assign(donation, changes);
      return donation;
    }),
  };
  const DonationModel = {
    findOne: async ({ where }) => {
      if (where.orderCode) return where.orderCode === donation.orderCode ? donation : null;
      return where.providerTxnId === donation.providerTxnId ? donation : null;
    },
  };
  const statusesAtSend = [];
  const telegramPost = t.mock.method(axios, 'post', async () => {
    statusesAtSend.push(donation.status);
    return { data: { ok: true } };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/donate', buildDonateRouter({ DonationModel }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const postWebhook = async (payload = webhookPayload, secret = config.SEPAY_WEBHOOK_SECRET) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/donate/webhook/sepay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-secret-key': secret },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  };

  return { donation, postWebhook, telegramPost, statusesAtSend };
};

test('paid donate sends details to the configured Telegram chat and skips webhook retries', async (t) => {
  const { donation, postWebhook, telegramPost, statusesAtSend } = await startDonateApp(t);
  const response = await postWebhook();
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(donation.status, 'paid');
  assert.ok(donation.paidAt instanceof Date);
  assert.deepEqual(statusesAtSend, ['paid']);
  assert.equal(telegramPost.mock.callCount(), 1);

  const [url, message] = telegramPost.mock.calls[0].arguments;
  assert.equal(url, 'https://api.telegram.org/bottest-telegram-token/sendMessage');
  assert.equal(message.chat_id, '-1001234567890');
  assert.equal(message.message_thread_id, 27);
  assert.equal(message.disable_notification, false);
  assert.match(message.text, /^\[DONATE\]/);
  assert.match(message.text, /• Mã donate: DNTEST123456/);
  assert.match(message.text, /• Người ủng hộ: Nguyễn Văn A/);
  assert.match(message.text, /• Số tiền: 50\.000 đ/);
  assert.match(message.text, /• Mã giao dịch: sepay-txn-123/);
  assert.match(message.text, /• Lúc: .+/);

  assert.equal((await postWebhook()).status, 200);
  assert.equal(donation.update.mock.callCount(), 1);
  assert.equal(telegramPost.mock.callCount(), 1);
});

test('rejected or unsuccessful donate webhooks do not notify Telegram', async (t) => {
  const scenarios = [
    { name: 'invalid webhook token', secret: 'wrong-secret', status: 401 },
    { name: 'unsuccessful transaction', payload: { ...webhookPayload, status: 'failed' }, status: 202 },
    { name: 'incorrect amount', payload: { ...webhookPayload, transferAmount: 40000 }, status: 400 },
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async (t) => {
      const { donation, postWebhook, telegramPost } = await startDonateApp(t);
      const response = await postWebhook(scenario.payload, scenario.secret);
      assert.equal(response.status, scenario.status);
      assert.equal(donation.update.mock.callCount(), 0);
      assert.equal(telegramPost.mock.callCount(), 0);
    });
  }
});

test('a failed donation save does not notify Telegram', async (t) => {
  const { donation, postWebhook, telegramPost } = await startDonateApp(t);
  donation.update.mock.mockImplementation(async () => { throw new Error('Database unavailable'); });
  assert.equal((await postWebhook()).status, 500);
  assert.equal(donation.status, 'pending');
  assert.equal(telegramPost.mock.callCount(), 0);
});

test('Telegram API failure does not fail a paid donate webhook', async (t) => {
  const { donation, postWebhook, telegramPost } = await startDonateApp(t);
  const logError = t.mock.method(console, 'error', () => {});
  telegramPost.mock.mockImplementation(async () => { throw new Error('Telegram unavailable'); });
  const response = await postWebhook();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(donation.status, 'paid');
  assert.equal(telegramPost.mock.callCount(), 1);
  assert.equal(logError.mock.callCount(), 1);
  assert.equal(logError.mock.calls[0].arguments[1], 'Telegram unavailable');
});

test('disabled or unconfigured Telegram does not affect donate payment', async (t) => {
  for (const config of [{ TELEGRAM_NOTIFICATIONS_ENABLED: 'false' }, { TELEGRAM_BOT_TOKEN: '' }]) {
    await t.test(JSON.stringify(config), async (t) => {
      const { donation, postWebhook, telegramPost } = await startDonateApp(t, config);
      t.mock.method(console, 'warn', () => {});
      assert.equal((await postWebhook()).status, 200);
      assert.equal(donation.status, 'paid');
      assert.equal(telegramPost.mock.callCount(), 0);
    });
  }
});