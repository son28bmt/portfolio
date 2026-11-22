const { z } = require('zod');
const sanitizeHtml = require('sanitize-html');

const GRID_COLUMNS = 12;
const MAX_BLOCKS = 100;
const MAX_JSON_BYTES = 200 * 1024;
const MAX_POST_JSON_BYTES = 1024 * 1024;
const BLOCK_TYPES = ['header', 'text', 'footer', 'question', 'checkbox', 'image', 'video'];
const ALIGN_VALUES = ['left', 'center', 'right'];
const checkboxSelectionSchema = z.object({ label: z.string().trim().min(1).max(100), checked: z.boolean() }).strip();
const checkboxContentSchema = z.object({ kind: z.literal('checkbox'), selections: z.array(checkboxSelectionSchema).max(10) });

const blockPropsSchema = z.record(z.string(), z.unknown()).default({});
const allowedPropsSchema = {
  header: z.object({ title: z.string().max(MAX_JSON_BYTES).optional() }).strip(),
  text: z.object({ content: z.string().max(MAX_JSON_BYTES).optional() }).strip(),
  footer: z.object({ text: z.string().max(MAX_JSON_BYTES).optional() }).strip(),
  question: z.object({ templateId: z.string().uuid().optional(), heading: z.string().max(100).optional() }).strip(),
  checkbox: z.object({ options: z.array(z.string().trim().min(1).max(100)).min(1).max(10), allowMultiple: z.boolean().default(true) }).strip(),
  image: z.object({ fit: z.enum(['cover', 'contain']).default('cover'), ratio: z.enum(['free', '16:9', '4:3', '1:1']).default('free'), borderRadius: z.number().min(0).max(100).default(8) }).strip(),
  video: z.object({ ratio: z.enum(['16:9', '4:3', '1:1']).default('16:9'), autoplay: z.boolean().default(false), controls: z.boolean().default(true) }).strip(),
};
const blockSchema = z.object({
  id: z.string().trim().min(1, 'id block không được rỗng.').max(100, 'id block không quá 100 ký tự.'),
  type: z.enum(BLOCK_TYPES, { message: 'loại block chưa được hỗ trợ.' }),
  x: z.number({ message: 'x phải là số nguyên.' }).int('x phải là số nguyên.').min(0, 'x không được âm.'),
  y: z.number({ message: 'y phải là số nguyên.' }).int('y phải là số nguyên.').min(0, 'y không được âm.'),
  w: z.number({ message: 'w phải là số nguyên.' }).int('w phải là số nguyên.').min(1, 'w phải tối thiểu là 1.'),
  h: z.number({ message: 'h phải là số nguyên.' }).int('h phải là số nguyên.').min(1, 'h phải tối thiểu là 1.'),
  align: z.enum(ALIGN_VALUES, { message: 'căn lề chỉ được left, center hoặc right.' }),
  props: blockPropsSchema,
}).superRefine((block, context) => {
  if (block.x + block.w > GRID_COLUMNS) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['x'], message: `block ${block.id}: x + w không được vượt quá ${GRID_COLUMNS} cột.` });
  }
});

const templateSchema = z.object({
  name: z.string({ message: 'Tên mẫu là bắt buộc.' }).trim().min(1, 'Tên mẫu không được rỗng.').max(150, 'Tên mẫu không quá 150 ký tự.'),
  description: z.string().trim().max(5000, 'Mô tả không quá 5.000 ký tự.').nullable().optional().transform((value) => value || null),
  blocks: z.array(blockSchema).max(MAX_BLOCKS, `Mẫu không được có quá ${MAX_BLOCKS} block.`),
  schemaVersion: z.number().int().min(1).optional().default(1),
}).superRefine((template, context) => {
  const ids = new Set();
  template.blocks.forEach((block, index) => {
    if (ids.has(block.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['blocks', index, 'id'], message: `block ${block.id}: id bị trùng.` });
    }
    ids.add(block.id);
  });

  for (let index = 0; index < template.blocks.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < template.blocks.length; otherIndex += 1) {
      const current = template.blocks[index];
      const other = template.blocks[otherIndex];
      const overlaps = current.x < other.x + other.w
        && current.x + current.w > other.x
        && current.y < other.y + other.h
        && current.y + current.h > other.y;
      if (overlaps) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['blocks', otherIndex], message: `block ${other.id} chồng lên block ${current.id}.` });
      }
    }
  }
});

function normalizeProps(block) {
  const parsed = allowedPropsSchema[block.type].safeParse(block.props || {});
  if (!parsed.success) throw new Error(`block ${block.id}: ${parsed.error.issues.map((issue) => issue.message).join(' ')}`);
  const props = parsed.data;
  if (block.type === 'checkbox' && new Set(props.options).size !== props.options.length) {
    throw new Error(`block ${block.id}: các lựa chọn không được trùng nhau.`);
  }
  return props;
}

function formatValidationIssues(issues = []) {
  return issues.map((issue) => {
    const blockIndex = issue.path.find((item) => item === 'blocks') !== undefined ? issue.path[issue.path.indexOf('blocks') + 1] : null;
    const blockLabel = Number.isInteger(blockIndex) ? `Block thứ ${blockIndex + 1}: ` : '';
    return { path: issue.path, message: `${blockLabel}${issue.message}` };
  });
}

