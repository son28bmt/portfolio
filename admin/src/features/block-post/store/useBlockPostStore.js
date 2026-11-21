import { create } from 'zustand';
import { resolveBlockGeometry } from '../utils/layout';
import { normalizeTemplateBlocks } from '../validation/layoutSchema';
import { defaultBlockContent, syncContentForBlock } from '../utils/blockContent';
import { syncCheckboxSelections } from '@layout-post-renderer/syncCheckboxSelections';
import { removeBlockState } from './blockPostState';
import { pushHistory, redoState, undoState } from './history';

const blockDefaults = {
  header: { w: 12, h: 3, props: { title: 'Tiêu đề bài viết' } },
  text: { w: 8, h: 6, props: { content: '<p></p>' } },
  footer: { w: 12, h: 2, props: { text: 'Thông tin cuối bài' } },
  question: { w: 8, h: 5, props: { heading: '' } },
  checkbox: { w: 6, h: 5, props: { options: ['Lựa chọn 1'], allowMultiple: true } },
  image: { w: 8, h: 7, props: { fit: 'cover', ratio: '16:9', borderRadius: 8 } },
  video: { w: 8, h: 7, props: { ratio: '16:9', autoplay: false, controls: true } },
};

const STORAGE_KEY = 'admin.layout-post.draft.v1';
const snapshotState = (blocks) => JSON.stringify(blocks);
const snapshotContent = (content) => JSON.stringify(content || {});
const loadDraft = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(value?.blocks) ? value.blocks : [];
  } catch {
    return [];
  }
};
const loadDraftContent = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return value?.contentByBlockId && typeof value.contentByBlockId === 'object' ? value.contentByBlockId : {};
  } catch { return {}; }
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
  blocks: loadDraft(),
  contentByBlockId: Object.fromEntries(loadDraft().map((block) => [block.id, syncContentForBlock(block, loadDraftContent()[block.id] || defaultBlockContent(block))])),
  savedContentSnapshot: snapshotContent(loadDraftContent()),
  validationErrorsByBlockId: {},
  selectedBlockId: null,
  activeBlockId: null,
  pendingBlockType: null,
  canvasWidth: 1200,
  templateId: null,
  templateName: '',
  templateDescription: '',
  postId: null,
  postTitle: '',
  postStatus: null,
  postUpdatedAt: null,
  savedSnapshot: snapshotState(loadDraft()),

  addBlock: (type, position = {}) => set((state) => {
    const nextPosition = {
      ...position,
      y: position.y ?? (state.blocks.length
        ? Math.max(...state.blocks.map((item) => item.y + item.h)) + 1
        : 0),
    };
    const block = createBlock(type, nextPosition);
    const resolved = resolveBlockGeometry(block, state.blocks, block);
    const content = defaultBlockContent(resolved.block);
    return pushHistory(state, { blocks: [...state.blocks, resolved.block], contentByBlockId: content ? { ...state.contentByBlockId, [block.id]: content } : state.contentByBlockId, selectedBlockId: block.id, pendingBlockType: null });
  }),
  updateBlock: (id, updates, { trackHistory = true } = {}) => set((state) => {
    const current = state.blocks.find((block) => block.id === id);
    if (!current) return {};
    const next = { ...current, ...updates, props: updates.props ? { ...current.props, ...updates.props } : current.props };
    const contentByBlockId = next.type === 'checkbox'
      ? { ...state.contentByBlockId, [id]: { kind: 'checkbox', selections: syncCheckboxSelections(next.props.options, state.contentByBlockId[id]?.selections, next.props.allowMultiple) } }
      : next.type === 'header' || next.type === 'footer'
        ? { ...state.contentByBlockId, [id]: syncContentForBlock(next, state.contentByBlockId[id]) }
      : state.contentByBlockId;
    const nextState = { blocks: state.blocks.map((block) => block.id === id ? next : block), contentByBlockId };
    return trackHistory ? pushHistory(state, nextState) : nextState;
  }),
  updateBlockContent: (id, content) => set((state) => {
    const block = state.blocks.find((item) => item.id === id);
    if (!block) return {};
    const contentByBlockId = { ...state.contentByBlockId, [id]: syncContentForBlock(block, content) };
    return { contentByBlockId };
  }),
  setBlockValidationError: (id, error) => set((state) => {
    const next = { ...state.validationErrorsByBlockId };
    if (error) next[id] = error;
    else delete next[id];
    return { validationErrorsByBlockId: next };
  }),
  updatePosition: (id, position) => set((state) => pushHistory(state, { blocks: state.blocks.map((block) => block.id === id ? { ...block, ...position } : block), contentByBlockId: state.contentByBlockId })),
  applyGridLayout: (layout) => set((state) => ({
    ...pushHistory(state, { blocks: state.blocks.map((block) => {
      const item = layout.find((entry) => entry.i === block.id);
      return item ? { ...block, x: item.x, y: item.y, w: item.w, h: item.h } : block;
    }), contentByBlockId: state.contentByBlockId }),
  })),
  setBlockGeometry: (id, geometry) => set((state) => {
    const block = state.blocks.find((item) => item.id === id);
    if (!block) return {};
    const resolved = resolveBlockGeometry(block, state.blocks, geometry).block;
    return pushHistory(state, { blocks: state.blocks.map((item) => item.id === id ? resolved : item), contentByBlockId: state.contentByBlockId });
  }),
  removeBlock: (id) => set((state) => pushHistory(state, removeBlockState(state, id))),
  undo: () => set(undoState),
  redo: () => set(redoState),
  duplicateBlock: (id) => set((state) => {
    const source = state.blocks.find((block) => block.id === id);
    if (!source) return state;
    const newId = globalThis.crypto?.randomUUID?.() || `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let clone = { ...source, id: newId, props: { ...source.props } };
    clone = resolveBlockGeometry(clone, state.blocks, { x: source.x, y: source.y + source.h + 1 }).block;
    return pushHistory(state, { blocks: [...state.blocks, clone], contentByBlockId: { ...state.contentByBlockId, [newId]: state.contentByBlockId[id] ? structuredClone(state.contentByBlockId[id]) : defaultBlockContent(clone) }, selectedBlockId: newId });
  }),
  selectBlock: (id) => set({ selectedBlockId: id }),
  setActiveBlock: (id) => set({ activeBlockId: id }),
  setPendingBlockType: (type) => set({ pendingBlockType: type }),
  setCanvasWidth: (canvasWidth) => set({ canvasWidth: Math.max(320, canvasWidth) }),
  loadTemplate: (template) => {
    const normalized = normalizeTemplateBlocks(template.blocks || []);
    const contentByBlockId = Object.fromEntries(normalized.blocks.map((block) => [block.id, defaultBlockContent(block)]));
    const snapshot = snapshotState(normalized.blocks);
    const contentSnapshot = snapshotContent(contentByBlockId);
    set({
      past: [],
      present: normalized.blocks,
      future: [],
      blocks: normalized.blocks,
      contentByBlockId,
      savedContentSnapshot: contentSnapshot,
      validationErrorsByBlockId: {},
      selectedBlockId: null,
      activeBlockId: null,
      pendingBlockType: null,
      templateId: template.id,
      templateName: template.name,
      templateDescription: template.description || '',
      savedSnapshot: snapshot,
      postId: null,
      postTitle: '',
      postStatus: null,
      postUpdatedAt: null,
    });
    return normalized.skipped;
  },
  markTemplateSaved: (template) => set((state) => ({
    templateId: template.id,
    templateName: template.name,
    templateDescription: template.description || state.templateDescription,
    savedSnapshot: snapshotState(state.blocks),
    past: [],
    present: state.blocks,
    future: [],
  })),
  loadPost: (post) => {
    const normalized = normalizeTemplateBlocks(post.layout || []);
    const contentByBlockId = Object.fromEntries(normalized.blocks.map((block) => {
      const loaded = post.content?.[block.id] || defaultBlockContent(block);
      return [block.id, syncContentForBlock(block, loaded)];
    }));
    const blocks = normalized.blocks.map((block) => block.type === 'text'
      ? { ...block, props: { ...block.props, content: contentByBlockId[block.id]?.html || block.props.content || '' } }
      : block);
    const snapshot = snapshotState(blocks);
    set({
      past: [], present: blocks, future: [], blocks, contentByBlockId,
      savedContentSnapshot: snapshotContent(contentByBlockId), validationErrorsByBlockId: {},
      selectedBlockId: null, activeBlockId: null, pendingBlockType: null,
      templateId: post.templateId || null, templateName: '',
      savedSnapshot: snapshot, postId: post.id, postTitle: post.title,
      postStatus: post.status, postUpdatedAt: post.updatedAt,
    });
    return normalized.skipped;
  },
  markPostSaved: (post) => set((state) => ({
    postId: post.id, postTitle: post.title, postStatus: post.status, postUpdatedAt: post.updatedAt,
    savedSnapshot: snapshotState(state.blocks), savedContentSnapshot: snapshotContent(state.contentByBlockId),
    past: [], present: state.blocks, future: [],
  })),
  renameCurrentTemplate: (template) => set({
    templateId: template.id,
    templateName: template.name,
    templateDescription: template.description || '',
  }),
  clearCurrentTemplate: () => set({ templateId: null, templateName: '', templateDescription: '', savedSnapshot: snapshotState([], {}) }),
}));

export const selectBlockPostDirty = (state) => snapshotState(state.blocks) !== state.savedSnapshot;
export const selectBlockContentDirty = (state) => snapshotContent(state.contentByBlockId) !== state.savedContentSnapshot;

export const BLOCK_POST_STORAGE_KEY = STORAGE_KEY;