const sanitizeHtml = require('sanitize-html');
const slugify = require('../utils/slugify');
const { Op } = require('sequelize');
const { createPostRevision, listPostRevisions } = require('./post-revision.service');

const STATUS_VALUES = ['draft', 'scheduled', 'published', 'archived'];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const youtubeEmbedHosts = new Set(['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const isAllowedYoutubeEmbed = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && youtubeEmbedHosts.has(url.hostname) && url.pathname.startsWith('/embed/'); }
  catch { return false; }
};

const sanitizeContent = (value) => sanitizeHtml(String(value || ''), {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'strong', 'em', 'u', 's',
    'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'table',
    'thead', 'tbody', 'tr', 'th', 'td', 'span', 'iframe', 'figure', 'figcaption',
  ],
  allowedAttributes: {
    '*': ['class', 'style', 'data-align'],
    a: ['href', 'target', 'rel', 'download'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'title', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy'],
  },
  allowedClasses: { '*': [/^ql-/, /^cms-image$/] },
  allowedStyles: {
    '*': { 'text-align': [/^(left|center|right|justify)$/] },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { a: ['http', 'https', 'mailto'], img: ['https'], iframe: ['https'] },
  allowedIframeHostnames: ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'],
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, ...(attribs.target === '_blank' ? { rel: 'noopener noreferrer' } : {}), ...(attribs.download ? { download: String(attribs.download).slice(0, 255) } : {}) } }),
    iframe: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, allowfullscreen: 'allowfullscreen', frameborder: '0', referrerpolicy: 'strict-origin-when-cross-origin' },
    }),
  },
  exclusiveFilter: frame => frame.tag === 'iframe' && !isAllowedYoutubeEmbed(frame.attribs.src),
});

const readingTime = (html) => {
  const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;
  return `${Math.max(1, Math.ceil(words / 200))} min`;
};

const normalizeTags = value => {
  let current = value;
  for (let i = 0; i < 6 && typeof current === 'string'; i += 1) {
    const text = current.trim();
    if (!text) return [];
    if (!['[', '"'].includes(text[0])) return text.split(',').map(tag => tag.trim()).filter(Boolean);
    try { current = JSON.parse(text); } catch { return text.split(',').map(tag => tag.trim()).filter(Boolean); }
  }
  const flatten = input => Array.isArray(input) ? input.flatMap(flatten) : [input];
  return flatten(current).flatMap(item => typeof item === 'string' ? normalizeTags(item) : [String(item || '').trim()]).filter(Boolean).slice(0, 30);
};

const assertStatus = (value, fallback = 'draft') => {
  const status = String(value || fallback).trim().toLowerCase();
  if (!STATUS_VALUES.includes(status)) {
    const error = new Error(`status phải là một trong: ${STATUS_VALUES.join(', ')}.`);
    error.status = 400;
    throw error;
  }
  return status;
};

