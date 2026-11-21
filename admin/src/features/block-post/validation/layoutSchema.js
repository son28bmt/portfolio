import { z } from 'zod';
import { sanitizeHtml } from '../../../utils/cms';
import { directVideoUrl, safeUrl, videoEmbedUrl } from '@layout-post-renderer/media';

export const BLOCK_TYPES = ['header', 'text', 'footer', 'question', 'checkbox', 'image', 'video'];
export const ALIGN_VALUES = ['left', 'center', 'right'];
export const MAX_TEMPLATE_BLOCKS = 100;
export const MAX_TEMPLATE_JSON_BYTES = 200 * 1024;
export function parseJsonValue(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
export const checkboxSelectionSchema = z.object({ label: z.string().trim().min(1).max(100), checked: z.boolean() }).strip();
export const checkboxContentSchema = z.object({ kind: z.literal('checkbox'), selections: z.array(checkboxSelectionSchema).max(10) });

const allowedProps = {
  header: z.object({ title: z.string().max(255).optional() }).strip(),
  text: z.object({ content: z.string().max(MAX_TEMPLATE_JSON_BYTES).optional() }).strip(),
  footer: z.object({ text: z.string().max(500).optional() }).strip(),
  question: z.object({ templateId: z.string().uuid().optional(), heading: z.string().max(100).optional() }).strip(),
  checkbox: z.object({ options: z.array(z.string().trim().min(1).max(100)).min(1).max(10), allowMultiple: z.boolean().optional().default(true) }).strip().superRefine((props, context) => {
    if (new Set(props.options).size !== props.options.length) context.addIssue({ code: 'custom', path: ['options'], message: 'Các lựa chọn checkbox không được trùng nhau.' });
  }),
  image: z.object({ fit: z.enum(['cover', 'contain']).optional().default('cover'), ratio: z.enum(['free', '16:9', '4:3', '1:1']).optional().default('free'), borderRadius: z.number().min(0).max(100).optional().default(8) }).strip(),
  video: z.object({ ratio: z.enum(['16:9', '4:3', '1:1']).optional().default('16:9'), autoplay: z.boolean().optional().default(false), controls: z.boolean().optional().default(true) }).strip(),
};

export const templateBlockSchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: z.enum(BLOCK_TYPES),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  align: z.enum(ALIGN_VALUES),
  props: z.record(z.string(), z.unknown()).default({}),
}).superRefine((block, context) => {
  if (block.x + block.w > 12) context.addIssue({ code: 'custom', path: ['x'], message: `Block ${block.id}: x + w không được vượt quá 12 cột.` });
});

export const layoutTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Tên mẫu không được để trống.').max(150, 'Tên mẫu tối đa 150 ký tự.'),
  description: z.string().trim().max(5000).nullable().optional(),
  schemaVersion: z.number().int().min(1).default(1),
  blocks: z.array(templateBlockSchema).max(MAX_TEMPLATE_BLOCKS, `Tối đa ${MAX_TEMPLATE_BLOCKS} block.`),
}).superRefine((template, context) => {
  const ids = new Set();
  template.blocks.forEach((block, index) => {
    if (ids.has(block.id)) context.addIssue({ code: 'custom', path: ['blocks', index, 'id'], message: `Block ${block.id}: id bị trùng.` });
    ids.add(block.id);
  });
  for (let i = 0; i < template.blocks.length; i += 1) {
    for (let j = i + 1; j < template.blocks.length; j += 1) {
      const a = template.blocks[i];
      const b = template.blocks[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
        context.addIssue({ code: 'custom', path: ['blocks', j], message: `Block ${b.id} chồng lên block ${a.id}.` });
      }
    }
  }
});

export function normalizeTemplateBlocks(blocks = []) {
  const parsedBlocks = parseJsonValue(blocks, []);
  const source = Array.isArray(parsedBlocks) ? parsedBlocks : Array.isArray(parsedBlocks?.blocks) ? parsedBlocks.blocks : [];
  const supported = [];
  const skipped = [];
  for (const block of source) {
    if (!BLOCK_TYPES.includes(block?.type)) {
      skipped.push(block?.type || 'không xác định');
      continue;
    }
    const parsed = templateBlockSchema.safeParse(block);
    if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(' '));
    const props = allowedProps[parsed.data.type].parse(parsed.data.props || {});
    supported.push({ ...parsed.data, props });
  }
  return { blocks: supported, skipped };
}

