const express = require('express');
const rateLimit = require('express-rate-limit');
const { LayoutPost: DefaultLayoutPost, GuideQuestionTemplate } = require('../models');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, validate: { default: false } });

function buildPublicLayoutPostRouter(LayoutPost = DefaultLayoutPost, QuestionTemplate = GuideQuestionTemplate) {
  const router = express.Router();
  router.get('/:id/questions', limiter, async (req, res) => {
    try {
      const post = await LayoutPost.findOne({ where: { id: req.params.id, status: 'published' }, attributes: ['id', 'layout'] });
      if (!post) return res.status(404).set('Cache-Control', 'no-store').json({ message: 'Không tìm thấy bài viết.' });
      const block = (post.layout || []).find(item => item.type === 'question');
      const templateId = block?.props?.templateId;
      if (!templateId) return res.set('Cache-Control', 'no-store').json(null);
      const template = await QuestionTemplate.findOne({ where: { id: templateId, isActive: true, guideId: null }, attributes: ['id', 'name', 'fields'] });
      res.set('Cache-Control', template ? 'public, max-age=60' : 'no-store');
      return res.json(template ? { id: template.id, name: template.name, fields: template.fields } : null);
    } catch (error) { return res.status(500).set('Cache-Control', 'no-store').json({ message: 'Không thể tải bộ câu hỏi.' }); }
  });
  router.get('/:id', limiter, async (req, res) => {
    try {
      const post = await LayoutPost.findOne({ where: { id: req.params.id, status: 'published' }, attributes: ['id', 'title', 'layout', 'content', 'publishedAt'] });
      if (!post) return res.status(404).set('Cache-Control', 'no-store').json({ message: 'Không tìm thấy bài viết.' });
      const data = post.toJSON ? post.toJSON() : post;
      res.set('Cache-Control', 'public, max-age=60');
      return res.json({ id: data.id, title: data.title, layout: data.layout, content: data.content, publishedAt: data.publishedAt });
    } catch (error) {
      console.error('[Public layout post] Load failed:', error.message);
      return res.status(500).json({ message: 'Không thể tải bài viết.' });
    }
  });
  return router;
}

module.exports = buildPublicLayoutPostRouter();
module.exports.buildPublicLayoutPostRouter = buildPublicLayoutPostRouter;