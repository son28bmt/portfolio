const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { protect } = require('../middleware/auth.middleware');
const { Op } = require('sequelize');

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
    return decoded
      .map((item) => String(item || '').trim())
      .filter(Boolean);
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
  const tags = toStringArray(body.tags, { allowCommaSplit: true });
  return {
    ...body,
    tags,
  };
};

const normalizeBlogRecord = (post) => {
  const plain = post?.toJSON ? post.toJSON() : post;
  if (!plain) return plain;

  return {
    ...plain,
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

// Public: Get all posts
router.get('/', async (req, res) => {
  try {
    const posts = await Blog.findAll({ order: [['createdAt', 'DESC']] });
    res.json(posts.map(normalizeBlogRecord));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public: Get single post by ID or Slug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const post = await findBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });
    res.json(normalizeBlogRecord(post));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Create post
router.post('/', protect, async (req, res) => {
  try {
    const payload = normalizeBlogPayload(req.body);
    const post = await Blog.create(payload);
    res.status(201).json(normalizeBlogRecord(post));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Update post
router.put('/:idOrSlug', protect, async (req, res) => {
  try {
    const post = await findBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });

    const payload = normalizeBlogPayload(req.body);
    await post.update(payload);
    res.json(normalizeBlogRecord(post));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Delete post
router.delete('/:idOrSlug', protect, async (req, res) => {
  try {
    const post = await findBlog(req.params.idOrSlug);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });
    
    await post.destroy();
    res.json({ message: 'Blog post removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
