import { syncCheckboxSelections } from '@layout-post-renderer/syncCheckboxSelections';

export const defaultBlockContent = (block) => {
  if (block.type === 'header') return { kind: 'richText', html: block.props?.title || '' };
  if (block.type === 'footer') return { kind: 'richText', html: block.props?.text || '' };
  if (block.type === 'text') return { kind: 'richText', html: block.props?.content || '' };
  if (block.type === 'question') return { kind: 'empty' };
  if (block.type === 'checkbox') return { kind: 'checkbox', selections: syncCheckboxSelections(block.props?.options, [], block.props?.allowMultiple) };
  if (block.type === 'image') return { kind: 'image', url: '', alt: '' };
  if (block.type === 'video') return { kind: 'video', url: '', poster: '' };
  return null;
};

export function syncContentForBlock(block, content) {
  if (!block) return content;
  if (block.type === 'checkbox') {
    return { kind: 'checkbox', selections: syncCheckboxSelections(block.props?.options, content?.selections, block.props?.allowMultiple) };
  }
  if (block.type === 'question') return { kind: 'empty' };
  if (block.type === 'image') return { kind: 'image', url: String(content?.url || ''), alt: String(content?.alt || '') };
  if (block.type === 'video') return { kind: 'video', url: String(content?.url || ''), poster: String(content?.poster || '') };
  if (block.type === 'header') return { kind: 'richText', html: String(block.props?.title || '') };
  if (block.type === 'footer') return { kind: 'richText', html: String(block.props?.text || '') };
  if (block.type === 'text') return { kind: 'richText', html: String(block.props?.content || content?.html || '') };
  return content;
}

export function validateBlockContent(type, content, props = {}) {
  if (type === 'checkbox') {
    const selections = Array.isArray(content?.selections) ? content.selections : [];
    if (selections.length > 10 || selections.length !== (props.options || []).length) return false;
    if (selections.some((item, index) => typeof item?.label !== 'string' || item.label !== props.options[index] || typeof item.checked !== 'boolean')) return false;
    return props.allowMultiple !== false || selections.filter((item) => item.checked).length <= 1;
  }
  if (type === 'question') return content?.kind === 'empty' || content?.kind === 'question' || !content;
  if (type === 'image') return content?.kind === 'image' && typeof content.url === 'string' && typeof content.alt === 'string';
  if (type === 'video') return content?.kind === 'video' && typeof content.url === 'string' && typeof content.poster === 'string';
  return true;
}