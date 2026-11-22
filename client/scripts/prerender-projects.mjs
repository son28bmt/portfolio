import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteUrl = 'https://nguyenquangson.id.vn';
const apiUrl = String(process.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api').replace(/\/+$/, '');
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(clientDir, 'dist');
const projectDir = path.join(distDir, 'du-an');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const description = (project) => stripHtml(project.description || project.title || 'Dự án của Nguyễn Quang Sơn.').slice(0, 160);
const absoluteImage = (value) => /^https?:\/\//i.test(value || '') ? value : value ? `${siteUrl}${String(value).startsWith('/') ? '' : '/'}${value}` : '';

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function getProjects() {
  const first = await getJson(`${apiUrl}/projects?limit=100&page=1`);
  const pages = Math.max(1, Number(first.totalPages) || 1);
  const results = [first];
  for (let page = 2; page <= pages; page += 1) results.push(await getJson(`${apiUrl}/projects?limit=100&page=${page}`));
  return results.flatMap(result => Array.isArray(result.items) ? result.items : []);
}

function renderProjectHtml(template, project) {
  const slug = project.slug || project.id;
  const canonical = `${siteUrl}/du-an/${encodeURIComponent(slug)}`;
  const title = `${project.title || 'Dự án'} | Dự án Nguyễn Quang Sơn`;
  const summary = description(project);
  const image = absoluteImage(project.image || project.images?.[0]);
  const tech = Array.isArray(project.tech) ? project.tech : [];
  const links = [project.demo ? `<a href="${escapeHtml(project.demo)}">Xem bản demo</a>` : '', project.github ? `<a href="${escapeHtml(project.github)}">Mã nguồn</a>` : ''].filter(Boolean).join(' · ');
  const article = `<main><article><p><a href="/du-an">Dự án</a></p><h1>${escapeHtml(project.title || 'Dự án')}</h1><p>${escapeHtml(summary)}</p>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(project.title || '')}" />` : ''}<p>Danh mục: ${escapeHtml(project.category || 'Dự án')}</p>${tech.length ? `<p>Công nghệ: ${escapeHtml(tech.join(', '))}</p>` : ''}${links ? `<p>${links}</p>` : ''}</article></main>`;
  const head = `<title>${escapeHtml(title)}</title>\n    <meta name="description" content="${escapeHtml(summary)}" />\n    <meta name="robots" content="index, follow" />\n    <link rel="canonical" href="${canonical}" />\n    <meta property="og:title" content="${escapeHtml(title)}" />\n    <meta property="og:description" content="${escapeHtml(summary)}" />\n    <meta property="og:type" content="article" />\n    <meta property="og:url" content="${canonical}" />${image ? `\n    <meta property="og:image" content="${escapeHtml(image)}" />` : ''}`;
  return template
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, '')
    .replace(/<title>[\s\S]*?<\/title>/i, head)
    .replace('<div id="root"></div>', `<div id="root">${article}</div>`);
}

async function main() {
  const template = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const projects = await getProjects();
  await rm(projectDir, { recursive: true, force: true });
  await mkdir(projectDir, { recursive: true });
  for (const item of projects) {
    const slug = item?.slug || item?.id;
    if (!slug) continue;
    const project = await getJson(`${apiUrl}/projects/${encodeURIComponent(slug)}`);
    const outputDir = path.join(projectDir, slug);
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'index.html'), renderProjectHtml(template, project), 'utf8');
  }
  console.log(`[prerender] Generated ${projects.length} project pages from ${apiUrl}`);
}

main().catch(error => {
  console.error(`[prerender] Projects failed: ${error.message}`);
  process.exitCode = 1;
});