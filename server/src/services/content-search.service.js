const { sequelize } = require('../config/db');
const { normalizeTags } = require('./cms-post.service');

const SEARCH_TYPES = new Set(['blog', 'guide']);
const CACHE_TTL_MS = 15 * 1000;
const FIELDS = [
  { key: 'title', weight: 220 },
  { key: 'seoTitle', weight: 84 },
  { key: 'topic', weight: 76 },
  { key: 'tags', weight: 70 },
  { key: 'slug', weight: 38 },
  { key: 'excerpt', weight: 34 },
  { key: 'seoDescription', weight: 30 },
  { key: 'content', weight: 16 },
];

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const toPlainText = (value) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

const toPlainRecord = (record) => record?.toJSON ? record.toJSON() : record;

const normalizeDocument = (record) => {
  const item = toPlainRecord(record) || {};
  const { content, ...metadata } = item;
  const tags = normalizeTags(item.tags);
  const image = String(item.image || '');
  return {
    ...metadata,
    image: image.startsWith('data:') ? '' : image,
    tags,
    topic: item.topic ? toPlainRecord(item.topic) : null,
    searchFields: {
      title: normalizeSearchText(item.title),
      seoTitle: normalizeSearchText(item.seoTitle),
      topic: normalizeSearchText(item.topic?.name),
      tags: normalizeSearchText(tags.join(' ')),
      slug: normalizeSearchText(item.slug),
      excerpt: normalizeSearchText(toPlainText(item.excerpt)),
      seoDescription: normalizeSearchText(toPlainText(item.seoDescription)),
      content: normalizeSearchText(toPlainText(content).slice(0, 6000)),
    },
  };
};

const differsByOneEdit = (left, right) => {
  if (Math.abs(left.length - right.length) > 1 || left === right) return false;
  let i = 0;
  let j = 0;
  let differences = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }

    differences += 1;
    if (differences > 1) return false;

    if (left.length === right.length) {
      if (i + 1 < left.length && left[i] === right[j + 1] && left[i + 1] === right[j]) {
        i += 2;
        j += 2;
        differences = 1;
        continue;
      }
      i += 1;
      j += 1;
    } else if (left.length > right.length) {
      i += 1;
    } else {
      j += 1;
    }
  }

  if (i < left.length || j < right.length) differences += 1;
  return differences === 1;
};

const tokenMatchStrength = (queryToken, candidate) => {
  if (candidate === queryToken) return 1;
  if (candidate.startsWith(queryToken)) return 0.78;
  if (queryToken.startsWith(candidate) && queryToken.length - candidate.length <= 2) return 0.48;
  if (queryToken.length >= 4 && differsByOneEdit(queryToken, candidate)) return 0.42;
  return 0;
};

const scoreField = (field, value, query, queryTokens) => {
  const normalizedValue = normalizeSearchText(value);
  if (!normalizedValue) return { score: 0, matchedTokens: 0 };

  const candidateTokens = normalizedValue.split(' ');
  let matchedTokens = 0;
  let strengthTotal = 0;

  for (const token of queryTokens) {
    const strength = candidateTokens.reduce(
      (best, candidate) => Math.max(best, tokenMatchStrength(token, candidate)),
      0,
    );
    if (strength) {
      matchedTokens += 1;
      strengthTotal += strength;
    }
  }

  if (!matchedTokens) return { score: 0, matchedTokens: 0 };

  const coverage = matchedTokens / queryTokens.length;
  const phraseMatch = normalizedValue.includes(query);
  const phraseBonus = phraseMatch ? field.weight * (normalizedValue.startsWith(query) ? 1.9 : 1.35) : 0;
  const tokenScore = field.weight * strengthTotal * (0.48 + coverage * 0.52);

  return {
    score: tokenScore + phraseBonus,
    matchedTokens,
    phraseMatch,
  };
};

const getDocumentFields = (type, item) => ({
  title: item.title,
  seoTitle: item.seoTitle,
  topic: type === 'guide' ? item.topic?.name : '',
  tags: item.tags,
  slug: item.slug,
  excerpt: item.excerpt,
  seoDescription: item.seoDescription,
});

