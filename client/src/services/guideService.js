import api from './api';

const result = (response) => response.data;

export const guideService = {
  list: (params, signal) => api.get('/guides', { params, signal }).then(result),
  topics: (signal) => api.get('/guides/topics', { signal }).then(result),
  get: (slug, signal) => api.get(`/guides/${encodeURIComponent(slug)}`, { signal }).then(result),
};

export const getGuideError = (error) => error.response?.data?.message || 'Không thể tải hướng dẫn. Vui lòng thử lại.';