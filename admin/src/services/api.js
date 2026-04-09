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

  // Some proxy rules on production return 301 for non-trailing-slash API paths.
  if (normalizedPath !== '/' && !normalizedPath.endsWith('/')) {
    normalizedPath += '/';
  }

  return query ? `${normalizedPath}?${query}` : normalizedPath;
};

// Add token and normalize URLs to avoid redirect on preflight.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.url = normalizeRequestUrl(config.url);
  return config;
});

// Add error logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ Admin API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export default api;
