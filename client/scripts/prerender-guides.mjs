import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteUrl = 'https://nguyenquangson.id.vn';
const apiUrl = String(process.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api').replace(/\/+$/, '');
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(clientDir, 'dist');
const guideDir = path.join(distDir, 'huong-dan');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeDescription = (guide) => (guide.seoDescription || guide.excerpt || stripHtml(guide.content) || guide.title || 'Hướng dẫn thực hành.').slice(0, 160);
const absoluteImage = (value) => /^https?:\/\//i.test(value || '') ? value : `${siteUrl}${String(value || '')}`;

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function getPublishedGuides() {
  const first = await getJson(`${apiUrl}/guides?limit=50&page=1`);
  const pages = Math.max(1, Number(first.totalPages) || 1);
  const results = [first];
  for (let page = 2; page <= pages; page += 1) {
    results.push(await getJson(`${apiUrl}/guides?limit=50&page=${page}`));
  }
  return results.flatMap(result => Array.isArray(result.items) ? result.items : []);
}

function renderGuideHtml(template, guide) {
  const canonical = `${siteUrl}/huong-dan/${encodeURIComponent(guide.slug)}`;
  const title = `${guide.seoTitle || guide.title} | Nguyễn Quang Sơn`;
  const description = normalizeDescription(guide);
  const image = absoluteImage(guide.ogImage || guide.image);
  const related = Array.isArray(guide.relatedGuides) ? guide.relatedGuides : [];
  const relatedHtml = related.length ? `<section><h2>Bài hướng dẫn liên quan</h2><ul>${related.map(item => `<li><a href="/huong-dan/${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a></li>`).join('')}</ul></section>` : '';
  const article = `<main><article><p><a href="/huong-dan">Hướng dẫn</a></p><h1>${escapeHtml(guide.title)}</h1>${guide.excerpt ? `<p>${escapeHtml(guide.excerpt)}</p>` : ''}<div class="guide-article-content">${guide.content || ''}</div>${relatedHtml}</article></main>`;
  const head = `<title>${escapeHtml(title)}</title>\n    <meta name="description" content="${escapeHtml(description)}" />\n    <meta name="robots" content="index, follow" />\n    <link rel="canonical" href="${canonical}" />\n    <meta property="og:title" content="${escapeHtml(title)}" />\n    <meta property="og:description" content="${escapeHtml(description)}" />\n    <meta property="og:type" content="article" />\n    <meta property="og:url" content="${canonical}" />${image ? `\n    <meta property="og:image" content="${escapeHtml(image)}" />` : ''}`;
  return template
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, '')
    .replace(/<title>[\s\S]*?<\/title>/i, head)
    .replace('<div id="root"></div>', `<div id="root">${article}</div>`);
}

function renderGuideIndexHtml(template, guides) {
  const head = `<title>Hướng dẫn | Nguyễn Quang Sơn</title>\n    <meta name="description" content="Các bài hướng dẫn và kiến thức thực hành." />\n    <meta name="robots" content="index, follow" />\n    <link rel="canonical" href="${siteUrl}/huong-dan" />`;
  const links = guides.map(guide => `<article><h2><a href="/huong-dan/${encodeURIComponent(guide.slug)}">${escapeHtml(guide.title)}</a></h2>${guide.excerpt ? `<p>${escapeHtml(guide.excerpt)}</p>` : ''}</article>`).join('');
  return template
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, '')
    .replace(/<title>[\s\S]*?<\/title>/i, head)
    .replace('<div id="root"></div>', `<div id="root"><main><h1>Hướng dẫn thực hành</h1>${links}</main></div>`);
}

async function main() {
  const template = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const guides = await getPublishedGuides();
  await rm(guideDir, { recursive: true, force: true });
  await mkdir(guideDir, { recursive: true });
  await writeFile(path.join(guideDir, 'index.html'), renderGuideIndexHtml(template, guides), 'utf8');

  for (const item of guides) {
    if (!item?.slug) continue;
    const guide = await getJson(`${apiUrl}/guides/${encodeURIComponent(item.slug)}`);
    const outputDir = path.join(guideDir, guide.slug);
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'index.html'), renderGuideHtml(template, guide), 'utf8');
  }

  console.log(`[prerender] Generated ${guides.length} guide pages from ${apiUrl}`);
}

main().catch(error => {
  console.error(`[prerender] Failed: ${error.message}`);
  process.exitCode = 1;
});