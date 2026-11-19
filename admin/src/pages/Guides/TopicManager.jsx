import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, guideService } from '../../services/guideService';

const blank = { name: '', description: '', sortOrder: 0, isVisible: true };
const control = 'block w-full rounded-lg border border-white/10 bg-background px-3 py-2';

export default function TopicManager() {
  const [topics, setTopics] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  async function reload() {
    const rows = await guideService.topics();
    setTopics(rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi')));
  }
  useEffect(() => { reload().catch(e => setError(errorMessage(e))).finally(() => setBusy(false)); }, []);

  async function mutate(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      setForm(blank);
      await reload();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  function save(event) {
    event.preventDefault();
    const { name, description, sortOrder, isVisible } = form;
    mutate(() => guideService.saveTopic(form.id, { name, description, sortOrder: Number(sortOrder), isVisible }));
  }
  function remove(topic) {
    if (window.confirm(`Xóa “${topic.name}”? Các bài thuộc chủ đề sẽ được giữ lại và chuyển thành không có chủ đề.`)) {
      mutate(() => guideService.removeTopic(topic.id));
    }
  }
  function change(key, value) { setForm(f => ({ ...f, [key]: value })); }

  return <section className="space-y-5">
    <Link className="text-primary" to="/guides">← Bài hướng dẫn</Link>
    <h1 className="text-2xl font-bold">Quản lý chủ đề</h1>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <form onSubmit={save} className="rounded-xl border border-white/10 bg-surface p-5">
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold">{form.id ? 'Sửa chủ đề' : 'Thêm chủ đề'}</legend>
        <label className="block">Tên chủ đề<input className={control} required maxLength={100} value={form.name} onChange={e => change('name', e.target.value)} /></label>
        <label className="block">Mô tả<textarea className={control} value={form.description ?? ''} onChange={e => change('description', e.target.value)} /></label>
        <label className="block">Thứ tự<input className={control} type="number" step="1" required value={form.sortOrder} onChange={e => change('sortOrder', e.target.value)} /></label>
        <label className="block"><input type="checkbox" checked={form.isVisible} onChange={e => change('isVisible', e.target.checked)} /> Hiển thị chủ đề</label>
        <button className="rounded-lg bg-primary px-4 py-2">{form.id ? 'Lưu thay đổi' : 'Thêm chủ đề'}</button>
        {form.id && <button type="button" className="ml-4" onClick={() => setForm(blank)}>Hủy sửa</button>}
      </fieldset>
    </form>
    <ul className="divide-y divide-white/10 rounded-xl border border-white/10">{topics.map(t => <li key={t.id} className="flex flex-wrap items-center gap-4 p-4">
      <div className="mr-auto"><strong>{t.sortOrder} · {t.name}</strong><p className="text-sm text-white/60">{t.description}</p></div>
      <span>{t.isVisible ? 'Hiển thị' : 'Đang ẩn'}</span>
      <button disabled={busy} onClick={() => setForm({ ...t })}>Sửa</button>
      <button disabled={busy} className="text-red-400" onClick={() => remove(t)}>Xóa</button>
    </li>)}</ul>
  </section>;
}