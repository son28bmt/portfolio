import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage, guideService } from '../../services/guideService';

const blank = { name: '', isActive: true, reusable: false, fields: [{ key: 'question', label: 'Câu hỏi của bạn', type: 'textarea', required: true, maxLength: 2000 }] };
const control = 'block w-full rounded-lg border border-white/10 bg-background px-3 py-2';

export default function QuestionManager() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  async function reload() {
    setItems(await guideService.questionTemplates(id));
  }
  useEffect(() => { reload().catch(e => setError(errorMessage(e))).finally(() => setBusy(false)); }, [id]);
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const updateField = (index, key, value) => change('fields', form.fields.map((field, i) => i === index ? { ...field, [key]: value } : field));
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await guideService.saveQuestionTemplate(form.id, { ...form, guideId: form.reusable ? null : id, fields: form.fields.map(field => ({ ...field, maxLength: Number(field.maxLength) })) });
      setForm(blank);
      await reload();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm(`Xóa mẫu “${item.name}”?`)) return;
    setBusy(true);
    setError('');
    try { await guideService.removeQuestionTemplate(item.id); await reload(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-3xl space-y-5">
    <Link className="text-primary" to={`/guides/editor/${id}`}>← Sửa bài hướng dẫn</Link>
    <h1 className="text-2xl font-bold">Mẫu câu hỏi cuối bài</h1>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <form onSubmit={save} className="space-y-4 rounded-xl border border-white/10 bg-surface p-5">
      <label className="block">Tên mẫu<input className={control} required maxLength={160} value={form.name} onChange={e => change('name', e.target.value)} /></label>
      <label className="block"><input type="checkbox" checked={form.isActive} onChange={e => change('isActive', e.target.checked)} /> Đang bật trên bài đã đăng</label>
      <label className="block"><input type="checkbox" checked={Boolean(form.reusable || form.guideId === null && form.id)} onChange={e => change('reusable', e.target.checked)} /> Dùng lại cho mọi bài hướng dẫn</label>
      <fieldset disabled={busy} className="space-y-3"><legend className="font-semibold">Các trường</legend>
        {form.fields.map((field, index) => <div key={index} className="grid gap-2 rounded-lg border border-white/10 p-3 md:grid-cols-2">
          <input className={control} required placeholder="Key" maxLength={40} value={field.key} onChange={e => updateField(index, 'key', e.target.value)} />
          <input className={control} required placeholder="Nhãn hiển thị" maxLength={120} value={field.label} onChange={e => updateField(index, 'label', e.target.value)} />
          <select className={control} value={field.type} onChange={e => updateField(index, 'type', e.target.value)}><option value="text">Văn bản ngắn</option><option value="textarea">Văn bản dài</option><option value="email">Email</option><option value="tel">Điện thoại</option></select>
          <input className={control} type="number" min="1" max="2000" value={field.maxLength} onChange={e => updateField(index, 'maxLength', e.target.value)} />
          <label><input type="checkbox" checked={field.required} onChange={e => updateField(index, 'required', e.target.checked)} /> Bắt buộc</label>
          <button type="button" className="text-red-400" disabled={form.fields.length === 1} onClick={() => change('fields', form.fields.filter((_, i) => i !== index))}>Xóa trường</button>
        </div>)}
        <button type="button" onClick={() => change('fields', [...form.fields, { key: `field_${form.fields.length + 1}`, label: '', type: 'text', required: false, maxLength: 500 }])}>Thêm trường</button>
      </fieldset>
      <button className="rounded-lg bg-primary px-4 py-2">{form.id ? 'Lưu mẫu' : 'Tạo mẫu'}</button>
      {form.id && <button type="button" onClick={() => setForm(blank)} className="ml-3">Hủy sửa</button>}
    </form>
    <ul className="space-y-2">{items.map(item => <li key={item.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3"><div className="mr-auto"><strong>{item.name}</strong> · {item.isActive ? 'Bật' : 'Tắt'} · {item.fields.length} trường · {item.guideId ? 'Chỉ bài này' : 'Dùng chung'}</div><button disabled={busy} onClick={() => setForm({ ...item, reusable: !item.guideId, fields: item.fields })}>Sửa</button><button disabled={busy} className="text-red-400" onClick={() => remove(item)}>Xóa</button></li>)}</ul>
  </section>;
}