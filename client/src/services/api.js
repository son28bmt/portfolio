import axios from 'axios';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'
).replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

const normalizeRequestUrl = (url = '') => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;

  const [path, query] = url.split('?');
  let normalizedPath = path.trim();

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  normalizedPath = normalizedPath.replace(/\/{2,}/g, '/');

  if (normalizedPath !== '/' && !normalizedPath.endsWith('/')) {
    normalizedPath += '/';
  }

  return query ? `${normalizedPath}?${query}` : normalizedPath;
};

api.interceptors.request.use((config) => {
  config.url = normalizeRequestUrl(config.url);
  return config;
});

export default api;