export function validateTemplateForSave(value) {
  const normalized = normalizeTemplateBlocks(value.blocks);
  const result = layoutTemplateSchema.safeParse({ ...value, blocks: normalized.blocks });
  if (!result.success) throw new Error(result.error.issues.map((issue) => issue.message).join(' '));
  if (new TextEncoder().encode(JSON.stringify(result.data)).length > MAX_TEMPLATE_JSON_BYTES) {
    throw new Error('Dữ liệu mẫu không được vượt quá 200 KB.');
  }
  return result.data;
}

export function validateBlockContent(type, content, props = {}) {
  try { validateContentByType(type, content, props); return true; } catch { return false; }
}

function validateContentByType(type, content, props = {}) {
  if (content?.kind === 'empty') return { kind: 'empty' };
  if (['header', 'text', 'context', 'footer'].includes(type)) {
    if (content?.kind !== 'richText' || typeof content.html !== 'string') throw new Error('Nội dung richText không hợp lệ.');
    if (new TextEncoder().encode(content.html).length > 100 * 1024) throw new Error('Nội dung richText không được vượt quá 100 KB.');
    return { kind: 'richText', html: sanitizeHtml(content.html) };
  }
  if (type === 'checkbox') {
    const result = checkboxContentSchema.safeParse(content);
    if (!result.success || result.data.selections.length !== props.options?.length) throw new Error('Checkbox selections phải khớp options.');
    if (result.data.selections.some((item, index) => item.label !== props.options[index])) throw new Error('Checkbox labels phải khớp thứ tự options.');
    if (props.allowMultiple === false && result.data.selections.filter((item) => item.checked).length > 1) throw new Error('Checkbox chỉ được chọn một mục.');
    return result.data;
  }
  if (type === 'question') {
    if (content?.kind === 'question' || content?.kind === 'empty' || content === undefined) return { kind: 'empty' };
    throw new Error('Question content không hợp lệ.');
  }
  if (type === 'image') {
    if (content?.kind !== 'image' || typeof content.alt !== 'string' || content.alt.length > 200 || (content.url && !safeUrl(content.url))) throw new Error('Image content hoặc URL không hợp lệ.');
    return { kind: 'image', url: content.url || '', alt: content.alt };
  }
  if (type === 'video') {
    if (content?.kind !== 'video' || (content.url && !safeUrl(content.url)) || (content.poster && !safeUrl(content.poster))) throw new Error('Video content hoặc URL không hợp lệ.');
    if (content.url && !videoEmbedUrl(content.url) && !directVideoUrl(content.url)) throw new Error('Video chỉ hỗ trợ YouTube, Vimeo, MP4 hoặc WebM.');
    return { kind: 'video', url: content.url || '', poster: content.poster || '' };
  }
  throw new Error(`Block ${type} không được hỗ trợ.`);
}

export function validateLayoutPostForSave(value) {
  const title = String(value.title || '').trim();
  if (!title || title.length > 200) throw new Error('Tiêu đề bài viết bắt buộc và tối đa 200 ký tự.');
  const layout = validateTemplateForSave({ name: 'snapshot', blocks: value.layout || [], schemaVersion: 1 }).blocks;
  const questionBlocks = layout.filter((block) => block.type === 'question');
  if (value.status === 'published' && questionBlocks.length > 1) throw new Error(`Block ${questionBlocks[1].id}: chỉ được có tối đa 1 block Question khi đăng.`);
  if (value.status === 'published' && questionBlocks.some((block) => !block.props.templateId)) throw new Error(`Block ${questionBlocks.find((block) => !block.props.templateId).id}: cần chọn bộ câu hỏi trước khi đăng.`);
  const blockMap = new Map(layout.map((block) => [block.id, block]));
  const parsedContent = parseJsonValue(value.content, {});
  const source = parsedContent && typeof parsedContent === 'object' && !Array.isArray(parsedContent) ? parsedContent : {};
  for (const key of Object.keys(source)) if (!blockMap.has(key)) throw new Error(`Block ${key} không tồn tại trong layout.`);
  const content = {};
  for (const block of layout) content[block.id] = validateContentByType(block.type, source[block.id] || { kind: 'empty' }, block.props);
  const result = { title, templateId: value.templateId || null, layout, content, status: value.status === 'published' ? 'published' : 'draft', updatedAt: value.updatedAt };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 1024 * 1024) throw new Error('Dữ liệu bài không được vượt quá 1 MB.');
  return result;
}