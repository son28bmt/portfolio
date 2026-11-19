const sanitizeHtml = require('sanitize-html');

const allowedIframeHostnames = [
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
];

const isAllowedEmbedUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && allowedIframeHostnames.includes(url.hostname)
      && url.pathname.startsWith('/embed/');
  } catch {
    return false;
  }
};

const hasAllowedAbsoluteScheme = (value, schemes) => {
  try {
    const url = new URL(value);
    return schemes.includes(url.protocol);
  } catch {
    return false;
  }
};

const sanitizeGuideHtml = (html) => sanitizeHtml(String(html || ''), {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'strong', 'em', 'u', 's',
    'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'table',
    'thead', 'tbody', 'tr', 'th', 'td', 'span', 'iframe',
  ],
  allowedAttributes: {
    '*': ['class'],
    a: ['href', 'rel', 'target'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'title', 'allowfullscreen', 'frameborder'],
  },
  allowedClasses: {
    '*': [/^ql-/],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
    img: ['https'],
    iframe: ['https'],
  },
  allowedIframeHostnames,
  transformTags: {
    a: (tagName, attribs) => {
      const nextAttribs = { ...attribs, rel: 'noopener noreferrer' };
      if (nextAttribs.href && !hasAllowedAbsoluteScheme(nextAttribs.href, ['http:', 'https:', 'mailto:'])) {
        delete nextAttribs.href;
      }
      if (nextAttribs.target !== '_blank') delete nextAttribs.target;
      return { tagName, attribs: nextAttribs };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, alt: attribs.alt ?? '' } }),
    iframe: (tagName, attribs) => {
      return {
        tagName,
        attribs: { ...attribs, allowfullscreen: 'allowfullscreen', frameborder: '0' },
      };
    },
  },
  exclusiveFilter: (frame) => (frame.tag === 'img' && !hasAllowedAbsoluteScheme(frame.attribs.src, ['https:']))
    || (frame.tag === 'iframe' && !isAllowedEmbedUrl(frame.attribs.src)),
});

module.exports = { sanitizeGuideHtml, allowedIframeHostnames };
