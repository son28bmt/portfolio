const express = require('express');
const { Op } = require('sequelize');
const { LayoutPost, GuideQuestionTemplate } = require('../models');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const { assertPostUpdatedAt, validatePostPayload } = require('../services/layout-validation.service');
const { publishLayoutPost } = require('../services/layout-post-publish.service');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const errorBody = (res, error, fallback) => {
  const status = Number(error.status || 500);
  return res.status(status).json({
    message: error.message || fallback,
    code: error.code || (status === 400 ? 'LAYOUT_POST_VALIDATION_ERROR' : status === 409 ? 'LAYOUT_POST_CONFLICT' : 'LAYOUT_POST_ERROR'),
    errors: error.errors || [],
  });
};
const parsePage = (value, fallback, max = 50) => Math.min(max, Math.max(1, Number.parseInt(value, 10) || fallback));
const validateQuestionBlocks = async (layout, publishing, QuestionTemplate = GuideQuestionTemplate) => {
  const questions = (layout || []).filter(block => block.type === 'question');
  if (!publishing) return;
  if (questions.length > 1) { const error = new Error('Chỉ được có tối đa 1 block Question khi đăng.'); error.status = 400; error.errors = questions.map(block => ({ blockId: block.id, message: error.message })); throw error; }
  if (!questions.length) return;
  const block = questions[0];
  const template = block.props?.templateId ? await QuestionTemplate.findOne({ where: { id: block.props.templateId, isActive: true, guideId: null } }) : null;
  if (!template) { const error = new Error(`block ${block.id}: bộ câu hỏi phải tồn tại, đang bật và dùng chung.`); error.status = 400; error.errors = [{ blockId: block.id, message: error.message }]; throw error; }
};
const serializeList = (post) => { const data = post.toJSON(); return { id: data.id, title: data.title, status: data.status, templateId: data.templateId, publishTarget: data.publishTarget || 'blog', publishedPostId: data.publishedPostId, publishedPostSlug: data.publishedPostSlug, updatedAt: data.updatedAt }; };

function buildLayoutPostRouter({ PostModel = LayoutPost, QuestionTemplate = GuideQuestionTemplate, protectMiddleware = protect, adminMiddleware = requireAdmin } = {}) {
  const router = express.Router();
  router.use(protectMiddleware, adminMiddleware);

router.get('/', async (req, res) => {
  try {
    const page = parsePage(req.query.page, 1);
    const limit = parsePage(req.query.limit, 12);
    const where = {};
    if (req.query.status) {
      if (!['draft', 'published'].includes(req.query.status)) return res.status(400).json({ message: 'status chỉ được draft hoặc published.', code: 'LAYOUT_POST_VALIDATION_ERROR', errors: [] });
      where.status = req.query.status;
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
    if (q) where.title = { [Op.like]: `%${q.replace(/[\\%_]/g, '\\$&')}%` };
    const result = await PostModel.findAndCountAll({ where, attributes: ['id', 'title', 'status', 'templateId', 'publishTarget', 'publishedPostId', 'publishedPostSlug', 'updatedAt'], order: [['updatedAt', 'DESC']], limit, offset: (page - 1) * limit });
    return res.json({ items: result.rows.map(serializeList), total: result.count, page, totalPages: Math.max(1, Math.ceil(result.count / limit)) });
  } catch (error) { return errorBody(res, error, 'Không thể tải danh sách bài.'); }
});

router.get('/question-templates', async (req, res) => {
  try {
    const templates = await QuestionTemplate.findAll({ where: { isActive: true, guideId: null }, attributes: ['id', 'name', 'fields'], order: [['createdAt', 'DESC']] });
    return res.json(templates.map(template => {
      const data = template.toJSON();
      if (typeof data.fields === 'string') { try { data.fields = JSON.parse(data.fields); } catch { data.fields = []; } }
      return data;
    }));
  } catch (error) { return errorBody(res, error, 'Không thể tải bộ câu hỏi.'); }
});

router.get('/:id', async (req, res) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(404).json({ message: 'Không tìm thấy bài.' });
    const post = await PostModel.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài.' });
    return res.json({ ...(post.toJSON ? post.toJSON() : post), publishTarget: post.publishTarget || 'blog' });
  } catch (error) { return errorBody(res, error, 'Không thể tải bài.'); }
});

