const { GuideQuestionTemplate, Guide, LiveChatMessage, UserProfile } = require('../models');
const { Op } = require('sequelize');
const { randomUUID } = require('crypto');
const { emitSupportRequest } = require('./socket.service');
const { notifyTelegramGuideQuestion } = require('./telegram.service');

const clean = (value, max) => String(value || '').trim().slice(0, max);
const DEFAULT_TEMPLATE_ID = 'default-guide-question';
const DEFAULT_FIELDS = [{ key: 'question', label: 'Câu hỏi của bạn', type: 'textarea', required: true, maxLength: 2000 }];
const formatSupportRequestNumber = id => String(id || '').replace(/-/g, '').slice(-8).toUpperCase();

const parseFields = value => {
  let fields = value;
  for (let i = 0; i < 5 && typeof fields === 'string'; i += 1) {
    try { fields = JSON.parse(fields); } catch { return DEFAULT_FIELDS; }
  }
  if (fields && !Array.isArray(fields) && Array.isArray(fields.fields)) return fields.fields;
  return Array.isArray(fields) && fields.length ? fields : DEFAULT_FIELDS;
};

const normalizeFields = (input) => {
  input = parseFields(input);
  if (!Array.isArray(input) || input.length < 1 || input.length > 12) {
    const error = new Error('Mẫu cần có từ 1 đến 12 trường.'); error.status = 400; throw error;
  }
  const fields = input.map((field, index) => ({
    key: clean(field?.key || `field_${index + 1}`, 40).replace(/[^a-zA-Z0-9_-]/g, ''),
    label: clean(field?.label, 120),
    type: ['text', 'textarea', 'email', 'tel'].includes(field?.type) ? field.type : 'text',
    required: field?.required !== false,
    maxLength: Math.min(2000, Math.max(1, Number(field?.maxLength) || 500)),
  }));
  if (fields.some(field => !field.key || !field.label)) {
    const error = new Error('Mỗi trường cần có key và nhãn.'); error.status = 400; throw error;
  }
  if (new Set(fields.map(field => field.key)).size !== fields.length) {
    const error = new Error('Key các trường phải khác nhau.'); error.status = 400; throw error;
  }
  return fields;
};

const validateAnswerValues = (inputFields, answers) => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    const error = new Error('Câu trả lời không hợp lệ.'); error.status = 400; throw error;
  }
  const fields = normalizeFields(inputFields);
  const allowedKeys = new Set(fields.map(field => field.key));
  const unknownKey = Object.keys(answers).find(key => !allowedKeys.has(key));
  if (unknownKey) { const error = new Error(`Trường ${unknownKey} không hợp lệ.`); error.status = 400; throw error; }
  const snapshot = fields.map(field => {
    const rawValue = String(answers[field.key] || '').trim();
    if (rawValue.length > field.maxLength) { const error = new Error(`${field.label} không được vượt quá ${field.maxLength} ký tự.`); error.status = 400; throw error; }
    const value = rawValue;
    if (field.required && !value) { const error = new Error(`${field.label} là bắt buộc.`); error.status = 400; throw error; }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { const error = new Error(`${field.label} cần là email hợp lệ.`); error.status = 400; throw error; }
    if (field.type === 'tel' && value && !/^\+?[0-9\s().-]{7,30}$/.test(value)) { const error = new Error(`${field.label} cần là số điện thoại hợp lệ.`); error.status = 400; throw error; }
    return { key: field.key, label: field.label, value };
  });
  return snapshot;
};

const findReusableTemplate = (templateId) => GuideQuestionTemplate.findOne({
  where: { id: templateId, isActive: true, guideId: null },
  attributes: ['id', 'name', 'fields'],
});

const listTemplatesForGuide = async (slug) => {
  const guide = await Guide.findOne({ where: { slug, status: 'published' }, attributes: ['id'] });
  if (!guide) return null;
  const templates = await GuideQuestionTemplate.findAll({
    where: { isActive: true, [Op.or]: [{ guideId: guide.id }, { guideId: null }] },
    attributes: ['id', 'name', 'fields'],
    order: [['createdAt', 'ASC']],
  });
  const normalized = templates.map(template => ({
    ...template.toJSON(),
    fields: parseFields(template.fields),
  })).filter(template => template.fields.length > 0);
  if (normalized.length) return normalized;
  return [{
    id: DEFAULT_TEMPLATE_ID,
    name: 'Câu hỏi của bạn',
    fields: DEFAULT_FIELDS,
  }];
};

