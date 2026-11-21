export const GRID_COLS = 12;
export const ROW_HEIGHT = 36;
export const GRID_MARGIN_X = 12;
export const GRID_MARGIN_Y = 12;
export const GRID_PADDING = 8;

export const columnsToPercent = (columns) => Math.round((columns / GRID_COLS) * 100);
export const percentToColumns = (percent) => Math.max(1, Math.min(GRID_COLS, Math.round((Number(percent) / 100) * GRID_COLS)));
export const rowsToPixels = (rows) => Math.max(1, Math.round(rows * ROW_HEIGHT + Math.max(0, rows - 1) * GRID_MARGIN_Y));
export const pixelsToRows = (pixels) => Math.max(1, Math.round((Number(pixels) + GRID_MARGIN_Y) / (ROW_HEIGHT + GRID_MARGIN_Y)));
export const columnWidthPx = (canvasWidth) => Math.max(1, (canvasWidth - GRID_PADDING * 2 - GRID_MARGIN_X * (GRID_COLS - 1)) / GRID_COLS);
export const columnsToPixels = (columns, canvasWidth) => Math.round(columns * columnWidthPx(canvasWidth) + Math.max(0, columns - 1) * GRID_MARGIN_X);

export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const collidesWithOthers = (candidate, blocks, id) => blocks.some((block) => block.id !== id && overlaps(candidate, block));

export function findNearestPosition(candidate, blocks, id) {
  if (!collidesWithOthers(candidate, blocks, id)) return candidate;
  for (let radius = 0; radius < 300; radius += 1) {
    const positions = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      const dx = radius - Math.abs(dy);
      positions.push({ x: candidate.x - dx, y: candidate.y + dy });
      if (dx) positions.push({ x: candidate.x + dx, y: candidate.y + dy });
    }
    for (const position of positions) {
      const next = {
        ...candidate,
        x: Math.max(0, Math.min(GRID_COLS - candidate.w, position.x)),
        y: Math.max(0, position.y),
      };
      if (!collidesWithOthers(next, blocks, id)) return next;
    }
  }
  return candidate;
}

export function resolveBlockGeometry(block, blocks, geometry) {
  const w = Math.max(1, Math.min(GRID_COLS, Math.round(geometry.w ?? block.w)));
  const h = Math.max(1, Math.round(geometry.h ?? block.h));
  const candidate = {
    ...block,
    w,
    h,
    x: Math.max(0, Math.min(GRID_COLS - w, Math.round(geometry.x ?? block.x))),
    y: Math.max(0, Math.round(geometry.y ?? block.y)),
  };
  const resolved = findNearestPosition(candidate, blocks, block.id);
  return {
    block: resolved,
    adjusted: resolved.x !== candidate.x
      || resolved.y !== candidate.y
      || (geometry.w !== undefined && Number(geometry.w) !== candidate.w)
      || (geometry.h !== undefined && Number(geometry.h) !== candidate.h)
      || (geometry.x !== undefined && Number(geometry.x) !== candidate.x)
      || (geometry.y !== undefined && Number(geometry.y) !== candidate.y),
  };
}

export function normalizeBlockLayout(blocks = []) {
  const normalized = [];
  let adjusted = false;
  for (const block of blocks) {
    const resolved = resolveBlockGeometry(block, normalized, block);
    normalized.push(resolved.block);
    adjusted = adjusted || resolved.adjusted;
  }
  return { blocks: normalized, adjusted };
}

export function hasBlockContent(block, content) {
  if (!block) return false;
  if (block.type === 'image') return Boolean(String(content?.url || '').trim() || String(content?.alt || '').trim());
  if (block.type === 'video') return Boolean(String(content?.url || '').trim() || String(content?.poster || '').trim());
  if (block.type === 'question') return Boolean(String(content?.prompt || '').trim());
  if (block.type === 'checkbox') return (Array.isArray(content?.selections) ? content.selections : []).some((item) => item.checked);
  if (block.type === 'text') {
    const text = String(block.props?.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return text.length > 0;
  }
  if (block.type === 'header') return Boolean(String(block.props?.title || '').trim());
  if (block.type === 'footer') return Boolean(String(block.props?.text || '').trim());
  return false;
}