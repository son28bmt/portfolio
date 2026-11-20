const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { sequelize } = require('../config/db');
const { User, UserProfile, WalletAccount } = require('../models');
const { ensureMemberSchema } = require('./member-schema.service');

let oauthClient;

const getGoogleClientIds = () => String(process.env.GOOGLE_CLIENT_ID || '')
  .split(',').map(value => value.trim()).filter(Boolean);

const getOAuthClient = () => {
  if (!oauthClient) oauthClient = new OAuth2Client();
  return oauthClient;
};

const verifyGoogleCredential = async credential => {
  const audience = getGoogleClientIds();
  if (!audience.length) { const error = new Error('Máy chủ chưa cấu hình GOOGLE_CLIENT_ID.'); error.status = 503; throw error; }
  if (typeof credential !== 'string' || !credential.trim()) { const error = new Error('Thiếu Google credential.'); error.status = 400; throw error; }
  let ticket;
  try { ticket = await getOAuthClient().verifyIdToken({ idToken: credential, audience }); }
  catch { const error = new Error('Google credential không hợp lệ hoặc đã hết hạn.'); error.status = 401; throw error; }
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) { const error = new Error('Tài khoản Google chưa xác minh email.'); error.status = 401; throw error; }
  return { sub: String(payload.sub), email: String(payload.email).trim().toLowerCase(), name: String(payload.name || '').trim().slice(0, 160) || null };
};

const baseUsername = email => {
  const prefix = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]+/g, '');
  return (prefix.length >= 3 ? prefix : `google-${crypto.randomBytes(3).toString('hex')}`).slice(0, 50);
};

const uniqueUsername = async (email, transaction) => {
  const base = baseUsername(email);
  for (let index = 0; index < 20; index += 1) {
    const username = index ? `${base}-${index + 1}` : base;
    if (!await User.findOne({ where: { username }, transaction })) return username;
  }
  return `${base}-${crypto.randomBytes(4).toString('hex')}`;
};

const findOrCreateGoogleUser = async identity => {
  await ensureMemberSchema();
  return sequelize.transaction(async transaction => {
  let profile = await UserProfile.findOne({ where: { googleSub: identity.sub }, transaction });
  if (profile) {
    const user = await User.findByPk(profile.userId, { transaction });
    if (!user) { const error = new Error('Tài khoản Google này đã bị gỡ liên kết.'); error.status = 409; throw error; }
    return { user, profile };
  }
  profile = await UserProfile.findOne({ where: { email: identity.email }, transaction });
  if (profile) {
    if (profile.googleSub && profile.googleSub !== identity.sub) { const error = new Error('Email này đã liên kết với một tài khoản Google khác.'); error.status = 409; throw error; }
    profile.googleSub = identity.sub;
    if (!profile.fullName && identity.name) profile.fullName = identity.name;
    await profile.save({ transaction });
    const user = await User.findByPk(profile.userId, { transaction });
    if (!user) { const error = new Error('Tài khoản thành viên không tồn tại.'); error.status = 409; throw error; }
    return { user, profile };
  }
  const user = await User.create({ username: await uniqueUsername(identity.email, transaction), password: crypto.randomBytes(32).toString('hex') }, { transaction });
  profile = await UserProfile.create({ userId: user.id, fullName: identity.name, email: identity.email, googleSub: identity.sub, tier: 'standard', registeredAt: new Date() }, { transaction });
  await WalletAccount.create({ userId: user.id, balance: 0, status: 'active' }, { transaction });
  return { user, profile };
  });
};

module.exports = { getGoogleClientIds, verifyGoogleCredential, baseUsername, uniqueUsername, findOrCreateGoogleUser };