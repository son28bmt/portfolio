import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { guideService, errorMessage } from '../../services/guideService';
import { uploadToCloudflareR2 } from '../../services/uploadService';

const Delta = Quill.import('delta');
const formats = ['header', 'bold', 'italic', 'underline', 'strike', 'code', 'blockquote', 'list', 'align', 'link', 'image', 'video'];
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const blank = { title: '', topicId: '', excerpt: '', readTime: '5 min', image: '', slug: '', content: '', status: 'draft' };
const control = 'block w-full rounded-lg border border-white/10 bg-background px-3 py-2';

async function uploadImage(file) {
  if (!imageTypes.includes(file?.type)) throw new Error('Hãy chọn ảnh JPG, PNG, WebP, GIF hoặc AVIF.');
  const [url] = await uploadToCloudflareR2([file], 'guides/images');
  if (!/^https:\/\//i.test(url || '')) throw new Error('Dịch vụ tải ảnh chưa trả về URL HTTPS.');
  return url;
}

function youtubeEmbed(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    let id;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (['youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)$/)?.[1];
    }
    return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

// Quill's semantic export handles both list kinds, but renders video as a link.
// Export the runs around video embeds separately to retain their iframe representation.
function guideHtml(editor) {
  let start = 0, index = 0, html = '';
  for (const op of editor.getContents().ops) {
    if (op.insert?.video) {
      if (index > start) html += editor.getSemanticHTML(start, index - start);
      const src = youtubeEmbed(op.insert.video);
      if (src) html += `<iframe src="${src}"></iframe>`;
      start = index + 1;
    }
    index += typeof op.insert === 'string' ? op.insert.length : 1;
  }
  return html + (index > start ? editor.getSemanticHTML(start, index - start) : '');
}

function errorField(message) {
  const patterns = { title: /tiêu đề|title/i, slug: /slug/i, excerpt: /excerpt|tóm tắt/i,
    content: /nội dung|content/i, image: /ảnh|R2|image/i, readTime: /readTime/i, topicId: /topicId|chủ đề/i };
  return Object.keys(patterns).find(key => patterns[key].test(message)) || 'form';
}

export default function GuideEditor() {
  const { id } = useParams();
  return <Editor key={id || 'new'} id={id} />;
}

function Editor({ id }) {
  const navigate = useNavigate();
  const editor = useRef(null);
  const contentChanged = useRef(false);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(blank);
  const [topics, setTopics] = useState([]);
  const [errors, setErrors] = useState({});
  const [editingSlug, setEditingSlug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState(0);

  useEffect(() => {
    let current = true;
    Promise.all([guideService.topics(), id ? guideService.get(id) : blank]).then(([rows, guide]) => {
      if (!current) return;
      setTopics(rows);
      setForm({ ...blank, ...guide });
      setRecord(guide);
    }).catch(e => { if (current) setErrors({ form: errorMessage(e) }); });
    return () => { current = false; };
  }, [id]);

  function change(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  }
  function fieldError(key) { return errors[key] && <span className="block text-sm text-red-400" role="alert">{errors[key]}</span>; }
  const modules = useMemo(() => ({
    toolbar: {
      container: [[{ header: [1, 2, 3, 4, false] }], ['bold', 'italic', 'underline', 'strike', 'code', 'blockquote'],
        [{ list: 'ordered' }, { list: 'bullet' }, { align: [] }], ['link', 'image', 'video']],
      handlers: { video() {
        const value = window.prompt('Nhập liên kết video YouTube');
        if (!value) return;
        const embed = youtubeEmbed(value);
        if (!embed) { setErrors(e => ({ ...e, content: 'Liên kết YouTube không hợp lệ.' })); return; }
        const range = this.quill.getSelection(true);
        this.quill.insertEmbed(range.index, 'video', embed, 'user');
      } },
    },
    uploader: { mimetypes: imageTypes, async handler(range, files) {
      setUploads(n => n + 1);
      try {
        let position = range.index;
        for (const file of files) this.quill.insertEmbed(position++, 'image', await uploadImage(file), 'user');
      } catch (e) { setErrors(old => ({ ...old, content: e.message })); }
      finally { setUploads(n => n - 1); }
    } },
    clipboard: { matchers: [
      ['IMG', (node, delta) => /^https:\/\//i.test(node.getAttribute('src') || '') ? delta : new Delta()],
      ['IFRAME', node => { const src = youtubeEmbed(node.getAttribute('src')); return src ? new Delta().insert({ video: src }) : new Delta(); }],
    ] },
  }), []);

  async function cover(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setUploads(n => n + 1);
    try { change('image', await uploadImage(file)); }
    catch (e) { setErrors(old => ({ ...old, image: e.message })); }
    finally { setUploads(n => n - 1); }
  }

  async function save(publish) {
    setSaving(true);
    setErrors({});
    let persisted = false;
    try {
      const { title, excerpt, image, readTime, topicId } = form;
      const body = { title, excerpt, image: image || null, readTime, topicId: topicId || null };
      if (!record.id || contentChanged.current) body.content = guideHtml(editor.current.getEditor());
      if (editingSlug && form.slug !== record.slug) body.slug = form.slug;
      const saved = await guideService.save(record.id, body);
      persisted = true;
      setRecord(saved);
      setForm(saved);
      setEditingSlug(false);
      if (publish !== (saved.status === 'published')) await guideService.setPublished(saved.id, publish);
      navigate('/guides');
    } catch (e) {
      const message = errorMessage(e);
      const key = e.response?.status === 400 ? errorField(message) : 'form';
      setErrors({ [key]: persisted ? `Đã lưu nội dung. Chuyển trạng thái thất bại. ${message}` : message });
    } finally { setSaving(false); }
  }

  function manageQuestions() {
    navigate(`/guides/questions/${record.id}`);
  }

  return <section className="mx-auto max-w-4xl space-y-5">
    <Link className="text-primary" to="/guides">← Bài hướng dẫn</Link>
    <h1 className="text-2xl font-bold">{record?.id ? 'Sửa bài hướng dẫn' : 'Tạo bài hướng dẫn'}</h1>
    {fieldError('form')}
    {!record ? !errors.form && <p>Đang tải…</p> : <form onSubmit={e => { e.preventDefault(); save(e.nativeEvent.submitter?.value === 'publish'); }}>
      <fieldset disabled={saving || uploads > 0} className="space-y-4 rounded-xl border border-white/10 bg-surface p-5">
        <label className="block">Tiêu đề<input className={control} required maxLength={255} value={form.title} onChange={e => change('title', e.target.value)} />{fieldError('title')}</label>
        <div><label className="block">Slug<input className={control} readOnly={!editingSlug} placeholder="Máy chủ tạo slug khi lưu lần đầu" value={form.slug} onChange={e => change('slug', e.target.value)} /></label>
          <button type="button" className="text-primary" onClick={() => { change('slug', record.slug); setEditingSlug(v => !v); }}>{editingSlug ? 'Hủy sửa slug' : 'Sửa slug'}</button>
          {editingSlug && <p className="text-amber-300">Lưu ý: đổi slug sẽ làm hỏng link đã chia sẻ.</p>}{fieldError('slug')}</div>
        <label className="block">Chủ đề<select className="admin-select" value={form.topicId ?? ''} onChange={e => change('topicId', e.target.value)}><option value="">Không có chủ đề</option>{topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>{fieldError('topicId')}</label>
        <label className="block">Tóm tắt · {(form.excerpt || '').length}/500<textarea className={control} maxLength={500} value={form.excerpt || ''} onChange={e => change('excerpt', e.target.value)} />{fieldError('excerpt')}</label>
        <label className="block">Thời gian đọc<input className={control} maxLength={20} value={form.readTime} onChange={e => change('readTime', e.target.value)} />{fieldError('readTime')}</label>
        <label className="block">Ảnh bìa<input className="block" type="file" accept={imageTypes.join(',')} onChange={cover} />{fieldError('image')}</label>
        {form.image && <div><img className="mb-2 max-h-40 rounded-lg" src={form.image} alt="Ảnh bìa hiện tại" /><button type="button" onClick={() => change('image', '')}>Bỏ ảnh bìa</button></div>}
        <div>Nội dung<div className="quill-container mt-2 rounded-lg border border-white/10"><ReactQuill ref={editor} theme="snow" defaultValue={record.content} readOnly={saving} modules={modules} formats={formats}
          onChange={(_html, _delta, source) => { if (source === 'user') contentChanged.current = true; }} /></div>{fieldError('content')}</div>
        {uploads > 0 && <p role="status">Đang tải ảnh…</p>}
        <div className="flex gap-3"><button className="rounded-lg border border-white/20 px-4 py-2" value="draft">Lưu nháp</button><button className="rounded-lg bg-primary px-4 py-2" value="publish">Đăng</button></div>
        {record.id && <button type="button" className="text-primary" onClick={manageQuestions}>Quản lý mẫu câu hỏi cuối bài</button>}
      </fieldset>
    </form>}
  </section>;
}