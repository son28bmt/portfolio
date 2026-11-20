const { PostRevision } = require('../models');

const SNAPSHOT_FIELDS = [
  'id', 'slug', 'title', 'excerpt', 'content', 'image', 'tags', 'readTime', 'topicId', 'cmsVersion',
  'status', 'publishedAt', 'scheduledAt', 'authorId', 'seoTitle', 'seoDescription',
  'ogImage', 'canonicalUrl', 'coverAlt', 'coverCaption',
];

const createPostRevision = async ({ postType, post, action = 'updated', authorId = null }) => {
  const data = post?.toJSON ? post.toJSON() : post;
  if (!data?.id) return null;
  const snapshot = Object.fromEntries(
    SNAPSHOT_FIELDS.filter((key) => Object.hasOwn(data, key)).map((key) => [key, data[key]]),
  );
  return PostRevision.create({ postType, postId: data.id, action, snapshot, authorId });
};

const listPostRevisions = (postType, postId) => PostRevision.findAll({
  where: { postType, postId },
  order: [['createdAt', 'DESC']],
  attributes: ['id', 'action', 'snapshot', 'authorId', 'createdAt'],
});

module.exports = { SNAPSHOT_FIELDS, createPostRevision, listPostRevisions };