function validateTemplatePayload(payload) {
  let inputBytes;
  try {
    inputBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch {
    inputBytes = MAX_JSON_BYTES + 1;
  }
  if (inputBytes > MAX_JSON_BYTES) {
    const error = new Error('Dữ liệu mẫu không được vượt quá 200 KB.');
    error.status = 400;
    error.code = 'LAYOUT_VALIDATION_ERROR';
    error.errors = [{ path: [], message: error.message }];
    throw error;
  }
  const result = templateSchema.safeParse(payload);
  if (!result.success) {
    const error = new Error(formatValidationIssues(result.error.issues).map((issue) => issue.message).join(' '));
    error.status = 400;
    error.code = 'LAYOUT_VALIDATION_ERROR';
    error.errors = formatValidationIssues(result.error.issues);
    throw error;
  }

  let normalized;
  try { normalized = { ...result.data, blocks: result.data.blocks.map((block) => ({ ...block, props: normalizeProps(block) })) }; }
  catch (validationError) {
    const error = new Error(validationError.message);
    error.status = 400; error.code = 'LAYOUT_VALIDATION_ERROR'; error.errors = [{ path: ['blocks'], message: error.message }];
    throw error;
  }
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_JSON_BYTES) {
    const error = new Error('Dữ liệu mẫu không được vượt quá 200 KB.');
    error.status = 400;
    error.code = 'LAYOUT_VALIDATION_ERROR';
    error.errors = [{ path: [], message: error.message }];
    throw error;
  }
  return normalized;
}

function validateBlockContent(type, content, props = {}) {
  if (type !== 'checkbox') return content;
  const result = checkboxContentSchema.safeParse(content);
  if (!result.success) {
    const error = new Error(result.error.issues.map((issue) => issue.message).join(' '));
    error.status = 400; error.code = 'LAYOUT_CONTENT_VALIDATION_ERROR'; throw error;
  }
  if (result.data.selections.length !== props.options?.length || result.data.selections.some((item, index) => item.label !== props.options[index])) {
    const error = new Error('Selections của checkbox phải khớp thứ tự và label với options.');
    error.status = 400; error.code = 'LAYOUT_CONTENT_VALIDATION_ERROR'; throw error;
  }
  if (new Set(result.data.selections.map((item) => item.label)).size !== result.data.selections.length) {
    const error = new Error('Selections checkbox không được có label trùng nhau.');
    error.status = 400; error.code = 'LAYOUT_CONTENT_VALIDATION_ERROR'; throw error;
  }
  if (props.allowMultiple === false && result.data.selections.filter((item) => item.checked).length > 1) {
    const error = new Error('Checkbox không cho phép chọn quá một mục.');
    error.status = 400; error.code = 'LAYOUT_CONTENT_VALIDATION_ERROR'; throw error;
  }
  return result.data;
}

const sanitizeRichText = (value) => {
  if (typeof value !== 'string') throw new Error('richText phải là chuỗi HTML.');
  if (Buffer.byteLength(value, 'utf8') > 100 * 1024) throw new Error('richText không được vượt quá 100 KB.');
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'a', 'img'],
    allowedAttributes: { a: ['href', 'rel', 'target'], img: ['src', 'alt', 'width', 'height'], '*': ['style'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'], img: ['http', 'https'] },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/] } },
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' } }),
      img: (tagName, attribs) => {
        try {
          if (String(attribs.src || '').startsWith('/uploads/')) safeMediaUrl(attribs.src, 'URL ảnh', false);
          else if (!/^https?:\/\//i.test(attribs.src || '')) delete attribs.src;
        } catch { delete attribs.src; }
        return { tagName, attribs };
      },
    },
  });
};

const safeMediaUrl = (value, fieldName, allowEmpty = true) => {
  const text = String(value || '').trim();
  if (!text && allowEmpty) return '';
    if (text.startsWith('/uploads/')) {
      let decoded;
      try { decoded = decodeURIComponent(text); } catch { throw new Error(`${fieldName} không hợp lệ.`); }
      if (/[\\\u0000-\u001f]/.test(decoded) || decoded.startsWith('//') || decoded.includes('/uploads//') || decoded.includes('\\') || decoded.includes('/../') || decoded.includes('/./') || decoded.includes('%')) throw new Error(`${fieldName} không hợp lệ.`);
      const normalized = new URL(decoded, 'https://internal.invalid').pathname;
      if (!normalized.startsWith('/uploads/') || normalized !== decoded) throw new Error(`${fieldName} không hợp lệ.`);
      return normalized;
    }
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch { throw new Error(`${fieldName} chỉ được dùng URL http/https hoặc đường dẫn upload nội bộ.`); }
};

