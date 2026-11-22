import api from '../../../services/api';
import { validateLayoutPostForSave } from '../validation/layoutSchema';

const BASE_PATH = '/layout-posts';
const normalizePost = (post) => {
  const normalized = validateLayoutPostForSave(post);
  return {
    ...normalized,
    publishTarget: post.publishTarget || 'blog',
  };
};

export const layoutPostApi = {
  async list(params = {}) { const { data } = await api.get(BASE_PATH, { params }); return data; },
  async get(id) { const { data } = await api.get(`${BASE_PATH}/${encodeURIComponent(id)}`); return data; },
  async create(post) { const normalized = normalizePost(post); const { data } = await api.post(BASE_PATH, normalized); return data; },
  async update(id, post) { const normalized = normalizePost(post); const { data } = await api.put(`${BASE_PATH}/${encodeURIComponent(id)}`, normalized); return data; },
  async remove(id) { const { data } = await api.delete(`${BASE_PATH}/${encodeURIComponent(id)}`); return data; },
  async publish(id, updatedAt, payload = {}) { const normalized = normalizePost(payload); const { data } = await api.post(`${BASE_PATH}/${encodeURIComponent(id)}/publish`, { ...normalized, updatedAt }); return data; },
  async unpublish(id, updatedAt) { const { data } = await api.post(`${BASE_PATH}/${encodeURIComponent(id)}/unpublish`, { updatedAt }); return data; },
  async questionTemplates() { const { data } = await api.get(`${BASE_PATH}/question-templates`); return data; },
};