export const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const parseSearchTags = (value) => {
  if (Array.isArray(value)) return value.map(tag => String(tag || '').trim()).filter(Boolean);
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.startsWith('[') || text.startsWith('"')) {
    try { return parseSearchTags(JSON.parse(text)); } catch { /* Use the legacy comma-separated format. */ }
  }
  return text.split(',').map(tag => tag.trim()).filter(Boolean);
};

const differsByOneEdit = (left, right) => {
  if (Math.abs(left.length - right.length) > 1 || left === right) return false;
  let i = 0;
  let j = 0;
  let differences = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i += 1; j += 1; continue; }
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
    } else if (left.length > right.length) i += 1;
    else j += 1;
  }
  if (i < left.length || j < right.length) differences += 1;
  return differences === 1;
};

const tokenStrength = (queryToken, candidate) => {
  if (candidate === queryToken) return 1;
  if (candidate.startsWith(queryToken)) return 0.78;
  if (queryToken.startsWith(candidate) && queryToken.length - candidate.length <= 2) return 0.48;
  if (queryToken.length >= 4 && differsByOneEdit(queryToken, candidate)) return 0.42;
  return 0;
};

export const rankSearchDocuments = (documents, rawQuery, { type = 'blog', topic = '' } = {}) => {
  const query = normalizeSearchText(rawQuery);
  if (query.length < 2) return [];
  const queryTokens = query.split(' ').filter(Boolean);
  const minimumCoverage = Math.max(1, Math.ceil(queryTokens.length * 0.5));

  return documents
    .filter(item => !topic || (type === 'guide' && item.topic?.slug === topic))
    .map(item => {
      const tags = parseSearchTags(item.tags);
      const fields = [
        { key: 'title', weight: 220, value: normalizeSearchText(item.title) },
        { key: 'topic', weight: 76, value: normalizeSearchText(item.topic?.name) },
        { key: 'tags', weight: 70, value: normalizeSearchText(tags.join(' ')) },
        { key: 'slug', weight: 38, value: normalizeSearchText(item.slug) },
        { key: 'excerpt', weight: 34, value: normalizeSearchText(String(item.excerpt || '').replace(/<[^>]*>/g, ' ')) },
      ];
      const matchedTokens = new Set();
      const fieldScores = fields.map(field => {
        const candidates = field.value ? field.value.split(' ') : [];
        const strengths = queryTokens.map(token => {
          const strength = Math.max(0, ...candidates.map(candidate => tokenStrength(token, candidate)));
          if (strength) matchedTokens.add(token);
          return strength;
        });
        const matches = strengths.filter(Boolean).length;
        if (!matches) return { key: field.key, score: 0 };
        const phraseMatch = field.value.includes(query);
        const coverage = matches / queryTokens.length;
        return {
          key: field.key,
          score: field.weight * strengths.reduce((total, strength) => total + strength, 0) * (0.48 + coverage * 0.52)
            + (phraseMatch ? field.weight * (field.value.startsWith(query) ? 1.9 : 1.35) : 0),
        };
      });
      return {
        ...item,
        tags,
        score: fieldScores.reduce((total, field) => total + field.score, 0),
        matchedTokens: matchedTokens.size,
        matchedBy: fieldScores.find(field => field.score > 0)?.key || 'excerpt',
      };
    })
    .filter(item => item.score > 0 && item.matchedTokens >= minimumCoverage)
    .sort((left, right) => right.score - left.score
      || new Date(right.publishedAt || right.updatedAt || 0) - new Date(left.publishedAt || left.updatedAt || 0));
};

export const createLegacySearchFallback = (apiClient, cacheTtlMs = 60 * 1000) => {
  const corpusCache = new Map();
  const corpusRequests = new Map();

  const getCorpus = async (type) => {
    const cached = corpusCache.get(type);
    if (cached?.expiresAt > Date.now()) return cached.items;
    if (corpusRequests.has(type)) return corpusRequests.get(type);

    const request = (async () => {
      const endpoint = type === 'blog' ? '/blog' : '/guides';
      const pageSize = 50;
      const first = await apiClient.get(endpoint, { params: { page: 1, limit: pageSize } });
      const pages = [first.data];
      const totalPages = Math.max(1, Number(first.data?.totalPages || 1));

      for (let start = 2; start <= totalPages; start += 6) {
        const pageNumbers = Array.from({ length: Math.min(6, totalPages - start + 1) }, (_, index) => start + index);
        const responses = await Promise.all(pageNumbers.map(page => apiClient.get(endpoint, { params: { page, limit: pageSize } })));
        pages.push(...responses.map(response => response.data));
      }

      const items = pages.flatMap(data => Array.isArray(data?.items) ? data.items : [])
        .map(item => ({
          ...item,
          image: String(item.image || '').startsWith('data:') ? '' : item.image,
        }));
      corpusCache.set(type, { items, expiresAt: Date.now() + cacheTtlMs });
      return items;
    })();

    corpusRequests.set(type, request);
    try {
      return await request;
    } finally {
      if (corpusRequests.get(type) === request) corpusRequests.delete(type);
    }
  };

  return async ({ type, q, page = 1, limit = 6, topic = '', signal } = {}) => {
    const query = normalizeSearchText(q);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 6));
    if (query.length < 2) return { items: [], total: 0, page: safePage, totalPages: 0 };

    const corpus = await getCorpus(type);
    if (signal?.aborted) {
      const error = new Error('Search request cancelled.');
      error.name = 'CanceledError';
      throw error;
    }

    const ranked = rankSearchDocuments(corpus, query, { type, topic });
    const offset = (safePage - 1) * safeLimit;
    return {
      items: ranked.slice(offset, offset + safeLimit).map(item => Object.fromEntries(
        Object.entries(item).filter(([key]) => key !== 'score' && key !== 'matchedTokens'),
      )),
      total: ranked.length,
      page: safePage,
      totalPages: Math.ceil(ranked.length / safeLimit),
    };
  };
};

export const createSearchService = (apiClient, fallbackSearch = createLegacySearchFallback(apiClient)) => async (options = {}) => {
  try {
    const { data } = await apiClient.get('/search', {
      params: {
        type: options.type,
        q: options.q,
        page: options.page,
        limit: options.limit,
        ...(options.topic ? { topic: options.topic } : {}),
      },
      signal: options.signal,
    });
    return data;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error.response && error.response.status !== 404) throw error;
    return fallbackSearch(options);
  }
};