const getPublishedTimestamp = (item) => {
  const value = new Date(item.publishedAt || item.updatedAt || item.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
};

const rankContent = (type, items, rawQuery, { topic = '' } = {}) => {
  if (!SEARCH_TYPES.has(type)) throw new Error('Loại nội dung tìm kiếm không hợp lệ.');

  const query = normalizeSearchText(rawQuery);
  if (query.length < 2) return [];
  const queryTokens = query.split(' ').filter(Boolean);
  const minimumCoverage = Math.max(1, Math.ceil(queryTokens.length * 0.5));

  return items
    .filter(item => !topic || (type === 'guide' && item.topic?.slug === topic))
    .map((item, index) => {
      const fields = getDocumentFields(type, item);
      const fieldScores = FIELDS.map(field => ({
        key: field.key,
        ...scoreField(field, item.searchFields?.[field.key] || fields[field.key], query, queryTokens),
      }));
      const matchedTokens = queryTokens.filter(token => FIELDS.some(field => (
        (item.searchFields?.[field.key] || normalizeSearchText(fields[field.key]))
          .split(' ')
          .some(candidate => tokenMatchStrength(token, candidate) > 0)
      ))).length;
      const score = fieldScores.reduce((total, result) => total + result.score, 0);
      const bestField = fieldScores.find(result => result.score > 0)?.key || '';

      return {
        item,
        index,
        score,
        matchedTokens,
        matchedBy: bestField,
      };
    })
    .filter(result => result.score > 0 && result.matchedTokens >= minimumCoverage)
    .sort((left, right) => right.score - left.score || getPublishedTimestamp(right.item) - getPublishedTimestamp(left.item) || left.index - right.index);
};

const buildSearchAttributes = (type) => {
  const common = ['id', 'slug', 'title', 'excerpt', 'readTime', 'publishedAt', 'updatedAt', 'tags', 'seoTitle', 'seoDescription'];
  return type === 'blog' ? [...common, 'createdAt'] : common;
};

const createContentSearch = ({
  BlogModel,
  GuideModel,
  GuideTopicModel,
  cacheTtlMs = CACHE_TTL_MS,
} = {}) => {
  const cache = new Map();

  const loadDocuments = async (type) => {
    const Model = type === 'blog' ? BlogModel : GuideModel;
    if (!Model) throw new Error(`Search model is not configured for ${type}.`);

    const options = {
      where: { status: 'published' },
      attributes: [
        ...buildSearchAttributes(type),
        [sequelize.fn('SUBSTRING', sequelize.col(`${type === 'blog' ? 'Blog' : 'Guide'}.content`), 1, 6000), 'content'],
      ],
      order: [['publishedAt', 'DESC'], ['updatedAt', 'DESC']],
    };

    if (type === 'guide' && GuideTopicModel) {
      options.include = [{
        model: GuideTopicModel,
        as: 'topic',
        attributes: ['id', 'name', 'slug'],
        required: false,
        where: { isVisible: true },
      }];
    }

    const records = await Model.findAll(options);
    return records.map(record => normalizeDocument(record));
  };

  const getDocuments = async (type) => {
    if (!SEARCH_TYPES.has(type)) throw new Error('Loại nội dung tìm kiếm không hợp lệ.');
    const existing = cache.get(type);
    if (existing?.promise || (existing?.items && existing.expiresAt > Date.now())) {
      return existing.promise || existing.items;
    }

    const entry = { items: null, expiresAt: 0, promise: null };
    entry.promise = loadDocuments(type)
      .then(items => {
        entry.items = items;
        entry.expiresAt = Date.now() + cacheTtlMs;
        entry.promise = null;
        return items;
      })
      .catch(error => {
        if (cache.get(type) === entry) cache.delete(type);
        throw error;
      });
    cache.set(type, entry);
    return entry.promise;
  };

  const search = async ({ type, q, page = 1, limit = 6, topic = '' } = {}) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 6));
    const normalizedQuery = normalizeSearchText(q);
    if (normalizedQuery.length < 2) {
      return { items: [], total: 0, page: safePage, totalPages: 0 };
    }

    const documents = await getDocuments(type);
    const ranked = rankContent(type, documents, q, { topic });
    const offset = (safePage - 1) * safeLimit;

    return {
      items: ranked.slice(offset, offset + safeLimit).map(result => {
        const { searchFields, ...publicItem } = result.item;
        return { ...publicItem, matchedBy: result.matchedBy };
      }),
      total: ranked.length,
      page: safePage,
      totalPages: Math.ceil(ranked.length / safeLimit),
    };
  };

  return { search, getDocuments };
};

module.exports = {
  CACHE_TTL_MS,
  SEARCH_TYPES,
  createContentSearch,
  normalizeSearchText,
  rankContent,
  toPlainText,
};