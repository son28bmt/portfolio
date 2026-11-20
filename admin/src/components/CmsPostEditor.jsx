import { useEffect, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Eye, History, Save, Upload } from 'lucide-react';
import api from '../services/api';
import { guideService } from '../services/guideService';
import RichEditor from './RichEditor';
import { uploadCmsImage } from '../services/cmsUploadService';
import useAutosave from '../hooks/useAutosave';
import { readingTime, sanitizeHtml, slugify, tagsFromString, tagsToString } from '../utils/cms';

const blank = { title: '', slug: '', excerpt: '', content: '', content_json: null, tags: '', image: '', coverAlt: '', coverCaption: '', status: 'draft', scheduledAt: '', authorId: '', seoTitle: '', seoDescription: '', ogImage: '', canonicalUrl: '', topicId: '' };
const input = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary';
const statuses = ['draft', 'scheduled', 'published', 'archived'];
const normalize = value => ({ ...blank, ...value, tags: tagsToString(value?.tags), scheduledAt: value?.scheduledAt ? String(value.scheduledAt).slice(0, 16) : '' });

export default function CmsPostEditor({ postType }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isGuide = postType === 'guide';
  const [form, setForm] = useState(blank);
  const [topics, setTopics] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [coverPreview, setCoverPreview] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(!id);
  const [serverVersion, setServerVersion] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [slugState, setSlugState] = useState('');
  const blocker = useBlocker(dirty && !saving);

  const load = async () => {
    setLoading(true);
    try {
      const data = isGuide ? await guideService.get(id) : (await api.get(`/admin/cms/blog/${id}`)).data;
      setForm(normalize(data)); setServerVersion(Number(data.cmsVersion || 0)); setDirty(false); setCoverPreview(data.image || '');
      const list = isGuide ? await api.get(`/admin/guides/${id}/revisions`) : await api.get(`/blog/${id}/revisions`);
      setRevisions(Array.isArray(list.data) ? list.data : []);
    } catch (err) { setError(err.response?.data?.message || err.message); } finally { setLoading(false); }
  };
  useEffect(() => { if (id) load(); }, [id, isGuide]);
  useEffect(() => { if (isGuide) guideService.topics().then(setTopics).catch(() => {}); }, [isGuide]);
  useEffect(() => {
    const slug = slugify(form.slug);
    if (!slug) { setSlugState(''); return undefined; }
    const timer = setTimeout(async () => {
      try { const { data } = await api.get(`/admin/cms/${postType}/check-slug`, { params: { slug, id } }); setSlugState(data.available ? 'available' : 'taken'); }
      catch { setSlugState(''); }
    }, 350);
    return () => clearTimeout(timer);
  }, [form.slug, id, postType]);
  useEffect(() => { const handler = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  useEffect(() => { if (blocker.state === 'blocked' && window.confirm('Có thay đổi chưa lưu. Bạn có chắc muốn rời trang?')) blocker.proceed(); else if (blocker.state === 'blocked') blocker.reset(); }, [blocker]);

  const change = (key, value) => { setForm(prev => ({ ...prev, [key]: value })); setDirty(true); };
  const save = async (mode = form.status) => {
    setError('');
    if (!form.title.trim()) return setError('Tiêu đề là bắt buộc.');
    const content = sanitizeHtml(form.content);
    if (!content.replace(/<[^>]*>/g, '').trim()) return setError('Nội dung là bắt buộc.');
    if (mode === 'scheduled' && !form.scheduledAt) return setError('Cần chọn ngày hẹn đăng.');
    if (slugState === 'taken') return setError('Slug đã tồn tại.');
    setSaving(true);
    try {
      const payload = { ...form, content, tags: tagsFromString(form.tags), slug: slugify(form.slug || form.title), readTime: readingTime(content), status: mode, scheduledAt: form.scheduledAt || null };
      const response = isGuide ? await guideService.save(id, payload) : await api({ method: id ? 'put' : 'post', url: id ? `/blog/${id}` : '/blog', data: payload });
      const saved = response.data || response;
      setForm(normalize(saved)); setServerVersion(Number(saved.cmsVersion || 0)); setDirty(false);
      if (!id && saved.id) navigate(isGuide ? `/guides/editor/${saved.id}` : `/blog/edit/${saved.id}`, { replace: true });
      else if (id) await load();
    } catch (err) { setError(err.response?.data?.message || err.message); } finally { setSaving(false); }
  };
  const autosave = useAutosave({ enabled: Boolean(id && dirty && form.content && serverVersion !== null), value: form, save: value => {
    const body = { content: sanitizeHtml(value.content), title: value.title, excerpt: value.excerpt, expectedVersion: serverVersion };
    const request = isGuide ? api.post(`/admin/guides/${id}/autosave`, body) : api.post(`/blog/${id}/autosave`, body);
    return request.then(response => { setServerVersion(Number(response.data?.cmsVersion ?? serverVersion + 1)); }).catch(error => {
      if (error.response?.status === 409) setError('Bài viết đã được thay đổi ở nơi khác. Hãy tải lại trước khi tiếp tục.');
      throw error;
    });
  }});

  const uploadCover = async event => { const file = event.target.files?.[0]; if (!file) return; try { const url = await uploadCmsImage(file, 'cms/cover'); change('image', url); setCoverPreview(url); } catch (err) { setError(err.message); } event.target.value = ''; };
  const restore = async revision => { if (!window.confirm('Khôi phục phiên bản này?')) return; try { const result = isGuide ? await api.post(`/admin/guides/${id}/restore/${revision.id}`) : await api.post(`/blog/${id}/restore/${revision.id}`); setForm(normalize(result.data)); setDirty(false); } catch (err) { setError(err.response?.data?.message || err.message); } };
  const cover = coverPreview || form.image;
  const autosaveText = autosave.status === 'saving' ? 'Đang lưu tự động…' : autosave.status === 'saved' ? `Đã lưu lúc ${autosave.at?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : autosave.status === 'error' ? 'Tự động lưu lỗi' : '';

  if (loading) return <p>Đang tải…</p>;
  return <section className="mx-auto max-w-6xl space-y-5 pb-24">
    <div className="flex items-center justify-between gap-3"><Link to={isGuide ? '/guides' : '/blog'} className="flex items-center gap-2 text-primary"><ArrowLeft size={18} /> Quay lại</Link><div className="text-xs text-white/50">{autosaveText}</div></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{id ? 'Chỉnh sửa' : 'Tạo'} {isGuide ? 'bài hướng dẫn' : 'bài blog'}</h1><button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-sm" onClick={() => setPreview(v => !v)}><Eye size={16} className="mr-1 inline" />{preview ? 'Đóng xem trước' : 'Xem trước'}</button></div>
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    {preview ? <article className="rounded-xl border border-white/10 bg-surface p-5"><h1 className="mb-3 text-3xl font-bold">{form.title || 'Chưa có tiêu đề'}</h1><p className="mb-5 text-white/60">{form.excerpt}</p>{cover && <img src={cover} alt={form.coverAlt} className="mb-5 max-h-[420px] w-full rounded-lg object-cover" />}<div className="rich-preview" dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.content) }} /></article> : <form onSubmit={e => { e.preventDefault(); save(form.status); }} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5"><div className="rounded-xl border border-white/10 bg-surface p-5 space-y-4"><label className="block text-sm">Tiêu đề<input className={input} maxLength={255} value={form.title} onChange={e => { const title = e.target.value; setForm(prev => ({ ...prev, title, slug: !prev.slug || prev.slug === slugify(prev.title) ? slugify(title) : prev.slug })); setDirty(true); }} required /></label><label className="block text-sm">Slug<input className={input} value={form.slug} onChange={e => change('slug', slugify(e.target.value))} /><span className={slugState === 'taken' ? 'text-xs text-red-300' : 'text-xs text-white/40'}>{slugState === 'taken' ? 'Slug đã được sử dụng.' : slugState === 'available' ? 'Slug có thể dùng.' : 'Tự sinh từ tiêu đề, có thể chỉnh sửa.'}</span></label><label className="block text-sm">Tóm tắt<textarea className={input} maxLength={500} rows="3" value={form.excerpt} onChange={e => change('excerpt', e.target.value)} /></label><label className="block text-sm">Tags<input className={input} placeholder="react, javascript" value={form.tags} onChange={e => change('tags', e.target.value)} /></label>{isGuide && <label className="block text-sm">Chủ đề<select className={input} value={form.topicId || ''} onChange={e => change('topicId', e.target.value)}><option value="">Không có chủ đề</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>}</div>
        <div className="rounded-xl border border-white/10 bg-surface p-3"><RichEditor value={form.content} onChange={value => change('content', value)} disabled={saving} folder="cms/content" /></div>
        <div className="rounded-xl border border-white/10 bg-surface p-5 space-y-3"><h2 className="font-semibold">SEO</h2><label className="block text-sm">Meta title<input className={input} maxLength={255} value={form.seoTitle} onChange={e => change('seoTitle', e.target.value)} /></label><label className="block text-sm">Meta description<textarea className={input} maxLength={500} value={form.seoDescription} onChange={e => change('seoDescription', e.target.value)} /></label><label className="block text-sm">Ảnh OG<input className={input} type="url" value={form.ogImage} onChange={e => change('ogImage', e.target.value)} /></label><label className="block text-sm">Canonical URL<input className={input} type="url" value={form.canonicalUrl} onChange={e => change('canonicalUrl', e.target.value)} /></label></div></div>
      <aside className="space-y-5"><div className="rounded-xl border border-white/10 bg-surface p-5 space-y-3"><label className="block text-sm">Trạng thái<select className={input} value={form.status} onChange={e => change('status', e.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>{form.status === 'scheduled' && <label className="block text-sm">Hẹn đăng<input className={input} type="datetime-local" value={form.scheduledAt} onChange={e => change('scheduledAt', e.target.value)} /></label>}<label className="block text-sm">Tác giả<input className={input} value={form.authorId} onChange={e => change('authorId', e.target.value)} /></label><div className="flex items-center gap-2 text-xs text-white/50"><Clock size={15} /> Thời gian đọc: {readingTime(form.content)}</div></div>
        <div className="rounded-xl border border-white/10 bg-surface p-5 space-y-3"><h2 className="font-semibold">Ảnh bìa</h2><input type="file" accept="image/*" onChange={uploadCover} /><input className={input} placeholder="URL ảnh" value={form.image} onChange={e => { change('image', e.target.value); setCoverPreview(e.target.value); }} />{cover && <img src={cover} alt={form.coverAlt || 'Ảnh bìa'} className="max-h-48 w-full rounded-lg object-cover" />}<input className={input} placeholder="Alt ảnh bìa" value={form.coverAlt} onChange={e => change('coverAlt', e.target.value)} /><input className={input} placeholder="Chú thích ảnh" value={form.coverCaption} onChange={e => change('coverCaption', e.target.value)} /></div>
        {id && <div className="rounded-xl border border-white/10 bg-surface p-5"><h2 className="mb-3 flex items-center gap-2 font-semibold"><History size={16} /> Lịch sử phiên bản</h2><div className="max-h-56 space-y-2 overflow-auto">{revisions.map(rev => <div key={rev.id} className="flex items-center justify-between gap-2 text-xs"><span>{rev.action} · {new Date(rev.createdAt).toLocaleString('vi-VN')}</span><button type="button" className="text-primary" onClick={() => restore(rev)}>Khôi phục</button></div>)}</div></div>}</aside>
      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-end gap-2 border-t border-white/10 bg-background/95 p-3 backdrop-blur lg:static lg:col-span-2 lg:bg-transparent lg:p-0"><button type="button" className="rounded-lg border border-white/15 px-4 py-2" onClick={() => navigate(isGuide ? '/guides' : '/blog')}>Hủy</button><button type="submit" className="rounded-lg border border-primary/50 bg-primary/20 px-4 py-2"><Save size={16} className="mr-1 inline" />Lưu</button><button type="button" className="rounded-lg bg-primary px-4 py-2" onClick={() => save('published')}><Upload size={16} className="mr-1 inline" />Đăng</button></div>
    </form>}
  </section>;
}