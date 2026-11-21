const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { protect } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/require-admin.middleware');
const { Op } = require('sequelize');
const { notifyTelegramBlogChanged } = require('../services/telegram.service');
const { normalizeCmsFields, createPostRevision, revisionApi, autosavePost, sanitizeContent, normalizeTags } = require('../services/cms-post.service');

const decodePossibleJson = (value) => {
  let current = value;

  for (let i = 0; i < 4; i += 1) {
    if (typeof current !== 'string') break;
    const text = current.trim();
    if (!text) return '';
    if (!['[', '{', '"'].includes(text[0])) break;

    try {
      current = JSON.parse(text);
    } catch {
      break;
    }
  }

  return current;
};

const toStringArray = (value, { allowCommaSplit = true } = {}) => {
  const decoded = decodePossibleJson(value);

  if (Array.isArray(decoded)) {
    return decoded.flatMap(item => toStringArray(item, { allowCommaSplit }));
  }

  if (typeof decoded === 'string') {
    const text = decoded.trim();
    if (!text) return [];

    if (allowCommaSplit && text.includes(',')) {
      return text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [text];
  }

  return [];
};

const normalizeBlogPayload = (body = {}) => {
  const tags = normalizeTags(body.tags);
  return {
    ...body,
    tags,
  };
};

const resolveBlogAuthor = async (post) => {
  const plain = post?.toJSON ? post.toJSON() : post;
  if (!plain?.authorId) return plain;
  try {
    const { User, UserProfile, Admin } = require('../models');
    const admin = await Admin.findByPk(plain.authorId, { attributes: ['username'] });
    if (admin) return { ...plain, authorName: admin.username };
    const user = await User.findByPk(plain.authorId, { attributes: ['username'], include: [{ model: UserProfile, as: 'profile', attributes: ['fullName'] }] });
    return { ...plain, authorName: user?.profile?.fullName || user?.username || String(plain.authorId) };
  } catch {
    return { ...plain, authorName: String(plain.authorId) };
  }
};

const normalizeBlogRecord = (post) => {
  const plain = post?.toJSON ? post.toJSON() : post;
  if (!plain) return plain;

  return {
    ...plain,
    content: sanitizeContent(plain.content),
    layout: typeof plain.layout === 'string' ? (() => { try { return JSON.parse(plain.layout); } catch { return null; } })() : plain.layout,
    contentJson: typeof plain.contentJson === 'string' ? (() => { try { return JSON.parse(plain.contentJson); } catch { return null; } })() : plain.contentJson,
    tags: toStringArray(plain.tags, { allowCommaSplit: true }),
  };
};

// Helper to find blog by ID or Slug
const findBlog = async (idOrSlug) => {
  return await Blog.findOne({
    where: {
      [Op.or]: [
        { id: idOrSlug.length === 36 ? idOrSlug : null }, // Basic UUID check
        { slug: idOrSlug }
      ]
    }
  });
};

const findPublishedBlog = async (idOrSlug) => Blog.findOne({
  where: {
    status: 'published',
    [Op.or]: [
      { id: idOrSlug.length === 36 ? idOrSlug : null },
      { slug: idOrSlug },
    ],
  },
});

const blogRevisions = revisionApi('blog', Blog);
const editorOnly = requireRoles('owner', 'editor');

// Public: Get all posts (With Pagination)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;

    const { count, rows } = await Blog.findAndCountAll({
      where: { status: 'published' },
      attributes: ['id', 'slug', 'title', 'excerpt', 'image', 'readTime', 'tags', 'publishedAt', 'updatedAt', 'authorId', 'coverAlt', 'coverCaption'],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      items: rows.map(normalizeBlogRecord),
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin revision endpoints must precede the public dynamic slug route.
router.get('/:idOrSlug/revisions', protect, editorOnly, async (req, res) => {
  try {
    const post = await findBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });
    return res.json(await blogRevisions.list(post.id));
  } catch (error) { return res.status(error.status || 500).json({ message: error.message }); }
});

// Public: Get single post by ID or Slug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const post = await findPublishedBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });
    const authorResolved = await resolveBlogAuthor(post);
    const relatedBlogs = await Blog.findAll({
      attributes: ['id', 'slug', 'title', 'excerpt', 'image', 'updatedAt'],
      where: { status: 'published', id: { [Op.ne]: post.id } },
      order: [['publishedAt', 'DESC'], ['updatedAt', 'DESC']],
      limit: 3,
    });
    res.json({ ...normalizeBlogRecord(authorResolved), relatedBlogs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Create post
router.post('/', protect, editorOnly, async (req, res) => {
  try {
    const payload = await normalizeCmsFields(Blog, normalizeBlogPayload(req.body));
    const post = await Blog.create(payload);
    await createPostRevision({ postType: 'blog', post, action: 'created', authorId: req.user?.id });
    notifyTelegramBlogChanged({
      blog: normalizeBlogRecord(post),
      action: 'created',
      source: 'admin',
      actor: req.user?.username || '',
    });
    res.status(201).json(normalizeBlogRecord(post));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Update post
router.put('/:idOrSlug', protect, editorOnly, async (req, res) => {
  try {
    const post = await findBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });

    const payload = await normalizeCmsFields(Blog, normalizeBlogPayload(req.body), post);
    await post.update(payload);
    await createPostRevision({ postType: 'blog', post, action: 'updated', authorId: req.user?.id });
    notifyTelegramBlogChanged({
      blog: normalizeBlogRecord(post),
      action: 'updated',
      source: 'admin',
      actor: req.user?.username || '',
    });
    res.json(normalizeBlogRecord(post));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Delete post
router.delete('/:idOrSlug', protect, editorOnly, async (req, res) => {
  try {
    const post = await findBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });
    
    await post.destroy();
    res.json({ message: 'Blog post removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:idOrSlug/restore/:revisionId', protect, editorOnly, async (req, res) => {
  try {
    const post = await findBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });
    const restored = await blogRevisions.restore(post.id, req.params.revisionId, req.user?.id);
    return res.json(normalizeBlogRecord(restored));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/:idOrSlug/autosave', protect, editorOnly, async (req, res) => {
  try {
    const existing = await findBlog(req.params.idOrSlug);
    if (!existing) return res.status(404).json({ message: 'Blog post not found' });
    const post = await autosavePost(Blog, existing.id, req.body);
    await createPostRevision({ postType: 'blog', post, action: 'autosaved', authorId: req.user?.id });
    return res.json(normalizeBlogRecord(post));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/:idOrSlug/status', protect, editorOnly, async (req, res) => {
  try {
    const post = await findBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });
    const payload = await normalizeCmsFields(Blog, { ...post.toJSON(), ...req.body }, post);
    await post.update(payload);
    await createPostRevision({ postType: 'blog', post, action: payload.status, authorId: req.user?.id });
    return res.json(normalizeBlogRecord(post));
  } catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
});

module.exports = router;
