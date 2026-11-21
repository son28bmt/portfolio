const { Blog, Guide } = require('../models');
const { buildSlug, readingTime } = require('./cms-post.service');

const TARGETS = { blog: Blog, guide: Guide };

const plain = value => value?.toJSON ? value.toJSON() : value;

async function publishLayoutPost({ layoutPost, payload, userId, transaction }) {
  const target = payload.publishTarget || layoutPost.publishTarget || 'blog';
  const Model = TARGETS[target];
  if (!Model) { const error = new Error('Nơi đăng phải là Blog hoặc Hướng dẫn.'); error.status = 400; throw error; }
  if (layoutPost.publishedPostId && layoutPost.publishTarget && layoutPost.publishTarget !== target) {
    const error = new Error('Không thể đổi nơi đăng sau khi bài đã được đăng.'); error.status = 400; throw error;
  }

  const layout = payload.layout;
  const contentJson = payload.content;
  const text = Object.values(contentJson || {}).map(item => item?.html || '').join(' ');
  const fields = {
    title: payload.title,
    excerpt: text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
    content: text,
    layout,
    contentJson,
    layoutPostId: layoutPost.id,
    status: 'published',
    publishedAt: layoutPost.publishedAt || new Date(),
    authorId: userId ? String(userId) : null,
    readTime: readingTime(text),
  };
  fields.slug = await buildSlug(Model, payload.slug || payload.title, payload.slug, layoutPost.publishedPostId);

  let post = layoutPost.publishedPostId
    ? await Model.findByPk(layoutPost.publishedPostId, { transaction, lock: transaction.LOCK.UPDATE })
    : null;
  if (!post) post = await Model.create(fields, { transaction });
  else await post.update(fields, { transaction });

  await layoutPost.update({ publishTarget: target, publishedPostId: post.id, publishedPostSlug: post.slug }, { transaction });
  return post;
}

module.exports = { publishLayoutPost, TARGETS, plain };