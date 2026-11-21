export const HISTORY_LIMIT = 50;

export function historySnapshot(state) {
  return { blocks: state.blocks, contentByBlockId: state.contentByBlockId };
}

function reconcileContent(targetBlocks, currentBlocks, currentContent, snapshotContent) {
  const currentIds = new Set(currentBlocks.map((block) => block.id));
  const targetContent = {};
  targetBlocks.forEach((block) => {
    if (currentIds.has(block.id) && currentContent[block.id] !== undefined) targetContent[block.id] = currentContent[block.id];
    else if (snapshotContent[block.id] !== undefined) targetContent[block.id] = snapshotContent[block.id];
  });
  return targetContent;
}

export function pushHistory(state, next) {
  return {
    ...next,
    past: [...state.past, historySnapshot(state)].slice(-HISTORY_LIMIT),
    present: next.blocks,
    future: [],
  };
}

export function undoState(state) {
  if (!state.past.length) return state;
  const previous = state.past[state.past.length - 1];
  const contentByBlockId = reconcileContent(previous.blocks, state.blocks, state.contentByBlockId, previous.contentByBlockId);
  return { ...state, blocks: previous.blocks, contentByBlockId, present: previous.blocks, past: state.past.slice(0, -1), future: [historySnapshot(state), ...state.future] };
}

export function redoState(state) {
  if (!state.future.length) return state;
  const next = state.future[0];
  const contentByBlockId = reconcileContent(next.blocks, state.blocks, state.contentByBlockId, next.contentByBlockId);
  return { ...state, blocks: next.blocks, contentByBlockId, present: next.blocks, past: [...state.past, historySnapshot(state)].slice(-HISTORY_LIMIT), future: state.future.slice(1) };
}