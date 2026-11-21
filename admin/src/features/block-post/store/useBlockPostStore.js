import { create } from 'zustand';

const blockDefaults = {
  header: { w: 12, h: 3, props: { title: 'Tiêu đề bài viết' } },
  text: { w: 8, h: 6, props: { content: '<p>Bắt đầu viết nội dung tại đây...</p>' } },
  footer: { w: 12, h: 2, props: { text: 'Thông tin cuối bài' } },
};

const createBlock = (type, position = {}) => {
  const defaults = blockDefaults[type];
  const id = globalThis.crypto?.randomUUID?.() || `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    type,
    x: position.x ?? 0,
    y: position.y ?? 0,
    w: defaults.w,
    h: defaults.h,
    align: 'left',
    props: { ...defaults.props },
  };
};

/** History slots are reserved for a later undo/redo implementation. */
export const useBlockPostStore = create((set) => ({
  past: [],
  present: [],
  future: [],
  blocks: [],
  selectedBlockId: null,
  activeBlockId: null,
  pendingBlockType: null,

  addBlock: (type, position = {}) => set((state) => {
    const nextPosition = {
      ...position,
      y: position.y ?? (state.blocks.length
        ? Math.max(...state.blocks.map((item) => item.y + item.h)) + 1
        : 0),
    };
    const block = createBlock(type, nextPosition);
    return { blocks: [...state.blocks, block], selectedBlockId: block.id, pendingBlockType: null };
  }),
  updateBlock: (id, updates) => set((state) => ({
    blocks: state.blocks.map((block) => block.id === id
      ? { ...block, ...updates, props: updates.props ? { ...block.props, ...updates.props } : block.props }
      : block),
  })),
  updatePosition: (id, position) => set((state) => ({
    blocks: state.blocks.map((block) => block.id === id ? { ...block, ...position } : block),
  })),
  removeBlock: (id) => set((state) => ({
    blocks: state.blocks.filter((block) => block.id !== id),
    selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
  })),
  selectBlock: (id) => set({ selectedBlockId: id }),
  setActiveBlock: (id) => set({ activeBlockId: id }),
  setPendingBlockType: (type) => set({ pendingBlockType: type }),
}));