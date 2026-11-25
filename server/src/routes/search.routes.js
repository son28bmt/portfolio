const express = require('express');
const { Blog, Guide, GuideTopic } = require('../models');
const { SEARCH_TYPES, createContentSearch } = require('../services/content-search.service');

const cleanQuery = (value) => {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 100) {
    const error = new Error('q phải là chuỗi không quá 100 ký tự.');
    error.status = 400;
    throw error;
  }
  return value.trim();
};

const parsePositiveInteger = (value, fallback, max) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    const error = new Error('page và limit phải là số nguyên dương.');
    error.status = 400;
    throw error;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    const error = new Error('page và limit phải là số nguyên dương.');
    error.status = 400;
    throw error;
  }
  return Math.min(parsed, max);
};

const parseSearchQuery = (query = {}, defaultLimit = 6) => {
  if (typeof query.type !== 'string' || !SEARCH_TYPES.has(query.type)) {
    const error = new Error('type phải là blog hoặc guide.');
    error.status = 400;
    throw error;
  }

  if (query.topic !== undefined && typeof query.topic !== 'string') {
    const error = new Error('topic phải là chuỗi hợp lệ.');
    error.status = 400;
    throw error;
  }

  const topic = String(query.topic || '').trim();
  if (topic && (topic.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic))) {
    const error = new Error('topic phải là slug hợp lệ.');
    error.status = 400;
    throw error;
  }

  return {
    type: query.type,
    q: cleanQuery(query.q),
    topic,
    page: parsePositiveInteger(query.page, 1, 100000),
    limit: parsePositiveInteger(query.limit, defaultLimit, defaultLimit === 6 ? 10 : 50),
  };
};

const buildSearchRouter = ({ contentSearch } = {}) => {
  const router = express.Router();
  const searchService = contentSearch || createContentSearch({
    BlogModel: Blog,
    GuideModel: Guide,
    GuideTopicModel: GuideTopic,
  });

  const handleSearch = (limit) => async (req, res) => {
    let query;
    try {
      query = parseSearchQuery(req.query, limit);
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }

    try {
      return res.json(await searchService.search(query));
    } catch (error) {
      console.error('[Search API] Could not search published content:', error);
      return res.status(500).json({ message: 'Không thể tìm kiếm bài viết.' });
    }
  };

  router.get('/suggestions', handleSearch(6));
  router.get('/', handleSearch(9));
  return router;
};

module.exports = buildSearchRouter();
module.exports.buildSearchRouter = buildSearchRouter;
module.exports.parseSearchQuery = parseSearchQuery;