const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generateOrderCode,
  sanitizeDonorName,
  buildTransferContent,
  buildVietQrUrl,
  extractOrderCode,
  toAmount,
} = require('../src/services/donate.service');

test('generateOrderCode: should generate valid order code', () => {
  const code = generateOrderCode();
  assert.match(code, /^DN[A-Z0-9]{8,30}$/);
});

test('generateOrderCode: should not duplicate quickly', () => {
  const code1 = generateOrderCode();
  const code2 = generateOrderCode();
  assert.notEqual(code1, code2);
});

test('sanitizeDonorName: should trim and collapse spaces', () => {
  const result = sanitizeDonorName('  Nguyễn   Quang   Sơn  ');
  assert.equal(result, 'Nguyễn Quang Sơn');
});

test('buildTransferContent: should uppercase order code', () => {
  const result = buildTransferContent('dnabc123xyz');
  assert.equal(result, 'DNABC123XYZ');
});

test('extractOrderCode: should read from transfer content', () => {
  const result = extractOrderCode('Donate DNABCD1234EFGH for project');
  assert.equal(result, 'DNABCD1234EFGH');
});

test('toAmount: should return rounded integer', () => {
  assert.equal(toAmount('12345.7'), 12346);
  assert.equal(toAmount('invalid'), null);
});

test('buildVietQrUrl: should produce VietQR image URL', () => {
  const url = buildVietQrUrl({
    bankBin: '970422',
    accountNo: '28070333333333',
    accountName: 'NGUYEN QUANG SON',
    amount: 50000,
    transferContent: 'DNTEST123456',
  });
  assert.ok(url.includes('img.vietqr.io/image/970422-28070333333333-compact2.png'));
  assert.ok(url.includes('amount=50000'));
  assert.ok(url.includes('addInfo=DNTEST123456'));
});
