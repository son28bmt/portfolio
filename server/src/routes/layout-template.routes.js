const express = require('express');
const { Op } = require('sequelize');
const { LayoutTemplate, LayoutPost } = require('../models');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const { assertTemplateNotInUse, validateTemplatePayload } = require('../services/layout-validation.service');

const router = express.Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
router.use(protect, requireAdmin);

const parsePage = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1) {
    const error = new Error('page và limit phải là số nguyên dương.');
    error.status = 400;
    throw error;
  }
  return Math.min(Number(value), max);
};

const findTemplate = async (id) => {
  if (!uuidPattern.test(id)) return null;
  return LayoutTemplate.findByPk(id);
};

const serializeTemplate = (template, includeBlocks = false) => {
  const data = template.toJSON();
  if (!includeBlocks) {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      blockCount: Array.isArray(data.blocks) ? data.blocks.length : 0,
      updatedAt: data.updatedAt,
    };
  }
  return data;
};

const handleError = (res, error, fallback = 'Không thể xử lý mẫu bố cục.') => {
  const status = Number(error.status || (error.name === 'SequelizeForeignKeyConstraintError' ? 409 : 500));
  const body = { message: error.message || fallback };
  if (error.code) body.code = error.code;
  if (error.errors) body.errors = error.errors;
  if (status >= 500) console.error('[Layout templates] Request failed:', error);
  return res.status(status).json(body);
};

router.get('/', async (req, res) => {
  try {
    const page = parsePage(req.query.page, 1);
    const limit = parsePage(req.query.limit, 12, 50);
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 150) : '';
    const where = {};
    if (query) where.name = { [Op.like]: `%${query.replace(/[\\%_]/g, '\\$&')}%` };
    const result = await LayoutTemplate.findAndCountAll({
      attributes: ['id', 'name', 'description', 'blocks', 'updatedAt'],
      where,
      order: [['updatedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json({
      items: result.rows.map((item) => serializeTemplate(item)),
      total: result.count,
      page,
      totalPages: Math.max(1, Math.ceil(result.count / limit)),
    });
  } catch (error) {
    return handleError(res, error, 'Không thể tải danh sách mẫu.');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const template = await findTemplate(req.params.id);
    if (!template) return res.status(404).json({ message: 'Không tìm thấy mẫu bố cục.' });
    return res.json(serializeTemplate(template, true));
  } catch (error) {
    return handleError(res, error, 'Không thể tải mẫu bố cục.');
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = validateTemplatePayload(req.body);
    const template = await LayoutTemplate.create({
      name: payload.name,
      description: payload.description,
      blocks: payload.blocks,
      schemaVersion: payload.schemaVersion,
      createdBy: String(req.user?.id || ''),
    });
    return res.status(201).json(serializeTemplate(template, true));
  } catch (error) {
    return handleError(res, error, 'Không thể tạo mẫu bố cục.');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const template = await findTemplate(req.params.id);
    if (!template) return res.status(404).json({ message: 'Không tìm thấy mẫu bố cục.' });
    const payload = validateTemplatePayload(req.body);
    await template.update({
      name: payload.name,
      description: payload.description,
      blocks: payload.blocks,
      schemaVersion: payload.schemaVersion,
    });
    return res.json(serializeTemplate(template, true));
  } catch (error) {
    return handleError(res, error, 'Không thể cập nhật mẫu bố cục.');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const template = await findTemplate(req.params.id);
    if (!template) return res.status(404).json({ message: 'Không tìm thấy mẫu bố cục.' });
    const postCount = await LayoutPost.count({ where: { templateId: template.id } });
    assertTemplateNotInUse(postCount);
    await template.destroy();
    return res.json({ message: 'Đã xóa mẫu bố cục.' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      const count = await LayoutPost.count({ where: { templateId: req.params.id } }).catch(() => 0);
      try { assertTemplateNotInUse(Math.max(1, count)); } catch (conflict) { return handleError(res, conflict); }
    }
    return handleError(res, error, 'Không thể xóa mẫu bố cục.');
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const template = await findTemplate(req.params.id);
    if (!template) return res.status(404).json({ message: 'Không tìm thấy mẫu bố cục.' });
    const duplicate = await LayoutTemplate.create({
      name: `${template.name} (bản sao)`.slice(0, 150),
      description: template.description,
      blocks: template.blocks,
      schemaVersion: template.schemaVersion,
      createdBy: String(req.user?.id || ''),
    });
    return res.status(201).json(serializeTemplate(duplicate, true));
  } catch (error) {
    return handleError(res, error, 'Không thể nhân bản mẫu bố cục.');
  }
});

module.exports = router;