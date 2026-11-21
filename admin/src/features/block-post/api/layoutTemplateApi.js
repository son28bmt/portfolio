import api from '../../../services/api';
import { validateTemplateForSave } from '../validation/layoutSchema';

const BASE_PATH = '/layout-templates';

export const layoutTemplateApi = {
  async list({ page = 1, limit = 12, q = '' } = {}) {
    const { data } = await api.get(BASE_PATH, { params: { page, limit, q } });
    return data;
  },
  async get(id) {
    const { data } = await api.get(`${BASE_PATH}/${encodeURIComponent(id)}`);
    return data;
  },
  async create(template) {
    const payload = validateTemplateForSave(template);
    const { data } = await api.post(BASE_PATH, payload);
    return data;
  },
  async update(id, template) {
    const payload = validateTemplateForSave(template);
    const { data } = await api.put(`${BASE_PATH}/${encodeURIComponent(id)}`, payload);
    return data;
  },
  async remove(id) {
    const { data } = await api.delete(`${BASE_PATH}/${encodeURIComponent(id)}`);
    return data;
  },
  async duplicate(id) {
    const { data } = await api.post(`${BASE_PATH}/${encodeURIComponent(id)}/duplicate`);
    return data;
  },
};