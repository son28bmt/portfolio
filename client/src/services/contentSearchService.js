import api from './api.js';
import { createSearchService } from './contentSearchUtils.js';

export const searchContent = createSearchService(api);