import api from './api';

const root = '/admin/guides';
const topics = `${root}/topics`;
const data = response => response.data;

export const guideService = {
  list: (params, signal) => api.get(root, { params, signal }).then(data),
  get: id => api.get(`${root}/${id}`).then(data),
  save: (id, body) => (id ? api.put(`${root}/${id}`, body) : api.post(root, body)).then(data),
  setPublished: (id, publish) => api.post(`${root}/${id}/${publish ? 'publish' : 'unpublish'}`).then(data),
  remove: id => api.delete(`${root}/${id}`),
  topics: () => api.get(topics).then(data),
  saveTopic: (id, body) => id ? api.put(`${topics}/${id}`, body) : api.post(topics, body),
  removeTopic: id => api.delete(`${topics}/${id}`),
};

export const errorMessage = error => error.response?.data?.message || 'Yêu cầu thất bại. Vui lòng thử lại.';