function validatePostPayload(payload, { publishing = false } = {}) {
  const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
  if (!title || title.length > 200) {
    const error = new Error('Tiêu đề bài viết là bắt buộc và không quá 200 ký tự.'); error.status = 400; throw error;
  }
  const layoutPayload = validateTemplatePayload({ name: 'snapshot', description: null, blocks: payload?.layout || [], schemaVersion: 1 });
  const rawContent = payload?.content && typeof payload.content === 'object' && !Array.isArray(payload.content) ? payload.content : {};
  const blockMap = new Map(layoutPayload.blocks.map((block) => [block.id, block]));
  const content = {};
  for (const [blockId, value] of Object.entries(rawContent)) {
    const block = blockMap.get(blockId);
    if (!block) { const error = new Error(`block ${blockId}: không tồn tại trong layout.`); error.status = 400; throw error; }
      if (value?.kind === 'empty' || (block.type === 'question' && value?.kind === 'question')) { content[blockId] = { kind: 'empty' }; continue; }
    const expectedKind = ['header', 'text', 'context', 'footer'].includes(block.type) ? 'richText' : block.type;
    if (!value || value.kind !== expectedKind) { const error = new Error(`block ${blockId}: content.kind phải là ${expectedKind}.`); error.status = 400; throw error; }
    try {
      if (expectedKind === 'richText') content[blockId] = { kind: 'richText', html: sanitizeRichText(value.html || '') };
      else if (expectedKind === 'checkbox') content[blockId] = validateBlockContent('checkbox', value, block.props);
      else if (expectedKind === 'question') {
        if (value?.kind === 'question') content[blockId] = { kind: 'empty' };
        else if (value?.kind !== 'empty' && value !== undefined) throw new Error('Question content phải là empty.');
        else content[blockId] = { kind: 'empty' };
      } else if (expectedKind === 'image') {
        if (typeof value.alt !== 'string' || value.alt.length > 200) throw new Error('alt ảnh không quá 200 ký tự.');
        content[blockId] = { kind: 'image', url: safeMediaUrl(value.url, 'URL ảnh'), alt: value.alt };
      } else if (expectedKind === 'video') {
        const videoUrl = safeMediaUrl(value.url, 'URL video');
        const poster = safeMediaUrl(value.poster, 'URL poster');
        if (videoUrl && !isAllowedVideoSource(videoUrl)) throw new Error('URL video phải là YouTube, Vimeo hoặc file MP4/WebM.');
        content[blockId] = { kind: 'video', url: videoUrl, poster };
      }
    } catch (innerError) {
      const error = new Error(`block ${blockId}: ${innerError.message}`);
      error.status = 400; error.code = 'LAYOUT_POST_VALIDATION_ERROR'; error.errors = [{ blockId, message: innerError.message }]; throw error;
    }
  }
  for (const block of layoutPayload.blocks) {
    if (content[block.id]) continue;
    if (['header', 'text', 'context', 'footer'].includes(block.type)) content[block.id] = { kind: 'richText', html: '' };
    else if (block.type === 'question') content[block.id] = { kind: 'empty' };
    else if (block.type === 'checkbox') content[block.id] = validateBlockContent('checkbox', { kind: 'checkbox', selections: block.props.options.map((label) => ({ label, checked: false })) }, block.props);
    else if (block.type === 'image') content[block.id] = { kind: 'image', url: '', alt: '' };
    else if (block.type === 'video') content[block.id] = { kind: 'video', url: '', poster: '' };
  }
  const normalized = { title, templateId: payload.templateId || null, layout: layoutPayload.blocks, content, status: publishing ? 'published' : (payload.status === 'published' ? 'published' : 'draft') };
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_POST_JSON_BYTES) { const error = new Error('Dữ liệu bài không được vượt quá 1 MB.'); error.status = 400; error.code = 'LAYOUT_POST_VALIDATION_ERROR'; error.errors = [{ message: error.message }]; throw error; }
  return normalized;
}

function isAllowedVideoSource(value) {
  try {
    const url = new URL(value);
    if (['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname.toLowerCase())) return true;
  } catch { return false; }
  return /\.(mp4|webm)(?:$|[?#])/i.test(value);
}

function assertPostUpdatedAt(currentUpdatedAt, expectedUpdatedAt) {
  const current = new Date(currentUpdatedAt).getTime();
  const expected = new Date(expectedUpdatedAt).getTime();
  // SQL timestamps use DATETIME(3); compare the exact millisecond returned to the client.
  if (!Number.isFinite(expected) || current !== expected) {
    const error = new Error('Bài đã được sửa ở nơi khác'); error.status = 409; error.code = 'LAYOUT_POST_CONFLICT'; error.errors = []; throw error;
  }
}

function assertTemplateNotInUse(postCount) {
  if (postCount > 0) {
    const error = new Error(`Mẫu đang được dùng bởi ${postCount} bài`); error.status = 409; error.code = 'LAYOUT_TEMPLATE_IN_USE'; error.errors = []; throw error;
  }
}

module.exports = {
  ALIGN_VALUES,
  BLOCK_TYPES,
  GRID_COLUMNS,
  MAX_BLOCKS,
  MAX_JSON_BYTES,
  blockSchema,
  templateSchema,
  validateTemplatePayload,
  validateBlockContent,
  validatePostPayload,
  sanitizeRichText,
  safeMediaUrl,
  assertPostUpdatedAt,
  assertTemplateNotInUse,
};