import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowUpRight, Calendar, Clock } from 'lucide-react';
import { getGuideError, guideService } from '../services/guideService';
import SmartSearch from '../components/SmartSearch';

const siteUrl = 'https://nguyenquangson.id.vn';
const getPage = (value) => /^\d+$/.test(value || '') && Number(value) > 0 ? Number(value) : 1;
const date = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : '';

export default function Guides() {
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') || '';
  const q = params.get('q') || '';
  const page = getPage(params.get('page'));
  const lastSubmittedQuery = useRef(q);
  const [search, setSearch] = useState(q);
  const [topics, setTopics] = useState([]);
  const [guides, setGuides] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const setQuery = useCallback((next) => setParams(current => {
    const output = new URLSearchParams(current);
    Object.entries(next).forEach(([key, value]) => value ? output.set(key, String(value)) : output.delete(key));
    if (!Object.hasOwn(next, 'page')) output.delete('page');
    return output;
  }), [setParams]);
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => { lastSubmittedQuery.current = q; }, [q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = search.trim();
      const next = value.length >= 2 ? value : '';
      if (next !== lastSubmittedQuery.current) {
        lastSubmittedQuery.current = next;
        setQuery({ q: next });
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search, q, setQuery]);
  useEffect(() => {
    const abort = new AbortController();
    guideService.topics(abort.signal).then(setTopics).catch(() => {});
    return () => abort.abort();
  }, [retry]);
  useEffect(() => {
    const abort = new AbortController();
    setGuides(null);
    setError('');
    const searchRequest = q.length >= 2
      ? guideService.search({ topic: topic || undefined, q, page, limit: 9 }, abort.signal)
      : guideService.list({ topic: topic || undefined, page, limit: 9 }, abort.signal);
    searchRequest
      .then(data => { if (!abort.signal.aborted) setGuides(data); })
      .catch(err => { if (!abort.signal.aborted) setError(getGuideError(err)); });
    return () => abort.abort();
  }, [topic, q, page, retry]);

  const topicLink = (slug) => {
    const next = new URLSearchParams();
    if (slug) next.set('topic', slug);
    if (q) next.set('q', q);
    const query = next.toString();
    return `/huong-dan${query ? `?${query}` : ''}`;
  };
  return <div className="mx-auto max-w-6xl px-1 py-8 sm:py-12">
    <Helmet><title>Hướng dẫn | Nguyễn Quang Sơn</title><meta name="description" content="Các bài hướng dẫn và kiến thức thực hành." /><link rel="canonical" href={`${siteUrl}/huong-dan`} /><meta property="og:title" content="Hướng dẫn | Nguyễn Quang Sơn" /><meta property="og:description" content="Các bài hướng dẫn và kiến thức thực hành." /><meta property="og:url" content={`${siteUrl}/huong-dan`} /></Helmet>
    <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between"><div className="max-w-2xl"><p className="mb-3 text-sm font-semibold text-secondary">THƯ VIỆN KIẾN THỨC</p><h1 className="mb-4 text-3xl font-bold sm:text-4xl">Hướng dẫn thực hành</h1><p className="text-white/50">Các bài viết chi tiết để bạn học, áp dụng và giải quyết vấn đề nhanh hơn.</p></div>
      <SmartSearch type="guide" value={search} onChange={setSearch} onSearch={value => setQuery({ q: value.length >= 2 ? value : '' })} topic={topic} placeholder="Tìm hướng dẫn, chủ đề, từ khóa..." className="z-30 w-full md:w-96" /></header>
    <nav aria-label="Chủ đề" className="mb-8 flex gap-2 overflow-x-auto pb-2"><Link to={topicLink('')} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${!topic ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/10 bg-white/5 text-white/60'}`}>Tất cả</Link>{topics.map(item => <Link key={item.id} to={topicLink(item.slug)} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${topic === item.slug ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/10 bg-white/5 text-white/60'}`}>{item.name} <span className="text-white/40">{item.guideCount}</span></Link>)}</nav>
    {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-center"><p className="mb-4 text-red-200">{error}</p><button onClick={() => setRetry(n => n + 1)} className="rounded-xl bg-white/10 px-4 py-2">Thử lại</button></div>}
    {!error && !guides && <div className="py-20 text-center text-white/50">Đang tải hướng dẫn…</div>}
      {guides && <>{q.length >= 2 && <p aria-live="polite" className="mb-5 text-xs text-white/40">Tìm thấy {guides.total || 0} hướng dẫn phù hợp</p>}<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{guides.items.map(guide => <article key={guide.id} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:border-primary/40"><Link to={`/huong-dan/${guide.slug}`} className="block h-full">{guide.image && <img src={guide.image} loading="lazy" alt="" className="h-44 w-full object-cover" />}<div className="flex h-full flex-col p-6"><div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-white/40"><span className="text-primary">{guide.topic?.name || 'Không có chủ đề'}</span><span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{date(guide.updatedAt)}</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{guide.readTime}</span></div><h2 className="mb-3 text-xl font-bold transition group-hover:text-secondary">{guide.title}</h2><p className="mb-6 line-clamp-3 text-sm leading-relaxed text-white/50">{guide.excerpt}</p><span className="mt-auto flex items-center gap-2 text-sm font-bold text-white/80">Đọc hướng dẫn <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span></div></Link></article>)}</div>
      {!guides.items.length && <div className="py-20 text-center text-white/50">Không tìm thấy bài hướng dẫn phù hợp.</div>}
      {guides.totalPages > 1 && <div className="mt-10 flex items-center justify-center gap-4"><button disabled={page === 1} onClick={() => setQuery({ page: page - 1 })} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 disabled:opacity-30">← Trước</button><span className="text-sm text-white/50">Trang {page} / {guides.totalPages}</span><button disabled={page >= guides.totalPages} onClick={() => setQuery({ page: page + 1 })} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 disabled:opacity-30">Sau →</button></div>}</>}
  </div>;
}