import { blockRegistry } from '../registry/blockRegistry';
import { useBlockPostStore } from '../store/useBlockPostStore';

export default function BlockPalette({ onAdd }) {
  return (
    <section className="bp-panel bp-palette">
      <div className="bp-panel-heading">
        <div><span className="bp-kicker">THÀNH PHẦN</span><h2>Kho công cụ</h2></div>
        <span className="bp-count">07</span>
      </div>
      <p className="bp-muted">Kéo một block vào canvas để bắt đầu.</p>
      <div className="bp-palette-list">
        {Object.entries(blockRegistry).map(([type, definition]) => {
          const Icon = definition.icon;
          return (
            <button
              className="bp-tool"
              key={type}
              type="button"
              draggable
              data-rgl-draggable="true"
              onDragStart={(event) => {
                useBlockPostStore.getState().setPendingBlockType(type);
                event.dataTransfer.setData('application/x-block-post-type', type);
                event.dataTransfer.setData('text/plain', type);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onAdd(type)}
              aria-label={`Thêm ${definition.label}`}
            >
              <span className="bp-tool-icon"><Icon size={18} /></span>
              <span className="bp-tool-copy"><strong>{definition.label}</strong><small>{definition.description}</small></span>
              <span className="bp-tool-plus">+</span>
            </button>
          );
        })}
      </div>
      <div className="bp-palette-note"><span className="bp-status-dot" /> Lưới 12 cột · tự căn chỉnh</div>
    </section>
  );
}