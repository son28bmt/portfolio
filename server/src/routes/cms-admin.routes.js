const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');
const { Op } = require('sequelize');
const { protect } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/require-admin.middleware');
const { Blog, Guide } = require('../models');
const { uploadBufferToR2 } = require('../services/r2.service');
const { assertCmsImageBuffer } = require('../services/cms-upload.service');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, validate: { default: false } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.use(protect, requireRoles('owner', 'editor'));

router.post('/upload-image', limiter, upload.single('image'), async (req, res) => {
  try {
    assertCmsImageBuffer(req.file?.buffer);
    const folder = /^cms\/(content|cover|og|images)$/.test(String(req.body.folder || '')) ? req.body.folder : 'cms/images';
    const buffer = await sharp(req.file.buffer, { animated: false, failOn: 'error' })
      .rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 }).toBuffer();
    const url = await uploadBufferToR2({ buffer, originalName: `${req.file.originalname}.webp`, mimeType: 'image/webp', folder });
    return res.status(201).json({ url, mimeType: 'image/webp', size: buffer.length });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể xử lý ảnh.' });
  }
});

router.get('/:postType/check-slug', async (req, res) => {
  const Model = req.params.postType === 'blog' ? Blog : req.params.postType === 'guide' ? Guide : null;
  const slug = String(req.query.slug || '').trim();
  if (!Model || !slug) return res.status(400).json({ message: 'Slug không hợp lệ.' });
  const where = { slug, ...(uuidPattern.test(String(req.query.id || '')) ? { id: { [Op.ne]: req.query.id } } : {}) };
  return res.json({ available: !(await Model.findOne({ where })) });
});

router.get('/:postType/list', async (req, res) => {
  const Model = req.params.postType === 'blog' ? Blog : req.params.postType === 'guide' ? Guide : null;
  if (!Model) return res.status(400).json({ message: 'Loại bài viết không hợp lệ.' });
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const where = {};
  if (['draft', 'scheduled', 'published', 'archived'].includes(req.query.status)) where.status = req.query.status;
  if (req.query.q) where.title = { [Op.like]: `%${String(req.query.q).replace(/[\\%_]/g, '\\$&')}%` };
  const { count, rows } = await Model.findAndCountAll({ where, order: [['updatedAt', 'DESC']], limit, offset: (page - 1) * limit });
  return res.json({ items: rows, total: count, page, totalPages: Math.ceil(count / limit) });
});

router.get('/:postType/:id', async (req, res) => {
  const Model = req.params.postType === 'blog' ? Blog : req.params.postType === 'guide' ? Guide : null;
  if (!Model || !uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Bài viết không hợp lệ.' });
  const post = await Model.findByPk(req.params.id);
  return post ? res.json(post) : res.status(404).json({ message: 'Không tìm thấy bài viết.' });
});

module.exports = router;