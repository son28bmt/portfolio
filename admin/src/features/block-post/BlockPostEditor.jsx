import { useCallback, useEffect, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CircleHelp, Copy, Eye, Redo2, Save, Trash2, Undo2, Upload } from 'lucide-react';
import BlockPalette from './components/BlockPalette';
import GridCanvas from './components/GridCanvas';
import TemplateToolbar from './components/TemplateToolbar';
import BlockSpecificProperties from './components/BlockSpecificProperties';
import { layoutPostApi } from './api/layoutPostApi';
import { validateLayoutPostForSave } from './validation/layoutSchema';
import { BLOCK_POST_STORAGE_KEY, selectBlockContentDirty, selectBlockPostDirty, useBlockPostStore } from './store/useBlockPostStore';
import { blockRegistry } from './registry/blockRegistry';
import { columnWidthPx, columnsToPercent, columnsToPixels, hasBlockContent, GRID_COLS, pixelsToRows, rowsToPixels, resolveBlockGeometry } from './utils/layout';

function PropertiesPanel() {
  const [widthUnit, setWidthUnit] = useState('%');
  const [heightUnit, setHeightUnit] = useState('px');
  const [notice, setNotice] = useState('');
  const selectedBlockId = useBlockPostStore((state) => state.selectedBlockId);
  const blocks = useBlockPostStore((state) => state.blocks);
  const block = blocks.find((item) => item.id === selectedBlockId);
  const canvasWidth = useBlockPostStore((state) => state.canvasWidth);
  const contentByBlockId = useBlockPostStore((state) => state.contentByBlockId);
  const updateBlock = useBlockPostStore((state) => state.updateBlock);
  const setBlockGeometry = useBlockPostStore((state) => state.setBlockGeometry);
  const removeBlock = useBlockPostStore((state) => state.removeBlock);
  const duplicateBlock = useBlockPostStore((state) => state.duplicateBlock);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const applyGeometry = (geometry) => {
    const { adjusted } = resolveBlockGeometry(block, blocks, geometry);
    setBlockGeometry(block.id, geometry);
    if (adjusted) setNotice('Đã điều chỉnh về vị trí hợp lệ, không chồng block.');
  };

  const deleteSelected = () => {
    if (hasBlockContent(block, contentByBlockId[block.id]) && !window.confirm('Block này đang có nội dung. Bạn chắc chắn muốn xóa?')) return;
    removeBlock(block.id);
  };

  if (!block) return <section className="bp-panel bp-properties-empty"><span className="bp-empty-icon"><CircleHelp size={20} /></span><h2>Chưa chọn khu vực</h2><p>Chọn một block trên canvas để xem và chỉnh thuộc tính.</p><div className="bp-key-hint"><span>12</span> cột khả dụng</div></section>;

  const widthValue = widthUnit === '%'
    ? columnsToPercent(block.w)
    : columnsToPixels(block.w, canvasWidth);
  const heightValue = heightUnit === 'px' ? rowsToPixels(block.h) : block.h;

  return (
    <section className="bp-panel bp-properties">
      <div className="bp-panel-heading"><div><span className="bp-kicker">THUỘC TÍNH</span><h2>Khu vực đang chọn</h2></div><div className="bp-panel-actions"><button type="button" title="Nhân bản block" onClick={() => duplicateBlock(block.id)}><Copy size={15} /></button><button className="bp-delete-selected" type="button" title="Xóa block" onClick={deleteSelected}><Trash2 size={15} /></button></div></div>
      <label className="bp-field">Loại block<select value={block.type} onChange={(event) => updateBlock(block.id, { type: event.target.value })}>{Object.entries(blockRegistry).map(([type, item]) => <option key={type} value={type}>{item.label}</option>)}</select></label>
      <div className="bp-field-pair">
        <label className="bp-field">Rộng<div className="bp-measure-input"><input type="number" min="1" max={widthUnit === '%' ? 100 : canvasWidth} value={widthValue} onChange={(event) => {
          const raw = Number(event.target.value);
          if (!Number.isFinite(raw) || raw < 0) { setNotice('Giá trị âm/không hợp lệ đã được chặn.'); return; }
          const w = widthUnit === '%' ? Math.round((raw / 100) * GRID_COLS) : Math.round((raw + 12) / (columnWidthPx(canvasWidth) + 12));
          applyGeometry({ w, x: Math.min(block.x, GRID_COLS - Math.max(1, Math.min(GRID_COLS, w))) });
        }} /><select aria-label="Đơn vị độ rộng" value={widthUnit} onChange={(event) => setWidthUnit(event.target.value)}><option value="%">%</option><option value="px">px</option></select></div></label>
        <label className="bp-field">Cao<div className="bp-measure-input"><input type="number" min="1" value={heightValue} onChange={(event) => {
          const raw = Number(event.target.value);
          if (!Number.isFinite(raw) || raw < 0) { setNotice('Giá trị âm/không hợp lệ đã được chặn.'); return; }
          const h = heightUnit === 'px' ? pixelsToRows(raw) : Math.max(1, Math.round(raw));
          applyGeometry({ h });
        }} /><select aria-label="Đơn vị chiều cao" value={heightUnit} onChange={(event) => setHeightUnit(event.target.value)}><option value="px">px</option><option value="row">hàng</option></select></div></label>
      </div>
      <div className="bp-field-pair">
        <label className="bp-field">Cột X<input type="number" min="0" max={GRID_COLS - block.w} value={block.x} onChange={(event) => {
          const x = Number(event.target.value);
          if (!Number.isFinite(x) || x < 0) { setNotice('Vị trí không được nhỏ hơn 0.'); return; }
          applyGeometry({ x });
        }} /></label>
        <label className="bp-field">Hàng Y<input type="number" min="0" value={block.y} onChange={(event) => {
          const y = Number(event.target.value);
          if (!Number.isFinite(y) || y < 0) { setNotice('Vị trí không được nhỏ hơn 0.'); return; }
          applyGeometry({ y });
        }} /></label>
      </div>
      <div className="bp-field"><span className="bp-field-label">Căn lề</span><div className="bp-align-control">{['left', 'center', 'right'].map((align) => <button key={align} className={block.align === align ? 'is-active' : ''} type="button" aria-label={`Căn ${align}`} onClick={() => updateBlock(block.id, { align })}>{align === 'left' ? 'Trái' : align === 'center' ? 'Giữa' : 'Phải'}</button>)}</div></div>
      {block.type === 'header' && <label className="bp-field">Nội dung Header<textarea rows={5} value={block.props.title || ''} onChange={(event) => updateBlock(block.id, { props: { title: event.target.value } })} placeholder="Nhập tiêu đề hoặc đoạn mở đầu" /></label>}
      {block.type === 'footer' && <label className="bp-field">Nội dung Footer<textarea rows={5} value={block.props.text || ''} onChange={(event) => updateBlock(block.id, { props: { text: event.target.value } })} placeholder="Nhập kết bài hoặc ghi chú" /></label>}
      <BlockSpecificProperties block={block} updateBlock={updateBlock} onNotice={setNotice} />
      <div className="bp-properties-divider" />
      <div className="bp-size-readout"><span>KÍCH THƯỚC HIỆN TẠI</span><strong>{columnsToPercent(block.w)}% <i>·</i> {columnsToPixels(block.w, canvasWidth)}px <i>×</i> {rowsToPixels(block.h)}px</strong></div>
      {notice && <div className="bp-inline-notice" role="status">{notice}</div>}
    </section>
  );
}

