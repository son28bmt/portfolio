import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteUrl = 'https://nguyenquangson.id.vn';
const apiUrl = String(process.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api').replace(/\/+$/, '');
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(clientDir, 'dist');
const blogDir = path.join(distDir, 'blog');

const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const summary = (post) => stripHtml(post.seoDescription || post.excerpt || post.content || post.title || 'Bài viết của Nguyễn Quang Sơn.').slice(0, 160);

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function getPosts() {
  const first = await getJson(`${apiUrl}/blog?limit=100&page=1`);
  const pages = Math.max(1, Number(first.totalPages) || 1);
  const results = [first];
  for (let page = 2; page <= pages; page += 1) results.push(await getJson(`${apiUrl}/blog?limit=100&page=${page}`));
  return results.flatMap(result => Array.isArray(result.items) ? result.items : []);
}

function renderIndex(template, posts) {
  const links = posts.map((post) => {
    const slug = post.slug || post.id;
    return slug ? `<article><h2><a href="/blog/${encodeURIComponent(slug)}">${escapeHtml(post.title || 'Bài viết')}</a></h2><p>${escapeHtml(summary(post))}</p></article>` : '';
  }).join('');
  const head = `<title>Blog | Nguyễn Quang Sơn</title>\n    <meta name="description" content="Blog chia sẻ kiến thức, kinh nghiệm và công nghệ." />\n    <meta name="robots" content="index, follow" />\n    <link rel="canonical" href="${siteUrl}/blog" />`;
  return template.replace(/<meta\s+name="description"[\s\S]*?\/>/i, '').replace(/<title>[\s\S]*?<\/title>/i, head).replace('<div id="root"></div>', `<div id="root"><main><h1>Blog</h1>${links}</main></div>`);
}

function renderPost(template, post) {
  const slug = post.slug || post.id;
  const canonical = `${siteUrl}/blog/${encodeURIComponent(slug)}`;
  const title = `${post.seoTitle || post.title || 'Bài viết'} | Nguyễn Quang Sơn`;
  const description = summary(post);
  const content = post.content || post.excerpt || '';
  const head = `<title>${escapeHtml(title)}</title>\n    <meta name="description" content="${escapeHtml(description)}" />\n    <meta name="robots" content="index, follow" />\n    <link rel="canonical" href="${canonical}" />\n    <meta property="og:title" content="${escapeHtml(title)}" />\n    <meta property="og:description" content="${escapeHtml(description)}" />\n    <meta property="og:type" content="article" />\n    <meta property="og:url" content="${canonical}" />`;
  return template.replace(/<meta\s+name="description"[\s\S]*?\/>/i, '').replace(/<title>[\s\S]*?<\/title>/i, head).replace('<div id="root"></div>', `<div id="root"><main><article><p><a href="/blog">Blog</a></p><h1>${escapeHtml(post.title || 'Bài viết')}</h1><p>${escapeHtml(description)}</p><div>${content}</div></article></main></div>`);
}

async function main() {
  const template = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const posts = await getPosts();
  await rm(blogDir, { recursive: true, force: true });
  await mkdir(blogDir, { recursive: true });
  await writeFile(path.join(blogDir, 'index.html'), renderIndex(template, posts), 'utf8');
  for (const item of posts) {
    const slug = item?.slug || item?.id;
    if (!slug) continue;
    const post = await getJson(`${apiUrl}/blog/${encodeURIComponent(slug)}`);
    const outputDir = path.join(blogDir, slug);
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'index.html'), renderPost(template, post), 'utf8');
  }
  console.log(`[prerender] Generated ${posts.length} blog pages from ${apiUrl}`);
}

main().catch((error) => {
  console.error(`[prerender] Blogs failed: ${error.message}`);
  process.exitCode = 1;
});