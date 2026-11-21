import { useState } from 'react';
import DOMPurify from 'dompurify';
import { directVideoUrl, safeUrl, videoEmbedUrl } from './media';
import { syncCheckboxSelections } from './syncCheckboxSelections';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'a', 'img'];
const ALLOWED_ATTR = ['href', 'rel', 'target', 'src', 'alt', 'width', 'height', 'style'];
const textAlignValue = /(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\s*(?:;|$)/i;
const exactTextAlign = /^text-align\s*:\s*(left|center|right|justify)$/i;

const sanitizeHook = (_node, data) => {
  if (data.attrName === 'style') {
    const value = String(data.attrValue || '').trim();
    data.attrValue = exactTextAlign.test(value) ? value.toLowerCase() : '';
    if (!data.attrValue) data.keepAttr = false;
  }
  if (data.attrName === 'href' || data.attrName === 'src') {
    const value = String(data.attrValue || '').trim();
    const allowed = data.attrName === 'href'
      ? /^(?:https?:|mailto:)/i.test(value)
      : /^(?:https?:|\/uploads\/)/i.test(value);
    if (!allowed) data.keepAttr = false;
  }
};

export const cleanRichText = (value) => {
  if (!DOMPurify.isSupported || typeof document === 'undefined') return '';
  const input = String(value || '').replace(/\sstyle\s*=\s*["']([^"']*)["']/gi, (_match, style) => {
    const match = String(style).match(textAlignValue);
    return match ? ` style="text-align:${match[1].toLowerCase()}"` : '';
  });
  DOMPurify.addHook('afterSanitizeAttributes', sanitizeHook);
  try {
    const sanitized = DOMPurify.sanitize(input, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    });
    const wrapper = document.createElement('template');
    wrapper.innerHTML = sanitized;
    wrapper.content.querySelectorAll('a[target="_blank"]').forEach((node) => node.setAttribute('rel', 'noopener noreferrer'));
    return wrapper.innerHTML;
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes');
  }
};

export function RichTextBlock({ html, align }) { return <div className="lpr-rich-text" style={{ textAlign: align }} dangerouslySetInnerHTML={{ __html: cleanRichText(html) }} />; }
export function HeaderBlock({ block, content }) { return <header className="lpr-header" style={{ textAlign: block.align }}><RichTextBlock html={content?.html || block.props?.content || ''} align={block.align} /></header>; }
export function TextBlock({ block, content }) { return <RichTextBlock html={content?.html || block.props?.content || ''} align={block.align} />; }
export function FooterBlock({ block, content }) { return <footer className="lpr-footer" style={{ textAlign: block.align }}><RichTextBlock html={content?.html || block.props?.content || ''} align={block.align} /></footer>; }
export function QuestionBlock({ block }) { return <div className="lpr-question" style={{ textAlign: block.align }}><p>{block.props?.heading || 'Form câu hỏi'}</p><fieldset disabled><small>Form câu hỏi (hiển thị ở trang công khai)</small></fieldset></div>; }
export function CheckboxBlock({ block, content }) { const selections = syncCheckboxSelections(block.props?.options || [], content?.selections, block.props?.allowMultiple); return <div className="lpr-checkbox" style={{ textAlign: block.align }}><p>Hộp kiểm</p>{selections.map((item) => <label key={item.label}><input type="checkbox" disabled checked={item.checked} readOnly />{item.label}</label>)}<small>Chỉ hiển thị · chưa thu thập lựa chọn</small></div>; }
export function ImageBlock({ block, content }) { const [failed, setFailed] = useState(false); const url = safeUrl(content?.url); if (!url || failed) return <div className="lpr-media-error">Không có hình ảnh khả dụng.</div>; return <img className={`lpr-image lpr-ratio-${String(block.props?.ratio || 'free').replace(':', '-')}`} src={url} alt={content?.alt || ''} loading="lazy" style={{ objectFit: block.props?.fit || 'cover', borderRadius: block.props?.borderRadius || 0 }} onError={() => setFailed(true)} />; }
export function VideoBlock({ block, content }) { const url = safeUrl(content?.url); const embed = videoEmbedUrl(url); const poster = safeUrl(content?.poster); if (!url) return <div className="lpr-media-error">Không có video khả dụng.</div>; if (embed) return <iframe className={`lpr-video lpr-ratio-${String(block.props?.ratio || '16:9').replace(':', '-')}`} src={embed} title="Video" sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowFullScreen />; if (directVideoUrl(url)) return <video className={`lpr-video lpr-ratio-${String(block.props?.ratio || '16:9').replace(':', '-')}`} src={url} poster={poster || undefined} controls={block.props?.controls !== false} muted autoPlay={Boolean(block.props?.autoplay)} />; return <div className="lpr-media-error">URL video không hợp lệ.</div>; }