export default function BlockPostEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const templateDirty = useBlockPostStore(selectBlockPostDirty);
  const contentDirty = useBlockPostStore(selectBlockContentDirty);
  const blocker = useBlocker(templateDirty || contentDirty);
  const addBlock = useBlockPostStore((state) => state.addBlock);
  const setPendingBlockType = useBlockPostStore((state) => state.setPendingBlockType);
  const blocks = useBlockPostStore((state) => state.blocks);
  const contentByBlockId = useBlockPostStore((state) => state.contentByBlockId);
  const postId = useBlockPostStore((state) => state.postId);
  const postTitle = useBlockPostStore((state) => state.postTitle);
  const postStatus = useBlockPostStore((state) => state.postStatus);
  const postUpdatedAt = useBlockPostStore((state) => state.postUpdatedAt);
  const storedPublishTarget = useBlockPostStore((state) => state.publishTarget);
  const markPostSaved = useBlockPostStore((state) => state.markPostSaved);
  const loadPost = useBlockPostStore((state) => state.loadPost);
  const [title, setTitle] = useState(postTitle || '');
  const [publishTarget, setPublishTarget] = useState(storedPublishTarget || 'blog');
  const [postSaving, setPostSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const savedSnapshot = useBlockPostStore((state) => state.savedSnapshot);
  const selectedBlockId = useBlockPostStore((state) => state.selectedBlockId);
  const removeBlock = useBlockPostStore((state) => state.removeBlock);
  const undo = useBlockPostStore((state) => state.undo);
  const redo = useBlockPostStore((state) => state.redo);
  const pastLength = useBlockPostStore((state) => state.past.length);
  const futureLength = useBlockPostStore((state) => state.future.length);
  const [toast, setToast] = useState(null);
  const [previewNotice, setPreviewNotice] = useState(false);

  const onToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (selectBlockPostDirty(useBlockPostStore.getState()) || selectBlockContentDirty(useBlockPostStore.getState())) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    const isTypingTarget = (target) => target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.closest?.('.ProseMirror');
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  useEffect(() => {
    const isTypingTarget = (target) => target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.closest?.('.ProseMirror');
    const onKeyDown = (event) => {
      if (!selectedBlockId || isTypingTarget(event.target) || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
      event.preventDefault();
      const block = useBlockPostStore.getState().blocks.find((item) => item.id === selectedBlockId);
      if (hasBlockContent(block, useBlockPostStore.getState().contentByBlockId[selectedBlockId]) && !window.confirm('Block này đang có nội dung. Bạn chắc chắn muốn xóa?')) return;
      removeBlock(selectedBlockId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeBlock, selectedBlockId]);

  useEffect(() => { if (postTitle) setTitle(postTitle); }, [postTitle]);
  useEffect(() => { setPublishTarget(storedPublishTarget || 'blog'); }, [storedPublishTarget]);
  useEffect(() => { if (!id) useBlockPostStore.setState({ postId: null, postTitle: '', postStatus: null, postUpdatedAt: null }); }, [id]);
  useEffect(() => {
    if (!id) return;
    layoutPostApi.get(id).then((post) => { loadPost(post); setTitle(post.title); }).catch((error) => onToast(error.response?.data?.message || error.message, 'error'));
  }, [id, loadPost, onToast]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Có thay đổi chưa lưu. Bạn có chắc muốn rời trang?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const saveDraft = () => {
    localStorage.setItem(BLOCK_POST_STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), blocks, contentByBlockId: useBlockPostStore.getState().contentByBlockId }));
    useBlockPostStore.setState((state) => ({ savedContentSnapshot: JSON.stringify(state.contentByBlockId) }));
    window.dispatchEvent(new CustomEvent('block-post-draft-saved'));
  };

  const openPreview = () => {
    if (!postId) { onToast('Hãy lưu bài trước khi mở preview.', 'error'); return; }
    if (templateDirty || contentDirty) {
      setPreviewNotice(true);
      return;
    }
    window.open(`/layout-posts/${postId}/preview`, '_blank', 'noopener,noreferrer');
  };

  const savePost = async (publish = false) => {
    if (postSaving) return;
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > 200) { onToast('Tiêu đề bắt buộc và tối đa 200 ký tự.', 'error'); return; }
    const payload = { title: cleanTitle, templateId: useBlockPostStore.getState().templateId || null, layout: blocks.map((block) => ({ ...block, props: { ...block.props } })), content: contentByBlockId, status: publish ? 'published' : 'draft', publishTarget, updatedAt: postUpdatedAt };
    let validated;
    try { validated = validateLayoutPostForSave(payload); }
    catch (error) { onToast(error.message, 'error'); return; }
    setPostSaving(true);
    try {
      let saved;
      if (!postId) saved = await layoutPostApi.create(validated);
      else if (publish) saved = await layoutPostApi.publish(postId, postUpdatedAt, validated);
      else saved = await layoutPostApi.update(postId, validated);
      markPostSaved(saved); setTitle(saved.title); setPublishTarget(saved.publishTarget || publishTarget); setConflict(false);
      onToast(publish ? 'Đã đăng bài.' : 'Đã lưu nháp.', 'success');
    } catch (error) {
      if (error.response?.status === 409) { setConflict(true); onToast('Bài đã được sửa ở nơi khác. Hãy tải lại trước khi tiếp tục.', 'error'); }
      else onToast(error.response?.data?.message || error.message, 'error');
    } finally { setPostSaving(false); }
  };

  const reloadConflict = async () => {
    if (!postId) return;
    try { const post = await layoutPostApi.get(postId); loadPost(post); setTitle(post.title); setPublishTarget(post.publishTarget || 'blog'); setConflict(false); onToast('Đã tải lại phiên bản mới nhất.', 'success'); }
    catch (error) { onToast(error.response?.data?.message || error.message, 'error'); }
  };

  const unpublishPost = async () => {
    if (!postId || !postUpdatedAt) return;
    setPostSaving(true);
    try { const saved = await layoutPostApi.unpublish(postId, postUpdatedAt); markPostSaved(saved); onToast('Đã chuyển bài về nháp.', 'success'); }
    catch (error) { onToast(error.response?.data?.message || error.message, 'error'); }
    finally { setPostSaving(false); }
  };

  return (
    <div className="bp-editor">
      <header className="bp-topbar">
        <div className="bp-topbar-title"><button type="button" className="bp-icon-button" title="Quay lại" onClick={() => navigate('/layout-posts')}><ArrowLeft size={17} /></button><div><span className="bp-kicker">CMS / GRIDBOX</span><h1>{postId ? 'Chỉnh sửa bài' : 'Đăng bài mới'}</h1></div></div>
        <div className="bp-topbar-actions"><button className="bp-secondary-button" type="button" title="Hoàn tác" disabled={!pastLength} onClick={undo}><Undo2 size={15} />Hoàn tác</button><button className="bp-secondary-button" type="button" title="Làm lại" disabled={!futureLength} onClick={redo}><Redo2 size={15} />Làm lại</button><span className="bp-save-state"><span className="bp-status-dot" />{postStatus === 'published' ? 'Đã đăng' : postId ? 'Nháp' : 'Chưa lưu'}</span><button className="bp-secondary-button" type="button" title="Xem trước bài viết" onClick={openPreview}><Eye size={15} />Xem trước</button><button className="bp-secondary-button" type="button" title="Lưu bài: lưu snapshot layout và toàn bộ content theo block" disabled={postSaving} onClick={() => savePost(false)}><Save size={15} />Lưu nháp</button>{postStatus === 'published' && <button className="bp-secondary-button" type="button" title="Chuyển bài đã đăng về nháp" disabled={postSaving} onClick={unpublishPost}>Hủy đăng</button>}<button className="bp-primary-button" type="button" title="Đăng bài: validate chặt và chuyển sang published" disabled={postSaving} onClick={() => savePost(true)}><Upload size={15} />Đăng</button></div>
      </header>
      <div className="bp-post-meta"><label>Tiêu đề bài viết<input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tiêu đề bài viết" /></label><label>Nơi đăng<select value={publishTarget} disabled={postStatus === 'published'} onChange={(event) => setPublishTarget(event.target.value)}><option value="blog">Blog</option><option value="guide">Hướng dẫn</option></select></label><span>{templateDirty || contentDirty ? <b className="bp-dirty-state">Chưa lưu thay đổi</b> : postUpdatedAt ? `Cập nhật ${new Date(postUpdatedAt).toLocaleString('vi-VN')}` : 'Bản nháp mới'}</span>{conflict && <button className="bp-conflict-button" onClick={reloadConflict}><AlertTriangle size={14} />Tải lại phiên bản mới</button>}</div>
      {previewNotice && <div className="bp-preview-notice" role="status">Đang xem bản đã lưu, thay đổi chưa lưu không có trong bản xem trước <button type="button" onClick={() => savePost(false).then(() => { setPreviewNotice(false); window.open(`/layout-posts/${postId}/preview`, '_blank', 'noopener,noreferrer'); })}>Lưu nháp</button></div>}
      <TemplateToolbar onToast={onToast} />
      <div className="bp-workspace">
        <BlockPalette onAdd={(type) => { setPendingBlockType(type); addBlock(type); }} />
        <GridCanvas />
        <PropertiesPanel />
      </div>
      {toast && <div className={`bp-toast bp-toast-${toast.type}`} role="status">{toast.message}</div>}
    </div>
  );
}