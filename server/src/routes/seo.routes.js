const express = require('express');
const Blog = require('../models/Blog');
const Project = require('../models/Project');

const router = express.Router();

const DEFAULT_SITE_URL = 'https://nguyenquangson.id.vn';
const DEFAULT_SITEMAP_URL = 'https://nguyenquangson.id.vn/sitemap.xml';
const DEFAULT_CACHE_MS = 5 * 60 * 1000;

let sitemapCache = {
  generatedAt: 0,
  xml: '',
};

const removeTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const getSiteUrl = () => {
  return removeTrailingSlash(process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL);
};

const getSitemapUrl = () => {
  return process.env.SITEMAP_URL || DEFAULT_SITEMAP_URL;
};

const getSitemapCacheMs = () => {
  const parsed = Number(process.env.SITEMAP_CACHE_MS);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return DEFAULT_CACHE_MS;
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

const normalizePath = (path = '/') => {
  if (!path) return '/';
  if (path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

const buildAbsoluteUrl = (siteUrl, path) => {
  const normalizedPath = normalizePath(path);
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
];

const buildUrlNode = (entry) => {
  const lines = ['  <url>', `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority) lines.push(`    <priority>${entry.priority}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
};

const fetchDynamicEntries = async (siteUrl) => {
  const [blogs, projects] = await Promise.all([
    Blog.findAll({
      attributes: ['id', 'slug', 'updatedAt', 'createdAt'],
      order: [['updatedAt', 'DESC']],
    }),
    Project.findAll({
      attributes: ['id', 'updatedAt', 'createdAt'],
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
    loc: buildAbsoluteUrl(siteUrl, `/du-an/${project.id}`),
    lastmod: toIsoDate(project.updatedAt || project.createdAt),
    changefreq: 'weekly',
    priority: '0.8',
  }));

  return [...blogEntries, ...projectEntries];
};

const generateSitemapXml = async () => {
  const siteUrl = getSiteUrl();
  const entries = [...staticUrlEntries(siteUrl)];

  try {
    const dynamicEntries = await fetchDynamicEntries(siteUrl);
    entries.push(...dynamicEntries);
  } catch (error) {
    console.error('[sitemap] cannot load dynamic entries:', error?.message || error);
  }

  const body = entries.map(buildUrlNode).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
};

const getCachedOrFreshSitemap = async () => {
  const now = Date.now();
  const cacheMs = getSitemapCacheMs();
  if (sitemapCache.xml && now - sitemapCache.generatedAt < cacheMs) {
    return sitemapCache.xml;
  }
  const xml = await generateSitemapXml();
  sitemapCache = {
    generatedAt: now,
    xml,
  };
  return xml;
};

router.get(['/sitemap.xml', '/api/sitemap.xml'], async (req, res) => {
  try {
    const xml = await getCachedOrFreshSitemap();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('[sitemap] failed to build sitemap:', error?.message || error);
    return res.status(500).send('Failed to generate sitemap.xml');
  }
});

router.get(['/robots.txt', '/api/robots.txt'], (req, res) => {
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${getSitemapUrl()}\n`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(robots);
});

module.exports = router;
