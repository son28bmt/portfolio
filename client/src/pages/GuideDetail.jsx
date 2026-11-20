import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { getGuideError, guideService } from '../services/guideService';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const siteUrl = 'https://nguyenquangson.id.vn';
const draftKey = slug => `guide-question-draft:${slug}`;
const formatDate = value => value ? new Date(value).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const parseGuideTags = value => {
  let current = value;
  for (let i = 0; i < 6 && typeof current === 'string'; i += 1) {
    const text = current.trim();
    if (!text) return [];
    if (!['[', '"'].includes(text[0])) return text.split(',').map(tag => tag.trim()).filter(Boolean);
    try { current = JSON.parse(text); } catch { return text.split(',').map(tag => tag.trim()).filter(Boolean); }
  }
  const flatten = input => Array.isArray(input) ? input.flatMap(flatten) : [input];
  return flatten(current).map(tag => String(tag || '').trim()).filter(Boolean);
};

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
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isAuthenticated, loading: authLoading, account } = useAuth();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [answers, setAnswers] = useState({});
  const [questionError, setQuestionError] = useState('');
  const [questionSuccess, setQuestionSuccess] = useState('');
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [blogSuggestions, setBlogSuggestions] = useState([]);

  useEffect(() => {
    const abort = new AbortController();
    guideService.get(slug, abort.signal).then(data => {
      if (!abort.signal.aborted) setGuide(data);
    }).catch(err => {
      if (!abort.signal.aborted) setError(err.response?.status === 404 ? 'not-found' : getGuideError(err));
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [slug, retry]);

  useEffect(() => {
    let active = true;
    api.get(`/guides/${encodeURIComponent(slug)}/questions`).then(({ data }) => {
      if (active) setTemplates(Array.isArray(data) ? data : []);
    }).catch(() => { if (active) setTemplates([]); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    api.get('/blog', { params: { limit: 3 } }).then(({ data }) => setBlogSuggestions(data.items || [])).catch(() => setBlogSuggestions([]));
  }, []);

  useEffect(() => {
    if (!templates.length) return;
    const saved = sessionStorage.getItem(draftKey(slug));
    if (!saved) { setSelectedTemplateId(templates[0].id); setDraftReady(true); return; }
    try {
      const draft = JSON.parse(saved);
      setSelectedTemplateId(templates.some(t => t.id === draft.templateId) ? draft.templateId : templates[0].id);
      setAnswers(draft.answers && typeof draft.answers === 'object' ? draft.answers : {});
    } catch { setSelectedTemplateId(templates[0].id); }
    setDraftReady(true);
  }, [slug, templates]);

  useEffect(() => {
    if (!templates.length || !draftReady) return;
    sessionStorage.setItem(draftKey(slug), JSON.stringify({ templateId: selectedTemplateId, answers }));
  }, [slug, templates.length, selectedTemplateId, answers, draftReady]);

  const headings = useHeadings(guide?.content);
  const content = useMemo(() => withHeadingIds(guide?.content, headings), [guide?.content, headings]);
  const canonical = `${siteUrl}/huong-dan/${encodeURIComponent(slug || '')}`;
  if (loading) return <div className="py-24 text-center text-white/50">Đang tải bài hướng dẫn…</div>;
  if (error === 'not-found') return <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center"><h1 className="mb-4 text-3xl font-bold">Không tìm thấy bài hướng dẫn</h1><p className="mb-8 text-white/50">Bài viết có thể không tồn tại hoặc đã được gỡ.</p><Link to="/huong-dan" className="rounded-xl bg-primary px-6 py-3 font-bold">Về trang hướng dẫn</Link></div>;
  if (error) return <div className="py-20 text-center"><p role="alert" className="mb-4 text-red-300">{error}</p><button onClick={() => setRetry(n => n + 1)} className="rounded-xl bg-white/10 px-4 py-2">Thử lại</button></div>;
  if (!guide) return null;

  const related = (guide.relatedGuides || []).slice(0, 3);
  const tags = parseGuideTags(guide.tags);
  const questionTemplate = templates.find(item => item.id === selectedTemplateId) || templates[0];
  const questionGuestId = localStorage.getItem('chat_guest_id') || '';
  const excerpt = guide.excerpt || guide.title;
  return <div className="mx-auto grid max-w-7xl gap-8 px-3 py-6 sm:px-5 sm:py-10 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
    <aside className="hidden lg:block"><div className="sticky top-24 space-y-3"><h2 className="text-xs font-bold uppercase text-white/50">Hướng dẫn khác</h2>{related.map(item => <Link key={item.slug} to={`/huong-dan/${item.slug}`} className="block border-l border-white/10 py-1 pl-3 text-sm text-white/60 hover:border-primary hover:text-white">{item.title}</Link>)}</div></aside>
    <article className="min-w-0 px-1 py-0">
    <Helmet><title>{guide.seoTitle || guide.title} | Hướng dẫn Nguyễn Quang Sơn</title><meta name="description" content={guide.seoDescription || excerpt} /><link rel="canonical" href={guide.canonicalUrl || canonical} /><meta property="og:title" content={guide.seoTitle || guide.title} /><meta property="og:description" content={guide.seoDescription || excerpt} />{(guide.ogImage || guide.image) && <meta property="og:image" content={guide.ogImage || guide.image} />}<meta property="og:url" content={guide.canonicalUrl || canonical} /><meta property="og:type" content="article" /></Helmet>
    <Link to="/huong-dan" className="mb-7 inline-flex items-center gap-2 text-white/50 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Tất cả hướng dẫn</Link>
    <header className="mb-9"><div className="mb-4">{guide.topic && <Link to={`/huong-dan?topic=${encodeURIComponent(guide.topic.slug)}`} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary">{guide.topic.name}</Link>}</div><h1 className="mb-5 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">{guide.title}</h1><div className="flex flex-wrap gap-5 text-sm text-white/45"><span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-secondary" />{formatDate(guide.updatedAt)}</span><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-secondary" />{guide.readTime}</span>{(guide.authorName || guide.authorId) && <span>Tác giả: {guide.authorName || guide.authorId}</span>}</div>{tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs text-primary">#{tag}</span>)}</div>}</header>
    {guide.image && <div className="mb-10 overflow-hidden rounded-3xl border border-white/10"><img src={guide.image} alt={guide.title} fetchPriority="high" className="max-h-[520px] w-full object-cover" /></div>}
    {headings.length >= 3 && <nav aria-label="Mục lục" className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="mb-3 font-bold">Trong bài viết</h2><ol className="space-y-2">{headings.map(item => <li key={item.id} className={item.level === 'h3' ? 'ml-5' : ''}><a className="text-sm text-white/60 hover:text-secondary" href={`#${item.id}`}>{item.text}</a></li>)}</ol></nav>}
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-4 text-white/80 sm:p-8"><div className="blog-content guide-article-content" dangerouslySetInnerHTML={{ __html: content }} /></div>
    {templates.length > 0 && <section className="mt-10 rounded-3xl border border-secondary/20 bg-secondary/[0.04] p-5 sm:p-8">
      <h2 className="mb-2 text-2xl font-bold">Bạn cần hỗ trợ thêm?</h2><p className="mb-5 text-sm text-white/55">Gửi câu hỏi riêng cho đội ngũ hỗ trợ. Cần đăng nhập và có email hợp lệ trong hồ sơ.</p>
      {!isAuthenticated && !authLoading && <button type="button" onClick={() => { sessionStorage.setItem(draftKey(slug), JSON.stringify({ templateId: selectedTemplateId, answers })); navigate('/dang-nhap', { state: { from: { pathname: location.pathname, search: location.search } } }); }} className="mb-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold">Đăng nhập để hỏi</button>}
      {isAuthenticated && <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); setQuestionError(''); setQuestionSuccess('');
        if (!account?.email) { setQuestionError('Hãy thêm email hợp lệ vào hồ sơ tài khoản trước khi gửi câu hỏi.'); return; }
        setSendingQuestion(true);
        try {
          const { data } = await api.post('/chat/guide-question', { guestId: questionGuestId, guideSlug: slug, templateId: questionTemplate.id, answers }, { headers: { Authorization: `Bearer ${token}`, 'x-guest-token': localStorage.getItem('chat_guest_token_v1') || '' } });
          sessionStorage.removeItem(draftKey(slug)); setAnswers({}); setQuestionSuccess(`Đã gửi yêu cầu hỗ trợ #${data.requestNumber || ''}. Đội ngũ hỗ trợ sẽ phản hồi trong cuộc trò chuyện STAFF.`);
        } catch (error) { setQuestionError(error.response?.data?.message || 'Không thể gửi câu hỏi. Vui lòng thử lại.'); }
        finally { setSendingQuestion(false); }
      }}>
        {templates.length > 1 && <label className="block text-sm">Chọn mẫu câu hỏi<select className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={questionTemplate?.id || ''} onChange={event => { setSelectedTemplateId(event.target.value); setAnswers({}); }}>
          {templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
        {questionTemplate?.fields.map(field => <label key={field.key} className="block text-sm">{field.label}{field.required ? ' *' : ''}{field.type === 'textarea' ? <textarea required={field.required} maxLength={field.maxLength} value={answers[field.key] || ''} onChange={event => setAnswers(a => ({ ...a, [field.key]: event.target.value }))} className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" /> : <input required={field.required} type={field.type} maxLength={field.maxLength} value={answers[field.key] || ''} onChange={event => setAnswers(a => ({ ...a, [field.key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />}</label>)}
        {questionError && <p role="alert" className="text-sm text-red-300">{questionError}</p>}{questionSuccess && <p role="status" className="text-sm text-emerald-300">{questionSuccess}</p>}
        <button disabled={sendingQuestion || authLoading || !questionTemplate} className="rounded-xl bg-secondary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{sendingQuestion ? 'Đang gửi…' : 'Gửi câu hỏi'}</button>
      </form>}
    </section>}
    {related.length > 0 && <section className="mt-12 border-t border-white/10 pt-8"><h2 className="mb-5 text-2xl font-bold">Bài liên quan</h2><div className="grid gap-4 sm:grid-cols-3">{related.map(item => <Link key={item.slug} to={`/huong-dan/${item.slug}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 font-semibold transition hover:border-primary/40 hover:text-secondary">{item.title}</Link>)}</div></section>}
    <style>{`.guide-article-content{line-height:1.8;overflow-wrap:anywhere}.guide-article-content :where(table,pre){display:block;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.guide-article-content iframe{display:block;width:100%;max-width:100%;aspect-ratio:16/9;min-height:220px;border:0}.guide-article-content img{max-width:100%;height:auto}.guide-article-content figure{margin:1rem 0}.guide-article-content figure[data-align="center"]{margin-left:auto;margin-right:auto}.guide-article-content figure[data-align="right"]{margin-left:auto}.guide-article-content figcaption{text-align:center;font-size:.8rem;color:rgba(255,255,255,.5)}.guide-article-content p[style*="text-align"]{min-height:1.5em}.guide-article-content h2,.guide-article-content h3{scroll-margin-top:6rem}`}</style>
    </article>
    <aside className="hidden lg:block"><div className="sticky top-24 space-y-3"><h2 className="text-xs font-bold uppercase text-white/50">Bài blog</h2>{blogSuggestions.map(item => <Link key={item.id} to={`/blog/${item.slug || item.id}`} className="block border-l border-white/10 py-1 pl-3 text-sm text-white/60 hover:border-primary hover:text-white">{item.title}</Link>)}</div></aside>
  </div>;
}