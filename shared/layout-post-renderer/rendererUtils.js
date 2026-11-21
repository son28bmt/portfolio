export function getGridItemStyle(block) {
  return { gridColumn: `${block.x + 1} / span ${block.w}`, gridRow: `${block.y + 1} / span ${block.h}` };
}

export function orderMobileBlocks(layout = []) {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function isRenderableBlock(type) {
  return ['header', 'text', 'footer', 'question', 'checkbox', 'image', 'video'].includes(type);
}