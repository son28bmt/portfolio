export function removeBlockState(state, id) {
  return {
    blocks: state.blocks.filter((block) => block.id !== id),
    contentByBlockId: Object.fromEntries(Object.entries(state.contentByBlockId).filter(([blockId]) => blockId !== id)),
    validationErrorsByBlockId: Object.fromEntries(Object.entries(state.validationErrorsByBlockId).filter(([blockId]) => blockId !== id)),
    selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
  };
}