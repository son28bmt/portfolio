const express = require('express');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const { Guide, GuideTopic, GuideQuestionTemplate } = require('../models');
const { protect } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/require-admin.middleware');
const { saveTemplate, deleteTemplate } = require('../services/guide-question.service');
const { sanitizeGuideHtml } = require('../utils/sanitizeGuideHtml');

const router = express.Router();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class InputError extends Error {}

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  skip: (req) => req.method === 'OPTIONS',
  message: { message: 'Bạn đã gửi quá nhiều yêu cầu ghi. Vui lòng thử lại sau.' },
});

router.use(protect, requireRoles('owner', 'editor'));

const badRequest = (res, message) => res.status(400).json({ message });
const notFound = (res, message = 'Không tìm thấy dữ liệu.') => res.status(404).json({ message });
const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const plainText = (value) => sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} }).trim();
const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');
const isInputError = (error) => error instanceof InputError
  || ['SequelizeValidationError', 'SequelizeUniqueConstraintError'].includes(error?.name);

const parsePositiveInteger = (value, fallback, name, max = null) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new InputError(`${name} phải là số nguyên dương.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new InputError(`${name} phải là số nguyên dương.`);
  return max ? Math.min(parsed, max) : parsed;
};

const validateSlug = (value) => {
  if (typeof value !== 'string' || !slugPattern.test(value)) {
    throw new InputError('Slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang đơn.');
  }
  return value;
};

const validateTitle = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 255) {
    throw new InputError('Tiêu đề là bắt buộc và không quá 255 ký tự.');
  }
  return value.trim();
};

const validateContent = (value) => {
  if (typeof value !== 'string' || !value.trim()) throw new InputError('Nội dung là bắt buộc.');
  if (Buffer.byteLength(value, 'utf8') > 500 * 1024) throw new InputError('Nội dung không được vượt quá 500 KB.');
  const clean = sanitizeGuideHtml(value);
  if (!plainText(clean)) throw new InputError('Nội dung không hợp lệ sau khi lọc an toàn.');
  return clean;
};

const validateImage = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new InputError('Ảnh phải là URL https:// hợp lệ.');
  let imageUrl;
  try {
    imageUrl = new URL(value);
  } catch {
    throw new InputError('Ảnh phải là URL https:// hợp lệ.');
  }
  if (imageUrl.protocol !== 'https:') throw new InputError('Ảnh phải là URL https:// hợp lệ.');

  const publicBase = String(process.env.R2_PUBLIC_BASE_URL || '').trim();
  if (publicBase) {
    let baseUrl;
    try {
      baseUrl = new URL(publicBase);
    } catch {
      throw new InputError('Cấu hình URL công khai R2 không hợp lệ.');
    }
    const basePath = baseUrl.pathname.replace(/\/+$/, '');
    if (imageUrl.origin !== baseUrl.origin
      || !(imageUrl.pathname === basePath || imageUrl.pathname.startsWith(`${basePath}/`))) {
      throw new InputError('Ảnh phải thuộc địa chỉ công khai R2 đã cấu hình.');
    }
  }
  return imageUrl.toString();
};

const validateTopicId = async (value) => {
  if (value === null || value === undefined || value === '') return null;
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) {
    throw new InputError('topicId không hợp lệ.');
  }
  const topic = await GuideTopic.findByPk(String(value));
  if (!topic) throw new InputError('topicId không tồn tại.');
  return topic.id;
};

const validateReadTime = (value) => {
  if (typeof value !== 'string' || value.length > 20) throw new InputError('readTime không quá 20 ký tự.');
  return value.trim();
};

const ensureUniqueSlug = async (slug, currentId = null) => {
  const existing = await Guide.findOne({ where: { slug } });
  if (existing && existing.id !== currentId) throw new InputError('Slug đã tồn tại.');
};

const buildGuidePayload = async (body, { creating = false, currentId = null } = {}) => {
  const payload = {};
  if (creating || has(body, 'title')) payload.title = validateTitle(body.title);
  if (creating || has(body, 'content')) payload.content = validateContent(body.content);
  if (creating || has(body, 'excerpt')) {
    const excerpt = body.excerpt === null || body.excerpt === undefined ? null : plainText(body.excerpt);
    if (excerpt && excerpt.length > 500) throw new InputError('excerpt không quá 500 ký tự.');
    payload.excerpt = excerpt;
  }
  if (creating || has(body, 'readTime')) payload.readTime = validateReadTime(body.readTime === undefined ? '5 min' : body.readTime);
  if (creating || has(body, 'image')) payload.image = validateImage(body.image);
  if (creating || has(body, 'topicId')) payload.topicId = await validateTopicId(body.topicId);
  if (has(body, 'slug')) {
    payload.slug = validateSlug(body.slug);
    await ensureUniqueSlug(payload.slug, currentId);
  }
  return payload;
};

const parseGuideListQuery = (query) => {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = parsePositiveInteger(query.limit, 12, 'limit', 50);
  if (query.status !== undefined && !['draft', 'published'].includes(query.status)) throw new InputError('status không hợp lệ.');
  if (query.topic !== undefined && (typeof query.topic !== 'string' || !slugPattern.test(query.topic))) throw new InputError('topic không hợp lệ.');
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) throw new InputError('q phải là chuỗi không quá 100 ký tự.');
  return { page, limit, status: query.status, topic: query.topic, q: String(query.q || '').trim() };
};

router.get('/topics', async (req, res) => {
  try {
    const topics = await GuideTopic.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    return res.json(topics);
  } catch (error) {
    console.error('[Guide Admin API] Cannot list topics:', error);
    return res.status(500).json({ message: 'Không thể tải chủ đề.' });
  }
});

router.get('/questions', async (req, res) => {
  try {
    const guideId = String(req.query.guideId || '');
    if (!uuidPattern.test(guideId)) return badRequest(res, 'guideId không hợp lệ.');
    const templates = await GuideQuestionTemplate.findAll({
      where: { [Op.or]: [{ guideId }, { guideId: null }] },
      order: [['createdAt', 'DESC']],
    });
    return res.json(templates);
  } catch (error) {
    console.error('[Guide Admin API] Cannot list question templates:', error);
    return res.status(500).json({ message: 'Không thể tải mẫu câu hỏi.' });
  }
});

router.post('/questions', writeLimiter, async (req, res) => {
  try {
    const template = await saveTemplate({
      guideId: req.body?.guideId, name: req.body?.name,
      isActive: req.body?.isActive, fields: req.body?.fields, actor: req.user?.username || req.user?.id,
    });
    return res.status(201).json(template);
  } catch (error) {
    if (error.status === 400) return badRequest(res, error.message);
    if (error.status === 404) return notFound(res, error.message);
    console.error('[Guide Admin API] Cannot create question template:', error);
    return res.status(500).json({ message: 'Không thể tạo mẫu câu hỏi.' });
  }
});

router.put('/questions/:id', writeLimiter, async (req, res) => {
  try {
    const template = await saveTemplate({
      id: req.params.id, guideId: req.body?.guideId, name: req.body?.name,
      isActive: req.body?.isActive, fields: req.body?.fields, actor: req.user?.username || req.user?.id,
    });
    return res.json(template);
  } catch (error) {
    if (error.status === 400) return badRequest(res, error.message);
    if (error.status === 404) return notFound(res, error.message);
    console.error('[Guide Admin API] Cannot update question template:', error);
    return res.status(500).json({ message: 'Không thể cập nhật mẫu câu hỏi.' });
  }
});

router.delete('/questions/:id', writeLimiter, async (req, res) => {
  try {
    await deleteTemplate(req.params.id);
    return res.status(204).end();
  } catch (error) {
    if (error.status === 404) return notFound(res, error.message);
    console.error('[Guide Admin API] Cannot delete question template:', error);
    return res.status(500).json({ message: 'Không thể xóa mẫu câu hỏi.' });
  }
});

router.post('/topics', writeLimiter, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100) return badRequest(res, 'Tên chủ đề là bắt buộc và không quá 100 ký tự.');
    if (has(req.body, 'sortOrder') && !Number.isInteger(req.body.sortOrder)) {
      return badRequest(res, 'sortOrder phải là số nguyên.');
    }
    const payload = {
      name,
      description: req.body?.description === undefined ? null : plainText(req.body.description) || null,
      sortOrder: Number.isInteger(req.body?.sortOrder) ? req.body.sortOrder : 0,
      isVisible: req.body?.isVisible === undefined ? true : req.body.isVisible,
    };
    if (typeof payload.isVisible !== 'boolean') return badRequest(res, 'isVisible phải là boolean.');
    if (has(req.body, 'slug')) payload.slug = validateSlug(req.body.slug);
    const topic = await GuideTopic.create(payload);
    return res.status(201).json(topic);
  } catch (error) {
    if (isInputError(error)) return badRequest(res, error.message || 'Dữ liệu không hợp lệ.');
    console.error('[Guide Admin API] Cannot create topic:', error);
    return res.status(500).json({ message: 'Không thể tạo chủ đề.' });
  }
});

router.put('/topics/:id', writeLimiter, async (req, res) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return badRequest(res, 'ID chủ đề không hợp lệ.');
    const topic = await GuideTopic.findByPk(req.params.id);
    if (!topic) return notFound(res, 'Không tìm thấy chủ đề.');
    const payload = {};
    if (has(req.body, 'name')) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 100) {
        return badRequest(res, 'Tên chủ đề là bắt buộc và không quá 100 ký tự.');
      }
      payload.name = req.body.name.trim();
    }
    if (has(req.body, 'description')) payload.description = plainText(req.body.description) || null;
    if (has(req.body, 'sortOrder')) {
      if (!Number.isInteger(req.body.sortOrder)) return badRequest(res, 'sortOrder phải là số nguyên.');
      payload.sortOrder = req.body.sortOrder;
    }
    if (has(req.body, 'isVisible')) {
      if (typeof req.body.isVisible !== 'boolean') return badRequest(res, 'isVisible phải là boolean.');
      payload.isVisible = req.body.isVisible;
    }
    if (has(req.body, 'slug')) {
      payload.slug = validateSlug(req.body.slug);
      const existing = await GuideTopic.findOne({ where: { slug: payload.slug } });
      if (existing && existing.id !== topic.id) return badRequest(res, 'Slug đã tồn tại.');
    }
    await topic.update(payload);
    return res.json(topic);
  } catch (error) {
    if (isInputError(error)) return badRequest(res, error.message || 'Dữ liệu không hợp lệ.');
    console.error('[Guide Admin API] Cannot update topic:', error);
    return res.status(500).json({ message: 'Không thể cập nhật chủ đề.' });
  }
});

router.delete('/topics/:id', writeLimiter, async (req, res) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return badRequest(res, 'ID chủ đề không hợp lệ.');
    const topic = await GuideTopic.findByPk(req.params.id);
    if (!topic) return notFound(res, 'Không tìm thấy chủ đề.');
    await topic.destroy();
    return res.status(204).end();
  } catch (error) {
    console.error('[Guide Admin API] Cannot delete topic:', error);
    return res.status(500).json({ message: 'Không thể xóa chủ đề.' });
  }
});

router.get('/', async (req, res) => {
  let query;
  try { query = parseGuideListQuery(req.query); } catch (error) { return badRequest(res, error.message); }
  try {
    const where = {};
    if (query.status) where.status = query.status;
    if (query.q) {
      const pattern = `%${escapeLike(query.q)}%`;
      where[Op.or] = [{ title: { [Op.like]: pattern } }, { excerpt: { [Op.like]: pattern } }];
    }
    const include = [{ model: GuideTopic, as: 'topic', attributes: ['id', 'name', 'slug'], required: Boolean(query.topic), ...(query.topic ? { where: { slug: query.topic } } : {}) }];
    const result = await Guide.findAndCountAll({
      attributes: ['id', 'slug', 'title', 'excerpt', 'image', 'status', 'readTime', 'publishedAt', 'updatedAt'],
      where, include, distinct: true,
      order: [['updatedAt', 'DESC']], limit: query.limit, offset: (query.page - 1) * query.limit,
    });
    return res.json({ items: result.rows, total: result.count, page: query.page, totalPages: Math.ceil(result.count / query.limit) });
  } catch (error) {
    console.error('[Guide Admin API] Cannot list guides:', error);
    return res.status(500).json({ message: 'Không thể tải bài hướng dẫn.' });
  }
});

router.post('/', writeLimiter, async (req, res) => {
  try {
    const payload = await buildGuidePayload(req.body || {}, { creating: true });
    const guide = await Guide.create({ ...payload, status: 'draft' });
    return res.status(201).json(guide);
  } catch (error) {
    if (isInputError(error)) return badRequest(res, error.message || 'Dữ liệu không hợp lệ.');
    console.error('[Guide Admin API] Cannot create guide:', error);
    return res.status(500).json({ message: 'Không thể tạo bài hướng dẫn.' });
  }
});

router.post('/:id/publish', writeLimiter, async (req, res) => {
  try {
    if (!uuidPattern.test(req.params.id)) return badRequest(res, 'ID bài hướng dẫn không hợp lệ.');
    const guide = await Guide.findByPk(req.params.id);
    if (!guide) return notFound(res, 'Không tìm thấy bài hướng dẫn.');
    await guide.update({ status: 'published', publishedAt: guide.publishedAt || new Date() });
    return res.json(guide);
  } catch (error) {
    console.error('[Guide Admin API] Cannot publish guide:', error);
    return res.status(500).json({ message: 'Không thể đăng bài hướng dẫn.' });
  }
});

router.post('/:id/unpublish', writeLimiter, async (req, res) => {
  try {
    if (!uuidPattern.test(req.params.id)) return badRequest(res, 'ID bài hướng dẫn không hợp lệ.');
    const guide = await Guide.findByPk(req.params.id);
    if (!guide) return notFound(res, 'Không tìm thấy bài hướng dẫn.');
    await guide.update({ status: 'draft' });
    return res.json(guide);
  } catch (error) {
    console.error('[Guide Admin API] Cannot unpublish guide:', error);
    return res.status(500).json({ message: 'Không thể rút bài hướng dẫn.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!uuidPattern.test(req.params.id)) return badRequest(res, 'ID bài hướng dẫn không hợp lệ.');
    const guide = await Guide.findByPk(req.params.id, { include: [{ model: GuideTopic, as: 'topic', attributes: ['id', 'name', 'slug'] }] });
    return guide ? res.json(guide) : notFound(res, 'Không tìm thấy bài hướng dẫn.');
  } catch (error) {
    console.error('[Guide Admin API] Cannot load guide:', error);
    return res.status(500).json({ message: 'Không thể tải bài hướng dẫn.' });
  }
});

router.put('/:id', writeLimiter, async (req, res) => {
  try {
    if (!uuidPattern.test(req.params.id)) return badRequest(res, 'ID bài hướng dẫn không hợp lệ.');
    const guide = await Guide.findByPk(req.params.id);
    if (!guide) return notFound(res, 'Không tìm thấy bài hướng dẫn.');
    const payload = await buildGuidePayload(req.body || {}, { currentId: guide.id });
    await guide.update(payload);
    return res.json(guide);
  } catch (error) {
    if (isInputError(error)) return badRequest(res, error.message || 'Dữ liệu không hợp lệ.');
    console.error('[Guide Admin API] Cannot update guide:', error);
    return res.status(500).json({ message: 'Không thể cập nhật bài hướng dẫn.' });
  }
});

router.delete('/:id', writeLimiter, async (req, res) => {
  try {
    if (!uuidPattern.test(req.params.id)) return badRequest(res, 'ID bài hướng dẫn không hợp lệ.');
    const guide = await Guide.findByPk(req.params.id);
    if (!guide) return notFound(res, 'Không tìm thấy bài hướng dẫn.');
    await guide.destroy();
    return res.status(204).end();
  } catch (error) {
    console.error('[Guide Admin API] Cannot delete guide:', error);
    return res.status(500).json({ message: 'Không thể xóa bài hướng dẫn.' });
  }
});

module.exports = router;
