const express = require('express');
const rateLimit = require('express-rate-limit');
const { Op, fn, col } = require('sequelize');
const { Guide, GuideTopic } = require('../models');
const { listTemplatesForGuide } = require('../services/guide-question.service');
const { sanitizeGuideHtml } = require('../utils/sanitizeGuideHtml');

const router = express.Router();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  skip: (req) => req.method === 'OPTIONS',
  message: { message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' },
}));

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sendBadRequest = (res, message) => res.status(400).json({ message });

const parsePositiveInteger = (value, fallback, name, max = null) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${name} phải là số nguyên dương.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} phải là số nguyên dương.`);
  }

  return max ? Math.min(parsed, max) : parsed;
};

const parseListQuery = (query) => {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = parsePositiveInteger(query.limit, 12, 'limit', 50);

  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) {
    throw new Error('q phải là chuỗi không quá 100 ký tự.');
  }

  const q = String(query.q || '').trim();
  if (query.topic !== undefined && typeof query.topic !== 'string') {
    throw new Error('topic phải là slug hợp lệ.');
  }

  const topic = String(query.topic || '').trim();
  if (topic && (topic.length > 120 || !slugPattern.test(topic))) {
    throw new Error('topic phải là slug hợp lệ.');
  }

  return { page, limit, q, topic };
};

const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

const topicInclude = (required = false, where = undefined) => ({
  model: GuideTopic,
  as: 'topic',
  attributes: ['id', 'name', 'slug'],
  required,
  ...(where ? { where } : {}),
});

router.get('/topics', async (req, res) => {
  try {
    const topics = await GuideTopic.findAll({
      attributes: [
        'id',
        'name',
        'slug',
        'description',
        [fn('COUNT', col('guides.id')), 'guideCount'],
      ],
      where: { isVisible: true },
      include: [{
        model: Guide,
        as: 'guides',
        attributes: [],
        required: false,
        where: { status: 'published' },
      }],
      group: [
        'GuideTopic.id',
        'GuideTopic.name',
        'GuideTopic.slug',
        'GuideTopic.description',
        'GuideTopic.sort_order',
      ],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });

    return res.json(topics.map((topic) => {
      const data = topic.toJSON();
      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        guideCount: Number(data.guideCount || 0),
      };
    }));
  } catch (error) {
    console.error('[Guides API] Cannot list topics:', error);
    return res.status(500).json({ message: 'Không thể tải chủ đề hướng dẫn.' });
  }
});

router.get('/', async (req, res) => {
  let query;
  try {
    query = parseListQuery(req.query);
  } catch (error) {
    return sendBadRequest(res, error.message);
  }

  try {
    const where = { status: 'published' };
    if (query.q) {
      const pattern = `%${escapeLike(query.q)}%`;
      where[Op.or] = [
        { title: { [Op.like]: pattern } },
        { excerpt: { [Op.like]: pattern } },
      ];
    }

    const include = query.topic
      ? [topicInclude(true, { slug: query.topic, isVisible: true })]
      : [topicInclude()];
    const result = await Guide.findAndCountAll({
      attributes: ['id', 'slug', 'title', 'excerpt', 'image', 'readTime', 'publishedAt', 'updatedAt'],
      where,
      include,
      distinct: true,
      order: [['publishedAt', 'DESC'], ['updatedAt', 'DESC']],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });

    return res.json({
      items: result.rows,
      total: result.count,
      page: query.page,
      totalPages: Math.ceil(result.count / query.limit),
    });
  } catch (error) {
    console.error('[Guides API] Cannot list guides:', error);
    return res.status(500).json({ message: 'Không thể tải bài hướng dẫn.' });
  }
});

router.get('/:slug/questions', async (req, res) => {
  try {
    const templates = await listTemplatesForGuide(req.params.slug);
    return templates ? res.json(templates) : res.status(404).json({ message: 'Không tìm thấy bài hướng dẫn.' });
  } catch (error) {
    console.error('[Guides API] Cannot load question templates:', error);
    return res.status(500).json({ message: 'Không thể tải mẫu câu hỏi.' });
  }
});

router.get('/:slug', async (req, res) => {
  const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
  if (!slug || slug.length > 191 || !slugPattern.test(slug)) {
    return res.status(404).json({ message: 'Không tìm thấy bài hướng dẫn.' });
  }

  try {
    const guide = await Guide.findOne({
      where: { slug, status: 'published' },
      include: [topicInclude()],
    });

    if (!guide) {
      return res.status(404).json({ message: 'Không tìm thấy bài hướng dẫn.' });
    }

    const relatedGuides = guide.topicId
      ? await Guide.findAll({
        attributes: ['slug', 'title'],
        where: {
          status: 'published',
          topicId: guide.topicId,
          id: { [Op.ne]: guide.id },
        },
        order: [['publishedAt', 'DESC'], ['updatedAt', 'DESC']],
        limit: 3,
      })
      : [];

    return res.json({
      ...guide.toJSON(),
      content: sanitizeGuideHtml(guide.content),
      relatedGuides,
    });
  } catch (error) {
    console.error('[Guides API] Cannot load guide:', error);
    return res.status(500).json({ message: 'Không thể tải bài hướng dẫn.' });
  }
});

module.exports = router;
