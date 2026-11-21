export { mediaUrlVectors } from './media-url-vectors.js';

const hosts = new Set(['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

export function safeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('/uploads/')) {
    try {
      const decoded = decodeURIComponent(text);
      if (!decoded.startsWith('/uploads/') || decoded.includes('..') || decoded.includes('\\') || decoded.includes('//') || /[\u0000-\u001f]/.test(decoded)) return '';
      return decoded;
    } catch { return ''; }
  }
  try { const url = new URL(text); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''; } catch { return ''; }
}

export function videoEmbedUrl(value) {
  const text = safeUrl(value);
  if (!text || text.startsWith('/')) return '';
  try {
    const url = new URL(text); const host = url.hostname.toLowerCase();
    if (!hosts.has(host)) return '';
    if (host === 'player.vimeo.com') return /^\/video\/\d+$/.test(url.pathname) ? text : '';
    if (host.includes('vimeo')) { const id = url.pathname.split('/').filter(Boolean).pop(); return /^\d+$/.test(id || '') ? `https://player.vimeo.com/video/${id}` : ''; }
    const id = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
    return id && /^[A-Za-z0-9_-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
  } catch { return ''; }
}

export const directVideoUrl = (value) => /\.(mp4|webm)(?:$|[?#])/i.test(safeUrl(value));