const buildSlug = async (Model, title, requested, currentId) => {
  const requestedSlug = requested ? String(requested).trim() : '';
  if (requestedSlug && !slugPattern.test(requestedSlug)) {
    const error = new Error('Slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang đơn.'); error.status = 400; throw error;
  }
  const base = slugify(requestedSlug || title).slice(0, 180) || 'bai-viet';
  let slug = base;
  let suffix = 2;
  while (await Model.findOne({ where: { slug, ...(currentId ? { id: { [Op.ne]: currentId } } : {}) } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
};

const normalizeCmsFields = async (Model, body, current = null) => {
  const content = body.content !== undefined ? sanitizeContent(body.content) : current?.content;
  if (!content || !content.replace(/<[^>]*>/g, '').trim()) {
    const error = new Error('Nội dung là bắt buộc.'); error.status = 400; throw error;
  }
  const title = body.title !== undefined ? String(body.title).trim() : current?.title;
  if (!title || title.length > 255) { const error = new Error('Tiêu đề là bắt buộc và không quá 255 ký tự.'); error.status = 400; throw error; }
  const status = assertStatus(body.status, current?.status || 'draft');
  const excerpt = body.excerpt === undefined ? current?.excerpt || null : sanitizeHtml(String(body.excerpt), { allowedTags: [], allowedAttributes: {} }).slice(0, 500);
  const coverImage = body.image === undefined ? current?.image || null : body.image;
  if (coverImage) validateCmsImageUrl(coverImage, 'Ảnh bìa');
  const scheduledAt = status === 'scheduled' ? (body.scheduledAt || current?.scheduledAt || null) : null;
  if (status === 'scheduled' && (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime()))) {
    const error = new Error('Cần thời điểm hẹn đăng hợp lệ.'); error.status = 400; throw error;
  }
  const fields = {
    title,
    cmsVersion: Number(current?.cmsVersion || 0) + 1,
    content,
    status,
    slug: await buildSlug(Model, title, body.slug || current?.slug, current?.id),
    readTime: readingTime(content),
    excerpt,
    tags: body.tags === undefined ? normalizeTags(current?.tags || []) : normalizeTags(body.tags).map(tag => tag.slice(0, 60)),
    image: coverImage,
    publishedAt: status === 'published' ? (current?.publishedAt || new Date()) : (body.publishedAt ?? current?.publishedAt ?? null),
    scheduledAt,
    authorId: body.authorId === undefined ? current?.authorId || null : body.authorId || null,
    seoTitle: body.seoTitle === undefined ? current?.seoTitle || null : String(body.seoTitle).slice(0, 255),
    seoDescription: body.seoDescription === undefined ? current?.seoDescription || null : String(body.seoDescription).slice(0, 500),
    ogImage: body.ogImage === undefined ? current?.ogImage || null : body.ogImage,
    canonicalUrl: body.canonicalUrl === undefined ? current?.canonicalUrl || null : body.canonicalUrl,
    coverAlt: body.coverAlt === undefined ? current?.coverAlt || null : String(body.coverAlt).slice(0, 255),
    coverCaption: body.coverCaption === undefined ? current?.coverCaption || null : String(body.coverCaption).slice(0, 500),
  };
  if (fields.ogImage) validateCmsImageUrl(fields.ogImage, 'Ảnh OG');
  if (fields.canonicalUrl) validateUrl(fields.canonicalUrl, 'Canonical URL', ['http:', 'https:']);
  if (status === 'published' && current?.status !== 'published') fields.publishedAt = body.publishedAt || new Date();
  return fields;
};

function validateUrl(value, label, protocols = ['https:']) {
  let url;
  try { url = new URL(String(value)); }
  catch { const error = new Error(`${label} không hợp lệ.`); error.status = 400; throw error; }
  if (!protocols.includes(url.protocol)) { const error = new Error(`${label} phải dùng HTTPS.`); error.status = 400; throw error; }
}

function validateCmsImageUrl(value, label) {
  validateUrl(value, label);
  const base = String(process.env.R2_PUBLIC_BASE_URL || '').trim();
  if (!base) return;
  let imageUrl; let baseUrl;
  try { imageUrl = new URL(String(value)); baseUrl = new URL(base); }
  catch { const error = new Error(`${label} không hợp lệ.`); error.status = 400; throw error; }
  if (imageUrl.origin !== baseUrl.origin || !imageUrl.pathname.startsWith(`${baseUrl.pathname.replace(/\/$/, '')}/cms/`)) {
    const error = new Error(`${label} phải là ảnh CMS trên R2.`); error.status = 400; throw error;
  }
}

const validateDraft = body => {
  const content = sanitizeContent(body.content);
  if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) {
    const error = new Error('Nội dung không quá 1 MB.'); error.status = 400; throw error;
  }
  const title = String(body.title || '').trim();
  if (!title || title.length > 255) { const error = new Error('Tiêu đề là bắt buộc và không quá 255 ký tự.'); error.status = 400; throw error; }
  return { content, title, excerpt: sanitizeHtml(String(body.excerpt || ''), { allowedTags: [], allowedAttributes: {} }).slice(0, 500) };
};

const parseExpectedVersion = value => {
  if (!Number.isSafeInteger(Number(value)) || Number(value) < 0) { const error = new Error('Phiên bản bài viết không hợp lệ.'); error.status = 400; throw error; }
  return Number(value);
};

const autosavePost = async (Model, id, body) => {
  const draft = validateDraft(body || {});
  const expectedVersion = parseExpectedVersion(body?.expectedVersion);
  const { literal } = require('sequelize');
  const [changed] = await Model.update({ content: draft.content, title: draft.title, excerpt: draft.excerpt, readTime: readingTime(draft.content), cmsVersion: literal('cms_version + 1') }, { where: { id, cmsVersion: expectedVersion } });
  if (!changed) { const error = new Error('Bài viết đã thay đổi, tự lưu bị bỏ qua.'); error.status = 409; throw error; }
  return Model.findByPk(id);
};

const revisionApi = (postType, Model) => ({
  list: (id) => listPostRevisions(postType, id),
  restore: async (id, revisionId, authorId) => {
    const { PostRevision } = require('../models');
    const revision = await PostRevision.findOne({ where: { id: revisionId, postType, postId: id } });
    if (!revision) { const error = new Error('Không tìm thấy phiên bản.'); error.status = 404; throw error; }
    const post = await Model.findByPk(id);
    if (!post) { const error = new Error('Không tìm thấy bài viết.'); error.status = 404; throw error; }
    await post.update({ ...revision.snapshot, cmsVersion: Number(post.cmsVersion || 0) + 1 });
    await createPostRevision({ postType, post, action: 'restored', authorId });
    return post;
  },
});

module.exports = { STATUS_VALUES, sanitizeContent, readingTime, normalizeTags, assertStatus, buildSlug, normalizeCmsFields, validateDraft, autosavePost, validateUrl, validateCmsImageUrl, createPostRevision, revisionApi };