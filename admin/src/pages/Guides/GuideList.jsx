import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { guideService as service, errorMessage } from '../../services/guideService';

const control = 'rounded-lg border border-white/15 bg-surface px-3 py-2';

export default function GuideList() {
  const [topics, setTopics] = useState([]);
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState({ page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);

  useEffect(() => { service.topics().then(setTopics).catch(e => setActionError(errorMessage(e))); }, []);
  useEffect(() => {
    const timer = setTimeout(() => setFilters(f => f.q === input.trim() ? f : { ...f, q: input.trim(), page: 1 }), 400);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    const abort = new AbortController();
    setResult(null);
    setError('');
    service.list(filters, abort.signal).then(rows => {
      if (abort.signal.aborted) return;
      if (filters.page > Math.max(1, rows.totalPages)) setFilters(f => ({ ...f, page: Math.max(1, rows.totalPages) }));
      else setResult(rows);
    }).catch(e => { if (!abort.signal.aborted) setError(errorMessage(e)); });
    return () => abort.abort();
  }, [filters, revision]);

  async function act(row, remove) {
    if (remove && !window.confirm(`Xóa bài “${row.title}”?`)) return;
    setBusy(true);
    setActionError('');
    try {
      if (remove) await service.remove(row.id);
      else await service.setPublished(row.id, row.status !== 'published');
      refresh(n => n + 1);
    } catch (e) { setActionError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  function filter(key, value) { setFilters(f => ({ ...f, [key]: value || undefined, page: 1 })); }

  return <section className="space-y-5">
    <header className="flex flex-wrap items-center gap-4"><h1 className="mr-auto text-2xl font-bold">Bài hướng dẫn</h1>
      <Link className={control} to="/guides/topics">Quản lý chủ đề</Link><Link className="rounded-lg bg-primary px-4 py-2 text-black" to="/guides/editor">Tạo bài</Link></header>
    <div className="flex flex-wrap gap-3"><input className={control} aria-label="Tìm bài" placeholder="Tìm bài hướng dẫn…" maxLength={100} value={input} onChange={e => setInput(e.target.value)} />
      <select className={control} aria-label="Trạng thái" onChange={e => filter('status', e.target.value)}><option value="">Mọi trạng thái</option><option value="draft">Nháp</option><option value="published">Đã đăng</option></select>
      <select className={control} aria-label="Chủ đề" onChange={e => filter('topic', e.target.value)}><option value="">Mọi chủ đề</option>{topics.map(t => <option key={t.id} value={t.slug}>{t.name}</option>)}</select></div>
    {(error || actionError) && <p role="alert" className="text-red-400">{error || actionError}</p>}
    {result ? <><div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-surface"><tr>{['Tiêu đề','Chủ đề','Trạng thái','Cập nhật','Thao tác'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead>
      <tbody>{result.items.map(row => <tr className="border-t border-white/10" key={row.id}><td className="p-3"><Link className="text-primary" to={`/guides/editor/${row.id}`}>{row.title}</Link></td><td className="p-3">{row.topic?.name || 'Không có chủ đề'}</td><td className="p-3">{row.status === 'published' ? 'Đã đăng' : 'Nháp'}</td><td className="p-3">{new Date(row.updatedAt).toLocaleString('vi-VN')}</td><td className="whitespace-nowrap p-3"><button disabled={busy} onClick={() => act(row, false)}>{row.status === 'published' ? 'Gỡ đăng' : 'Đăng'}</button><button className="ml-4 text-red-400" disabled={busy} onClick={() => act(row, true)}>Xóa</button></td></tr>)}</tbody></table></div>
      {!result.items.length && <p>Không có bài phù hợp.</p>}
      <div className="flex items-center gap-4"><button className={control} disabled={filters.page === 1} onClick={() => filterPage(-1)}>Trước</button>Trang {filters.page} / {Math.max(1,result.totalPages)}<button className={control} disabled={filters.page >= result.totalPages} onClick={() => filterPage(1)}>Sau</button></div></> : !error && <p>Đang tải danh sách…</p>}
  </section>;
  function filterPage(step) { setFilters(f => ({ ...f, page: f.page + step })); }
}