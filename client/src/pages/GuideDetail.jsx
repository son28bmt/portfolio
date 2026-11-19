import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { getGuideError, guideService } from '../services/guideService';

const siteUrl = 'https://nguyenquangson.id.vn';
const formatDate = value => value ? new Date(value).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

function useHeadings(content) {
  return useMemo(() => {
    if (!content || typeof window === 'undefined' || !window.DOMParser) return [];
    const parsed = new DOMParser().parseFromString(content, 'text/html');
    return Array.from(parsed.querySelectorAll('h2, h3')).map((node, index) => ({
      id: `guide-section-${index + 1}`,
      text: node.textContent?.trim() || `Mục ${index + 1}`,
      level: node.tagName.toLowerCase(),
    }));
  }, [content]);
}

function withHeadingIds(content, headings) {
  if (!content || !headings.length || typeof window === 'undefined' || !window.DOMParser) return content || '';
  const parsed = new DOMParser().parseFromString(content, 'text/html');
  parsed.querySelectorAll('h2, h3').forEach((node, index) => { if (headings[index]) node.id = headings[index].id; });
  return parsed.body.innerHTML;
}

export default function GuideDetail() {
  const { slug } = useParams();
  return <GuideDetailPage key={slug} slug={slug} />;
}

function GuideDetailPage({ slug }) {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    guideService.get(slug, abort.signal).then(data => {
      if (!abort.signal.aborted) setGuide(data);
    }).catch(err => {
      if (!abort.signal.aborted) setError(err.response?.status === 404 ? 'not-found' : getGuideError(err));
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [slug, retry]);

  const headings = useHeadings(guide?.content);
  const content = useMemo(() => withHeadingIds(guide?.content, headings), [guide?.content, headings]);
  const canonical = `${siteUrl}/huong-dan/${encodeURIComponent(slug || '')}`;
  if (loading) return <div className="py-24 text-center text-white/50">Đang tải bài hướng dẫn…</div>;
  if (error === 'not-found') return <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center"><h1 className="mb-4 text-3xl font-bold">Không tìm thấy bài hướng dẫn</h1><p className="mb-8 text-white/50">Bài viết có thể không tồn tại hoặc đã được gỡ.</p><Link to="/huong-dan" className="rounded-xl bg-primary px-6 py-3 font-bold">Về trang hướng dẫn</Link></div>;
  if (error) return <div className="py-20 text-center"><p role="alert" className="mb-4 text-red-300">{error}</p><button onClick={() => setRetry(n => n + 1)} className="rounded-xl bg-white/10 px-4 py-2">Thử lại</button></div>;
  if (!guide) return null;

  const related = (guide.relatedGuides || []).slice(0, 3);
  const excerpt = guide.excerpt || guide.title;
  return <article className="mx-auto max-w-4xl px-1 py-6 sm:py-10">
    <Helmet><title>{guide.title} | Hướng dẫn Nguyễn Quang Sơn</title><meta name="description" content={excerpt} /><link rel="canonical" href={canonical} /><meta property="og:title" content={`${guide.title} | Hướng dẫn Nguyễn Quang Sơn`} /><meta property="og:description" content={excerpt} />{guide.image && <meta property="og:image" content={guide.image} />}<meta property="og:url" content={canonical} /><meta property="og:type" content="article" /></Helmet>
    <Link to="/huong-dan" className="mb-7 inline-flex items-center gap-2 text-white/50 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Tất cả hướng dẫn</Link>
    <header className="mb-9"><div className="mb-4">{guide.topic && <Link to={`/huong-dan?topic=${encodeURIComponent(guide.topic.slug)}`} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary">{guide.topic.name}</Link>}</div><h1 className="mb-5 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">{guide.title}</h1><div className="flex flex-wrap gap-5 text-sm text-white/45"><span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-secondary" />{formatDate(guide.updatedAt)}</span><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-secondary" />{guide.readTime}</span></div></header>
    {guide.image && <div className="mb-10 overflow-hidden rounded-3xl border border-white/10"><img src={guide.image} alt={guide.title} fetchPriority="high" className="max-h-[520px] w-full object-cover" /></div>}
    {headings.length >= 3 && <nav aria-label="Mục lục" className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="mb-3 font-bold">Trong bài viết</h2><ol className="space-y-2">{headings.map(item => <li key={item.id} className={item.level === 'h3' ? 'ml-5' : ''}><a className="text-sm text-white/60 hover:text-secondary" href={`#${item.id}`}>{item.text}</a></li>)}</ol></nav>}
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-4 text-white/80 sm:p-8"><div className="blog-content guide-article-content" dangerouslySetInnerHTML={{ __html: content }} /></div>
    {related.length > 0 && <section className="mt-12 border-t border-white/10 pt-8"><h2 className="mb-5 text-2xl font-bold">Bài liên quan</h2><div className="grid gap-4 sm:grid-cols-3">{related.map(item => <Link key={item.slug} to={`/huong-dan/${item.slug}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 font-semibold transition hover:border-primary/40 hover:text-secondary">{item.title}</Link>)}</div></section>}
    <style>{`.guide-article-content{line-height:1.8;overflow-wrap:anywhere}.guide-article-content :where(table,pre){display:block;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.guide-article-content iframe{display:block;width:100%;max-width:100%;aspect-ratio:16/9;min-height:220px;border:0}.guide-article-content img{max-width:100%;height:auto}.guide-article-content h2,.guide-article-content h3{scroll-margin-top:6rem}`}</style>
  </article>;
}