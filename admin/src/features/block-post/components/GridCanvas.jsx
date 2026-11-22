import { useCallback, useEffect, useMemo, useState } from 'react';
import GridLayout, { noCompactor, useContainerWidth } from 'react-grid-layout';
import { Copy, Grip, Trash2 } from 'lucide-react';
import { useBlockPostStore } from '../store/useBlockPostStore';
import { blockRegistry } from '../registry/blockRegistry';
import { ROW_HEIGHT } from '@layout-post-renderer/constants';
import { hasBlockContent } from '../utils/layout';
import { layoutPostApi } from '../api/layoutPostApi';

const gridConfig = { cols: 12, rowHeight: ROW_HEIGHT, margin: [12, 12], containerPadding: [8, 8], maxRows: 200 };
const initialLayout = [
  { i: 'demo-header', x: 0, y: 0, w: 12, h: 3 },
  { i: 'demo-text', x: 0, y: 4, w: 8, h: 8 },
  { i: 'demo-footer', x: 0, y: 13, w: 12, h: 2 },
];

export default function GridCanvas() {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const blocks = useBlockPostStore((state) => state.blocks);
  const selectedBlockId = useBlockPostStore((state) => state.selectedBlockId);
  const activeBlockId = useBlockPostStore((state) => state.activeBlockId);
  const contentByBlockId = useBlockPostStore((state) => state.contentByBlockId);
  const pendingBlockType = useBlockPostStore((state) => state.pendingBlockType);
  const templateBlocks = useBlockPostStore((state) => state.blocks);
  const addBlock = useBlockPostStore((state) => state.addBlock);
  const updateBlock = useBlockPostStore((state) => state.updateBlock);
  const applyGridLayout = useBlockPostStore((state) => state.applyGridLayout);
  const setCanvasWidth = useBlockPostStore((state) => state.setCanvasWidth);
  const removeBlock = useBlockPostStore((state) => state.removeBlock);
  const duplicateBlock = useBlockPostStore((state) => state.duplicateBlock);
  const selectBlock = useBlockPostStore((state) => state.selectBlock);
  const setActiveBlock = useBlockPostStore((state) => state.setActiveBlock);
  const [questionTemplates, setQuestionTemplates] = useState([]);

  useEffect(() => {
    if (!blocks.some((block) => block.type === 'question')) return;
    layoutPostApi.questionTemplates().then((data) => {
      if (Array.isArray(data)) setQuestionTemplates(data);
      else if (Array.isArray(data?.items)) setQuestionTemplates(data.items);
      else if (typeof data === 'string') { try { const parsed = JSON.parse(data); setQuestionTemplates(Array.isArray(parsed) ? parsed : []); } catch { setQuestionTemplates([]); } }
      else setQuestionTemplates([]);
    }).catch(() => setQuestionTemplates([]));
  }, [blocks]);

  const layout = useMemo(() => blocks.length
    ? blocks.map(({ id, x, y, w, h }) => ({ i: id, x, y, w, h, minW: 2, minH: 2 }))
    : initialLayout, [blocks]);

  useEffect(() => {
    if (mounted) setCanvasWidth(width);
  }, [mounted, setCanvasWidth, width]);

  const commitLayout = useCallback((nextLayout) => {
    if (blocks.length) applyGridLayout(nextLayout);
  }, [applyGridLayout, blocks.length]);

  const handleDrop = useCallback((_, item, event) => {
    const type = event.dataTransfer?.getData('application/x-block-post-type')
      || event.dataTransfer?.getData('text/plain')
      || pendingBlockType;
    if (!type || !blockRegistry[type] || !item) return;
    addBlock(type, { x: item.x, y: item.y });
  }, [addBlock, pendingBlockType]);

  const dropConfig = useMemo(() => ({
    enabled: true,
    defaultItem: { w: 8, h: 6 },
    touchEnabled: true,
    onDragOver: () => {
      if (pendingBlockType === 'header') return { w: 12, h: 3 };
      if (pendingBlockType === 'footer') return { w: 12, h: 2 };
      return { w: 8, h: 6 };
    },
  }), [pendingBlockType]);

  const onDragStop = useCallback((nextLayout, oldItem, newItem) => {
    commitLayout(nextLayout);
    setActiveBlock(null);
    if (newItem && templateBlocks.some((block) => block.id === newItem.i)) selectBlock(newItem.i);
  }, [commitLayout, selectBlock, setActiveBlock, templateBlocks]);
  const onResizeStop = useCallback((nextLayout, oldItem, newItem) => {
    commitLayout(nextLayout);
    setActiveBlock(null);
    if (newItem && templateBlocks.some((block) => block.id === newItem.i)) selectBlock(newItem.i);
  }, [commitLayout, selectBlock, setActiveBlock, templateBlocks]);

  const children = blocks.length ? blocks.map((block) => {
    const definition = blockRegistry[block.type];
    const BlockComponent = definition.component;
    return (
      <div key={block.id} className={`bp-grid-item ${selectedBlockId === block.id ? 'is-selected' : ''} ${activeBlockId === block.id ? 'is-active' : ''}`} onMouseDown={() => selectBlock(block.id)}>
        <div className="bp-block-shell">
          <div className="bp-block-toolbar">
            <div className="bp-drag-handle" role="button" tabIndex={0} aria-label="Di chuyển block"><Grip size={15} /><span>{definition.label}</span></div>
            <div className="bp-block-actions">
              <span className="bp-size-label">W:{block.w} · H:{block.h}</span>
              <button type="button" title="Nhân bản block" onClick={() => {
                duplicateBlock(block.id);
              }}><Copy size={13} /></button>
              <button type="button" title="Xóa block" onClick={() => {
                const hasText = hasBlockContent(block, contentByBlockId[block.id]);
                if (hasText && !window.confirm('Block này đang có nội dung. Bạn chắc chắn muốn xóa?')) return;
                removeBlock(block.id);
              }}><Trash2 size={14} /></button>
            </div>
          </div>
          <div className={`bp-block-content bp-block-content-${block.type}`} style={{ textAlign: block.align }}>
            <BlockComponent block={block} align={block.align} content={contentByBlockId[block.id]} template={questionTemplates.find((item) => item.id === block.props?.templateId)} onContentChange={(content) => useBlockPostStore.getState().updateBlockContent(block.id, content)} editable onChange={(props) => updateBlock(block.id, { props }, { trackHistory: block.type !== 'text' })} />
          </div>
          {activeBlockId === block.id && <div className="bp-size-tooltip">W: {block.w} cột · H: {block.h} hàng</div>}
        </div>
      </div>
    );
  }) : initialLayout.map((item, index) => {
    const type = ['header', 'text', 'footer'][index];
    const definition = blockRegistry[type];
    const BlockComponent = definition.component;
    const props = type === 'header' ? { title: 'Tiêu đề và phần mở đầu' } : type === 'text' ? { content: '<p>Kéo block từ kho công cụ để bắt đầu chỉnh sửa nội dung.</p>' } : { text: 'Kết bài và ghi chú' };
    const sample = { id: item.i, type, align: 'left', props };
    return <div key={item.i} className="bp-grid-item bp-demo-item"><div className="bp-block-shell"><div className="bp-block-toolbar"><span className="bp-drag-handle"><Grip size={15} /><span>{definition.label}</span></span><span className="bp-demo-badge">MẪU</span></div><div className="bp-block-content"><BlockComponent block={sample} editable={false} onChange={() => {}} /></div></div></div>;
  });

  return (
    <section className="bp-canvas-panel">
      <div className="bp-canvas-heading">
        <div><span className="bp-kicker">BỐ CỤC BÀI VIẾT</span><h2>Gridbox Canvas</h2></div>
        <span className="bp-grid-badge"><span className="bp-status-dot" />12 CỘT</span>
      </div>
      <div
        className="bp-canvas-viewport"
        ref={containerRef}
        onMouseDown={(event) => { if (!event.target.closest('.bp-grid-item')) selectBlock(null); }}
      >
        {mounted && (
          <GridLayout
            width={width}
            layout={layout}
            gridConfig={gridConfig}
            dragConfig={{ enabled: true, bounded: false, handle: '.bp-drag-handle', cancel: '.bp-block-content, .bp-block-content *, button, input, textarea, .ProseMirror, .ProseMirror *', allowMobileScroll: true }}
            resizeConfig={{ enabled: true, handles: ['se', 'e', 's'] }}
            dropConfig={dropConfig}
            droppingItem={{ i: '__new-block__', x: 0, y: 0, w: 8, h: 6 }}
            compactor={{ ...noCompactor, preventCollision: true }}
            onDragStart={(next, oldItem, newItem) => newItem && setActiveBlock(newItem.i)}
            onDragStop={onDragStop}
            onResizeStart={(next, oldItem, newItem) => newItem && setActiveBlock(newItem.i)}
            onResizeStop={onResizeStop}
            onDrop={(nextLayout, item, event) => handleDrop(nextLayout, item, event)}
            className="bp-grid-layout"
          >
            {children}
          </GridLayout>
        )}
        {blocks.length === 0 && <button className="bp-canvas-hint" type="button" onClick={() => { addBlock('header', { x: 0, y: 0 }); addBlock('text', { x: 0, y: 4 }); addBlock('footer', { x: 0, y: 13 }); }}>Dùng bố cục mẫu <span>Thêm Header, Text và Footer</span></button>}
      </div>
      <div className="bp-canvas-foot"><span>Kéo block bằng tay nắm · thay đổi kích thước ở cạnh hoặc góc dưới phải</span><span>{blocks.length} block{blocks.length === 1 ? '' : 's'}</span></div>
    </section>
  );
}