import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, CircleHelp, Eye, Save } from 'lucide-react';
import BlockPalette from './components/BlockPalette';
import GridCanvas from './components/GridCanvas';
import { useBlockPostStore } from './store/useBlockPostStore';
import { blockRegistry } from './registry/blockRegistry';

function PropertiesPanel() {
  const selectedBlockId = useBlockPostStore((state) => state.selectedBlockId);
  const block = useBlockPostStore((state) => state.blocks.find((item) => item.id === selectedBlockId));
  const updateBlock = useBlockPostStore((state) => state.updateBlock);

  if (!block) return <section className="bp-panel bp-properties-empty"><span className="bp-empty-icon"><CircleHelp size={20} /></span><h2>Khu vực đang chọn</h2><p>Chọn một block trên canvas để xem thuộc tính.</p><div className="bp-key-hint"><span>12</span> cột khả dụng</div></section>;

  return (
    <section className="bp-panel bp-properties">
      <div className="bp-panel-heading"><div><span className="bp-kicker">THUỘC TÍNH</span><h2>Khu vực đang chọn</h2></div><span className="bp-selected-mark"><Check size={13} /></span></div>
      <label className="bp-field">Loại block<select value={block.type} onChange={(event) => updateBlock(block.id, { type: event.target.value })}>{Object.entries(blockRegistry).map(([type, item]) => <option key={type} value={type}>{item.label}</option>)}</select></label>
      <div className="bp-field-pair">
        <label className="bp-field">Rộng <span>cột</span><input type="number" min="2" max="12" value={block.w} onChange={(event) => updateBlock(block.id, { w: Math.min(12, Math.max(2, Number(event.target.value) || 2)) })} /></label>
        <label className="bp-field">Cao <span>hàng</span><input type="number" min="2" value={block.h} onChange={(event) => updateBlock(block.id, { h: Math.max(2, Number(event.target.value) || 2) })} /></label>
      </div>
      <div className="bp-field-pair">
        <label className="bp-field">Cột X<input type="number" min="0" max={12 - block.w} value={block.x} onChange={(event) => updateBlock(block.id, { x: Math.max(0, Math.min(12 - block.w, Number(event.target.value) || 0)) })} /></label>
        <label className="bp-field">Hàng Y<input type="number" min="0" value={block.y} onChange={(event) => updateBlock(block.id, { y: Math.max(0, Number(event.target.value) || 0) })} /></label>
      </div>
      <div className="bp-field"><span className="bp-field-label">Căn lề</span><div className="bp-align-control">{['left', 'center', 'right'].map((align) => <button key={align} className={block.align === align ? 'is-active' : ''} type="button" aria-label={`Căn ${align}`} onClick={() => updateBlock(block.id, { align })}>{align === 'left' ? 'Trái' : align === 'center' ? 'Giữa' : 'Phải'}</button>)}</div></div>
      {block.type === 'header' && <label className="bp-field">Tiêu đề<input value={block.props.title || ''} onChange={(event) => updateBlock(block.id, { props: { title: event.target.value } })} /></label>}
      {block.type === 'footer' && <label className="bp-field">Nội dung<input value={block.props.text || ''} onChange={(event) => updateBlock(block.id, { props: { text: event.target.value } })} /></label>}
      <div className="bp-properties-divider" />
      <div className="bp-size-readout"><span>KÍCH THƯỚC HIỆN TẠI</span><strong>{Math.round((block.w / 12) * 100)}% <i>×</i> {block.h} hàng</strong></div>
    </section>
  );
}

export default function BlockPostEditor() {
  const navigate = useNavigate();
  const addBlock = useBlockPostStore((state) => state.addBlock);
  const setPendingBlockType = useBlockPostStore((state) => state.setPendingBlockType);

  return (
    <div className="bp-editor">
      <header className="bp-topbar">
        <div className="bp-topbar-title"><button type="button" className="bp-icon-button" title="Quay lại" onClick={() => navigate(-1)}><ArrowLeft size={17} /></button><div><span className="bp-kicker">CMS / BÀI VIẾT</span><h1>Đăng bài mới</h1></div></div>
        <div className="bp-topbar-actions"><span className="bp-save-state"><span className="bp-status-dot" />Đã lưu cục bộ</span><button className="bp-secondary-button" type="button"><Eye size={15} />Xem trước</button><button className="bp-primary-button" type="button"><Save size={15} />Lưu bài</button></div>
      </header>
      <div className="bp-workspace">
        <BlockPalette onAdd={(type) => { setPendingBlockType(type); addBlock(type); }} />
        <GridCanvas />
        <PropertiesPanel />
      </div>
    </div>
  );
}