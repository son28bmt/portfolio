import DOMPurify from 'dompurify';

export const sanitizeHtml = (html = '') => DOMPurify.sanitize(String(html), {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'title'],
  ADD_DATA_URI_TAGS: [],
  FORBID_TAGS: ['script', 'style', 'object', 'embed'],
});

export const slugify = (value = '') => String(value)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180);

export const readingTime = (html = '') => {
  const words = String(html).replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min`;
};

export const normalizeTags = value => {
  let current = value;
  for (let i = 0; i < 6 && typeof current === 'string'; i += 1) {
    const text = current.trim();
    if (!text) return [];
    if (!['[', '"'].includes(text[0])) return text.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 30);
    try { current = JSON.parse(text); } catch { return text.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 30); }
  }
  if (Array.isArray(current)) return current.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 30);
  return typeof current === 'string' ? [current.trim()].filter(Boolean).slice(0, 30) : [];
};
export const tagsToString = value => normalizeTags(value).join(', ');
export const tagsFromString = value => normalizeTags(value);