router.post('/', async (req, res) => {
  try {
    const payload = validatePostPayload(req.body, { publishing: req.body?.status === 'published' });
    await validateQuestionBlocks(payload.layout, req.body?.status === 'published', QuestionTemplate);
    const post = await PostModel.create({ ...payload, publishTarget: req.body?.publishTarget || 'blog', publishedAt: payload.status === 'published' ? new Date() : null, createdBy: String(req.user?.id || '') });
    if (payload.status === 'published') {
      await PostModel.sequelize.transaction(async (transaction) => {
        const locked = await PostModel.findByPk(post.id, { transaction, lock: transaction.LOCK.UPDATE });
        await publishLayoutPost({ layoutPost: locked, payload: { ...payload, publishTarget: locked.publishTarget }, userId: req.user?.id, transaction });
      });
      await post.reload();
    }
    return res.status(201).json(post);
  } catch (error) { return errorBody(res, error, 'Không thể tạo bài.'); }
});

router.put('/:id', async (req, res) => {
  try {
    return await PostModel.sequelize.transaction(async (transaction) => {
      const post = await PostModel.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!post) return res.status(404).json({ message: 'Không tìm thấy bài.' });
      assertPostUpdatedAt(post.updatedAt, req.body?.updatedAt);
      const payload = validatePostPayload(req.body, { publishing: post.status === 'published' || req.body?.status === 'published' });
      await validateQuestionBlocks(payload.layout, post.status === 'published' || req.body?.status === 'published', QuestionTemplate);
      const now = new Date();
      const updatedAt = now <= new Date(post.updatedAt) ? new Date(new Date(post.updatedAt).getTime() + 1000) : now;
      const publishTarget = req.body?.publishTarget || post.publishTarget || 'blog';
      if (post.publishedPostId && publishTarget !== post.publishTarget) { const error = new Error('Không thể đổi nơi đăng sau khi bài đã được đăng.'); error.status = 400; throw error; }
      await post.update({ ...payload, publishTarget, updatedAt, publishedAt: payload.status === 'published' ? (post.publishedAt || now) : null }, { transaction });
      if (payload.status === 'published') await publishLayoutPost({ layoutPost: post, payload: { ...payload, publishTarget }, userId: req.user?.id, transaction });
      return res.json(post);
    });
  } catch (error) { return errorBody(res, error, 'Không thể cập nhật bài.'); }
});

router.delete('/:id', async (req, res) => {
  try {
    const post = await PostModel.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài.' });
    await post.destroy();
    return res.json({ message: 'Đã xóa bài.' });
  } catch (error) { return errorBody(res, error, 'Không thể xóa bài.'); }
});

router.post('/:id/publish', async (req, res) => {
  try {
    return await PostModel.sequelize.transaction(async (transaction) => {
      const post = await PostModel.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!post) return res.status(404).json({ message: 'Không tìm thấy bài.' });
      assertPostUpdatedAt(post.updatedAt, req.body?.updatedAt);
      const payload = validatePostPayload({ ...post.toJSON(), ...req.body, status: 'published', layout: req.body?.layout || post.layout, content: req.body?.content || post.content }, { publishing: true });
      await validateQuestionBlocks(payload.layout, true, QuestionTemplate);
      const now = new Date();
      const updatedAt = now <= new Date(post.updatedAt) ? new Date(new Date(post.updatedAt).getTime() + 1000) : now;
      await post.update({ ...payload, publishTarget: req.body?.publishTarget || post.publishTarget || 'blog', status: 'published', updatedAt, publishedAt: post.publishedAt || now }, { transaction });
      await publishLayoutPost({ layoutPost: post, payload: { ...payload, publishTarget: req.body?.publishTarget || post.publishTarget }, userId: req.user?.id, transaction });
      return res.json(post);
    });
  } catch (error) { return errorBody(res, error, 'Không thể đăng bài.'); }
});

router.post('/:id/unpublish', async (req, res) => {
  try {
    return await PostModel.sequelize.transaction(async (transaction) => {
      const post = await PostModel.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!post) return res.status(404).json({ message: 'Không tìm thấy bài.' });
      assertPostUpdatedAt(post.updatedAt, req.body?.updatedAt);
      const now = new Date();
      const updatedAt = now <= new Date(post.updatedAt) ? new Date(new Date(post.updatedAt).getTime() + 1000) : now;
      await post.update({ status: 'draft', updatedAt }, { transaction });
      if (post.publishedPostId) {
        const { TARGETS } = require('../services/layout-post-publish.service');
        const targetPost = await TARGETS[post.publishTarget || 'blog'].findByPk(post.publishedPostId, { transaction, lock: transaction.LOCK.UPDATE });
        if (targetPost) await targetPost.update({ status: 'draft' }, { transaction });
      }
      return res.json(post);
    });
  } catch (error) { return errorBody(res, error, 'Không thể hủy đăng bài.'); }
});
  return router;
}

module.exports = buildLayoutPostRouter();
module.exports.buildLayoutPostRouter = buildLayoutPostRouter;