const saveTemplate = async ({ id, guideId, name, isActive, fields, actor }) => {
  if (guideId && !await Guide.findByPk(guideId)) { const error = new Error('Không tìm thấy bài hướng dẫn.'); error.status = 404; throw error; }
  const payload = { guideId, name: clean(name, 160), isActive: isActive !== false, fields: normalizeFields(fields) };
  if (!payload.name) { const error = new Error('Tên mẫu là bắt buộc.'); error.status = 400; throw error; }
  if (id) {
    const template = await GuideQuestionTemplate.findByPk(id);
    if (!template) { const error = new Error('Không tìm thấy mẫu câu hỏi.'); error.status = 404; throw error; }
    await template.update(payload);
    return template;
  }
  return GuideQuestionTemplate.create({ ...payload, createdBy: actor });
};

const deleteTemplate = async (id) => {
  const template = await GuideQuestionTemplate.findByPk(id);
  if (!template) { const error = new Error('Không tìm thấy mẫu câu hỏi.'); error.status = 404; throw error; }
  await template.destroy();
};

const submitGuideQuestion = async ({ user, guestId, guideSlug, templateId, answers }) => {
  const profile = await UserProfile.findByPk(user?.id, { attributes: ['email'] });
  const email = clean(profile?.email, 255).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('Hãy thêm email hợp lệ vào hồ sơ tài khoản trước khi gửi câu hỏi.'); error.status = 400; throw error;
  }
  if (!clean(guestId, 191)) { const error = new Error('Phiên hỏi đáp không hợp lệ.'); error.status = 400; throw error; }
  const guide = await Guide.findOne({ where: { slug: guideSlug, status: 'published' }, attributes: ['id', 'slug', 'title'] });
  if (!guide) { const error = new Error('Không tìm thấy bài hướng dẫn đã đăng.'); error.status = 404; throw error; }
  const template = templateId === DEFAULT_TEMPLATE_ID
    ? { id: DEFAULT_TEMPLATE_ID, name: 'Câu hỏi của bạn', fields: DEFAULT_FIELDS }
    : await GuideQuestionTemplate.findOne({
      where: { id: templateId, isActive: true, [Op.or]: [{ guideId: guide.id }, { guideId: null }] },
    });
  if (!template) { const error = new Error('Mẫu câu hỏi không tồn tại hoặc đã tắt.'); error.status = 404; throw error; }
  const snapshot = validateAnswerValues(template.fields, answers);
  const text = snapshot.map(item => `${item.label}: ${item.value || '(bỏ trống)'}`).join('\n');
  const accountGuestId = `user_${user.id}`;
  const id = randomUUID();
  const requestNumber = formatSupportRequestNumber(id);
  const message = await LiveChatMessage.create({
    id, guestId: accountGuestId, userId: user.id, role: 'user', messageType: 'guide_question',
    content: text, name: user.username, email,
    guideContext: { slug: guide.slug, title: guide.title },
    questionSnapshot: { templateId: template.id, templateName: template.name, requestNumber, fields: snapshot },
  });
  const unread = await LiveChatMessage.count({ where: { guestId: accountGuestId, role: 'user', isRead: false } });
  const purchase = await require('./chat-purchase.service').getConversationSnapshot(accountGuestId);
  notifyTelegramGuideQuestion({
    guestId: accountGuestId,
    purchaseStatus: purchase?.purchaseStatus,
    email,
    guideTitle: guide.title,
    guideSlug: guide.slug,
  });
  emitSupportRequest({ guestId: accountGuestId, request: {
    id: message.id, guestId: accountGuestId, userId: user.id, isAccountChat: true, text, name: user.username, email, messageType: 'guide_question',
    timestamp: message.createdAt,
    guideContext: message.guideContext,
    questionSnapshot: message.questionSnapshot,
    unreadCount: unread,
    purchase,
  } });
  return { id: message.id, requestNumber, createdAt: message.createdAt };
};

module.exports = { DEFAULT_TEMPLATE_ID, formatSupportRequestNumber, parseFields, normalizeFields, validateAnswerValues, findReusableTemplate, listTemplatesForGuide, saveTemplate, deleteTemplate, submitGuideQuestion };