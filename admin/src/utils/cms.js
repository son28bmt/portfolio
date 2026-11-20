import DOMPurify from 'dompurify';

export const sanitizeHtml = (html = '') => DOMPurify.sanitize(String(html), {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'title'],
  FORBID_TAGS: ['script', 'style', 'object', 'embed'],
});

export const slugify = (value = '') => String(value)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180);

export const readingTime = (html = '') => {
  const words = String(html).replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min`;
};

export const tagsToString = value => Array.isArray(value) ? value.join(', ') : String(value || '');
export const tagsFromString = value => String(value || '').split(',').map(v => v.trim()).filter(Boolean).slice(0, 30);