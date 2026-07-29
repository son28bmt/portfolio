const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { sequelize } = require('../src/config/db');
const Blog = require('../src/models/Blog');
const Project = require('../src/models/Project');

const DEFAULT_SITE_URL = 'https://nguyenquangson.id.vn';

const removeTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const getSiteUrl = () => {
  return removeTrailingSlash(process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL);
};

const escapeXml = (unsafe = '') => {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizePath = (p = '/') => {
  if (!p) return '/';
  if (p === '/') return '/';
  return p.startsWith('/') ? p : `/${p}`;
};

const buildAbsoluteUrl = (siteUrl, p) => {
  const normalizedPath = normalizePath(p);
  if (normalizedPath === '/') return `${siteUrl}/`;
  return `${siteUrl}${normalizedPath}`;
};

const staticUrlEntries = (siteUrl) => [
  { loc: buildAbsoluteUrl(siteUrl, '/'), changefreq: 'daily', priority: '1.0' },
  { loc: buildAbsoluteUrl(siteUrl, '/gioi-thieu'), changefreq: 'monthly', priority: '0.8' },
  { loc: buildAbsoluteUrl(siteUrl, '/du-an'), changefreq: 'daily', priority: '0.9' },
  { loc: buildAbsoluteUrl(siteUrl, '/blog'), changefreq: 'daily', priority: '0.9' },
  { loc: buildAbsoluteUrl(siteUrl, '/lien-he'), changefreq: 'monthly', priority: '0.7' },
  { loc: buildAbsoluteUrl(siteUrl, '/cua-hang'), changefreq: 'weekly', priority: '0.8' },
  { loc: buildAbsoluteUrl(siteUrl, '/donate'), changefreq: 'weekly', priority: '0.8' },
  { loc: buildAbsoluteUrl(siteUrl, '/dieu-khoan'), changefreq: 'yearly', priority: '0.4' },
  { loc: buildAbsoluteUrl(siteUrl, '/bao-mat'), changefreq: 'yearly', priority: '0.4' },
  { loc: buildAbsoluteUrl(siteUrl, '/playground'), changefreq: 'weekly', priority: '0.8' },
  { loc: buildAbsoluteUrl(siteUrl, '/playground/chat'), changefreq: 'weekly', priority: '0.8' },
  { loc: buildAbsoluteUrl(siteUrl, '/playground/subtitle'), changefreq: 'weekly', priority: '0.7' },
  { loc: buildAbsoluteUrl(siteUrl, '/playground/tts'), changefreq: 'weekly', priority: '0.7' },
  { loc: buildAbsoluteUrl(siteUrl, '/playground/mail'), changefreq: 'weekly', priority: '0.7' },
];

const buildUrlNode = (entry) => {
  const lines = ['  <url>', `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority) lines.push(`    <priority>${entry.priority}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
};

const generateSitemapXmlContent = async () => {
  const siteUrl = getSiteUrl();
  const entries = [...staticUrlEntries(siteUrl)];

  try {
    const [blogs, projects] = await Promise.all([
      Blog.findAll({
        attributes: ['id', 'slug', 'updatedAt', 'createdAt'],
        order: [['updatedAt', 'DESC']],
      }),
      Project.findAll({
        attributes: ['id', 'slug', 'updatedAt', 'createdAt'],
        order: [['updatedAt', 'DESC']],
      }),
    ]);

    const blogEntries = blogs.map((post) => ({
      loc: buildAbsoluteUrl(siteUrl, `/blog/${post.slug || post.id}`),
      lastmod: toIsoDate(post.updatedAt || post.createdAt),
      changefreq: 'weekly',
      priority: '0.8',
    }));

    const projectEntries = projects.map((project) => ({
      loc: buildAbsoluteUrl(siteUrl, `/du-an/${project.slug || project.id}`),
      lastmod: toIsoDate(project.updatedAt || project.createdAt),
      changefreq: 'weekly',
      priority: '0.8',
    }));

    entries.push(...blogEntries, ...projectEntries);
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách URL động:', error?.message || error);
  }

  const body = entries.map(buildUrlNode).join('\n');
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    totalUrls: entries.length,
  };
};

const updateSitemapFiles = async () => {
  try {
    await sequelize.authenticate();
    const { xml, totalUrls } = await generateSitemapXmlContent();

    const clientPublicPath = path.resolve(__dirname, '../../client/public/sitemap.xml');
    const uploadsPath = path.resolve(__dirname, '../uploads/sitemap.xml');

    if (fs.existsSync(path.dirname(clientPublicPath))) {
      fs.writeFileSync(clientPublicPath, xml, 'utf8');
      console.log(`✅ Đã cập nhật sitemap tại client/public/sitemap.xml (${totalUrls} URLs)`);
    }

    if (fs.existsSync(path.dirname(uploadsPath))) {
      fs.writeFileSync(uploadsPath, xml, 'utf8');
      console.log(`✅ Đã cập nhật sitemap tại server/uploads/sitemap.xml (${totalUrls} URLs)`);
    }

    return { xml, totalUrls };
  } catch (error) {
    console.error('❌ Lỗi tạo Sitemap:', error?.message || error);
    throw error;
  }
};

let triggerDebounceTimer = null;

const triggerAutoSitemapUpdate = () => {
  if (triggerDebounceTimer) clearTimeout(triggerDebounceTimer);
  triggerDebounceTimer = setTimeout(() => {
    updateSitemapFiles().catch((err) => {
      console.error('❌ Auto-Sitemap update failed:', err?.message || err);
    });
  }, 1500);
};

if (require.main === module) {
  updateSitemapFiles()
    .then(({ totalUrls }) => {
      console.log(`🎉 Tự động cập nhật sitemap.xml hoàn tất với tổng cộng ${totalUrls} đường dẫn URL.`);
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = {
  updateSitemapFiles,
  generateSitemapXmlContent,
  triggerAutoSitemapUpdate,
};
