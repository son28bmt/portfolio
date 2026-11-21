import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, FilePlus2, Loader2, Pencil, Save, Search, Trash2, X } from 'lucide-react';
import { layoutTemplateApi } from '../api/layoutTemplateApi';
import { selectBlockContentDirty, selectBlockPostDirty, useBlockPostStore } from '../store/useBlockPostStore';
import { validateTemplateForSave } from '../validation/layoutSchema';

const errorMessage = (error) => error?.response?.data?.message || error?.message || 'Có lỗi xảy ra.';

export default function TemplateToolbar({ onToast }) {
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [renameTemplate, setRenameTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const blocks = useBlockPostStore((state) => state.blocks);
  const validationErrorsByBlockId = useBlockPostStore((state) => state.validationErrorsByBlockId);
  const templateId = useBlockPostStore((state) => state.templateId);
  const templateName = useBlockPostStore((state) => state.templateName);
  const templateDescription = useBlockPostStore((state) => state.templateDescription);
  const dirty = useBlockPostStore(selectBlockPostDirty);
  const contentDirty = useBlockPostStore(selectBlockContentDirty);
  const loadTemplate = useBlockPostStore((state) => state.loadTemplate);
  const markTemplateSaved = useBlockPostStore((state) => state.markTemplateSaved);
  const renameCurrentTemplate = useBlockPostStore((state) => state.renameCurrentTemplate);
  const clearCurrentTemplate = useBlockPostStore((state) => state.clearCurrentTemplate);

  useEffect(() => {
    if (dialog !== 'load') return undefined;
    setLoading(true);
    layoutTemplateApi.list({ q: query, page, limit: 12 }).then((data) => { setItems(data.items || []); setTotalPages(data.totalPages || 1); })
      .catch((error) => onToast(errorMessage(error), 'error'))
      .finally(() => setLoading(false));
    return undefined;
  }, [dialog, query, page, onToast]);

  const save = async (asNew = false) => {
    const targetName = asNew || !templateId ? name.trim() : templateName;
    if (!targetName) { onToast('Vui lòng nhập tên mẫu.', 'error'); return; }
    const panelError = Object.values(validationErrorsByBlockId)[0];
    if (panelError) { onToast(panelError, 'error'); return; }
    setSaving(true);
    try {
      const payload = validateTemplateForSave({ name: targetName, description: asNew || !templateId ? (description || null) : (templateDescription || null), blocks });
      const result = asNew || !templateId ? await layoutTemplateApi.create(payload) : await layoutTemplateApi.update(templateId, payload);
      markTemplateSaved(result);
      setName('');
      setDescription('');
      setDialog(null);
      onToast(asNew || !templateId ? 'Đã tạo mẫu mới.' : 'Đã cập nhật mẫu.', 'success');
    } catch (error) {
      onToast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openSave = (asNew) => {
    setName(asNew ? '' : (templateName || ''));
    setDescription('');
    setDialog(asNew ? 'save-new' : 'save');
  };

  const load = async (template) => {
    if ((dirty || contentDirty) && !window.confirm('Mẫu hoặc nội dung bài hiện tại có thay đổi chưa lưu. Bạn vẫn muốn tải mẫu khác?')) return;
    setLoading(true);
    try {
      const fullTemplate = template.blocks ? template : await layoutTemplateApi.get(template.id);
      const skipped = loadTemplate(fullTemplate);
      setDialog(null);
      onToast(skipped.length ? `Đã tải mẫu; bỏ qua block chưa hỗ trợ: ${skipped.join(', ')}.` : 'Đã tải mẫu.', skipped.length ? 'warning' : 'success');
    } catch (error) {
      onToast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const duplicate = async (id) => {
    if ((dirty || contentDirty) && !window.confirm('Mẫu hoặc nội dung bài hiện tại có thay đổi chưa lưu. Tiếp tục nhân bản và tải mẫu khác?')) return;
    setLoading(true);
    try { const result = await layoutTemplateApi.duplicate(id); load(result); }
    catch (error) { onToast(errorMessage(error), 'error'); }
    finally { setLoading(false); }
  };

  const remove = async (item) => {
    if (!window.confirm(`Xóa mẫu “${item.name}”?`)) return;
    setLoading(true);
    try {
      await layoutTemplateApi.remove(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (templateId === item.id) clearCurrentTemplate();
      onToast('Đã xóa mẫu.', 'success');
    }
    catch (error) { onToast(errorMessage(error), 'error'); }
    finally { setLoading(false); }
  };

  const rename = async () => {
    if (!renameTemplate || !name.trim()) { onToast('Vui lòng nhập tên mẫu.', 'error'); return; }
    setSaving(true);
    try {
      const template = await layoutTemplateApi.get(renameTemplate.id);
      const result = await layoutTemplateApi.update(template.id, { ...template, name: name.trim() });
      setItems((current) => current.map((item) => item.id === result.id ? { ...item, name: result.name, updatedAt: result.updatedAt } : item));
      if (templateId === result.id) renameCurrentTemplate(result);
      setRenameTemplate(null);
      setDialog('load');
      onToast('Đã đổi tên mẫu.', 'success');
    } catch (error) { onToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  };

  return <>
    <div className="bp-template-toolbar">
      <div className="bp-template-current"><span className="bp-kicker">MẪU ĐANG MỞ</span><strong>{templateName || 'Chưa chọn mẫu'}</strong>{dirty && <span className="bp-dirty-state">Chưa lưu thay đổi</span>}</div>
      <div className="bp-template-actions">
        <button className="bp-secondary-button" type="button" title="Lưu mẫu: chỉ lưu khung/layout, không lưu nội dung bài" disabled={saving} onClick={() => templateId ? save(false) : openSave(false)}><Save size={14} />Lưu mẫu</button>
        <button className="bp-secondary-button" type="button" title="Lưu thành mẫu mới: tạo template mới từ khung hiện tại" disabled={saving} onClick={() => openSave(true)}><FilePlus2 size={14} />Lưu thành mẫu mới</button>
        <button className="bp-secondary-button" type="button" disabled={saving} onClick={() => { setPage(1); setDialog('load'); }}><Pencil size={14} />Tải mẫu</button>
      </div>
    </div>
    {dialog && <div className="bp-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialog(null); }}>
      <section className="bp-dialog" role="dialog" aria-modal="true" aria-label="Quản lý mẫu">
        <button className="bp-dialog-close" type="button" onClick={() => !saving && setDialog(null)}><X size={16} /></button>
        {(dialog === 'save' || dialog === 'save-new') && <>
          <span className="bp-kicker">TEMPLATE</span><h2>{dialog === 'save-new' ? 'Lưu thành mẫu mới' : 'Lưu mẫu'}</h2>
          <label className="bp-field">Tên mẫu<input autoFocus maxLength={150} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="bp-field">Mô tả<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <button className="bp-primary-button bp-dialog-submit" type="button" disabled={saving} onClick={() => save(dialog === 'save-new')}>{saving && <Loader2 size={14} className="bp-spin" />}Lưu mẫu</button>
        </>}
        {dialog === 'rename' && <>
          <span className="bp-kicker">TEMPLATE</span><h2>Đổi tên mẫu</h2>
          <label className="bp-field">Tên mẫu<input autoFocus maxLength={150} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <button className="bp-primary-button bp-dialog-submit" type="button" disabled={saving} onClick={rename}>{saving && <Loader2 size={14} className="bp-spin" />}Lưu tên</button>
        </>}
        {dialog === 'load' && <>
          <span className="bp-kicker">TEMPLATE LIBRARY</span><h2>Tải mẫu</h2>
          <div className="bp-template-search"><Search size={15} /><input autoFocus placeholder="Tìm theo tên mẫu..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="bp-template-list">{loading && <p className="bp-muted">Đang tải...</p>}{!loading && !items.length && <p className="bp-muted">Chưa có mẫu nào.</p>}{items.map((item) => <div className="bp-template-row" key={item.id}><button className="bp-template-row-main" type="button" onClick={() => load(item)}><strong>{item.name}</strong><small>{item.blockCount} block · {new Date(item.updatedAt).toLocaleDateString('vi-VN')}</small></button><button type="button" title="Đổi tên" onClick={() => { setRenameTemplate(item); setName(item.name); setDialog('rename'); }}><Pencil size={14} /></button><button type="button" title="Nhân bản" onClick={() => duplicate(item.id)}><Copy size={14} /></button><button type="button" title="Xóa" onClick={() => remove(item)}><Trash2 size={14} /></button></div>)}</div>
          <div className="bp-template-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} />Trước</button><span>Trang {page} / {totalPages}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Sau<ChevronRight size={15} /></button></div>
        </>}
      </section>
    </div>}
  </>;
}