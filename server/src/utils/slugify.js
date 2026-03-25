const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Normalize to decomposable form
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[đĐ]/g, 'd') // Specifically handle Vietnamese 'đ'
    .replace(/[^a-z0-9 -]/g, '') // Remove non-alphanumeric except space and hyphen
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove duplicate hyphens
    .trim()
    .replace(/^-+/, '') // Remove leading hyphen
    .replace(/-+$/, ''); // Remove trailing hyphen
};

module.exports = slugify;
