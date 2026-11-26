import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Youtube from '@tiptap/extension-youtube';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';
import { uploadCmsFile, uploadCmsImage } from '../../services/cmsUploadService';
import { sanitizeHtml } from '../../utils/cms';

const button = 'rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-primary/20 hover:text-white';
const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const CmsLink = Link.extend({
  addAttributes() {
    return { ...this.parent?.(), download: { default: null, parseHTML: element => element.getAttribute('download'), renderHTML: attributes => attributes.download ? { download: attributes.download } : {} } };
  },
});

const CmsYoutube = Youtube.extend({
  parseHTML() {
    return [
      { tag: 'div[data-youtube-video] iframe' },
      {
        tag: 'iframe[src]',
        getAttrs: element => {
          const src = element.getAttribute('src') || '';
          return /^https:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\//i.test(src) ? {} : false;
        },
      },
    ];
  },
});

const CmsImage = Image.extend({
  parseHTML() {
    return [
      { tag: 'figure.cms-image', getAttrs: node => { const image = node.querySelector('img'); if (!image) return false; return { ...this.options.HTMLAttributes, src: image.getAttribute('src'), alt: image.getAttribute('alt'), title: node.querySelector('figcaption')?.textContent || image.getAttribute('title'), 'data-align': node.getAttribute('data-align') || image.getAttribute('data-align'), width: image.getAttribute('width'), height: image.getAttribute('height') }; } },
      { tag: 'img[src]' },
    ];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-align': { default: 'left', parseHTML: element => element.getAttribute('data-align') || 'left', renderHTML: attributes => ({ 'data-align': attributes['data-align'] }) },
      width: { default: null, parseHTML: element => element.getAttribute('width'), renderHTML: attributes => attributes.width ? { width: attributes.width } : {} },
      height: { default: null, parseHTML: element => element.getAttribute('height'), renderHTML: attributes => attributes.height ? { height: attributes.height } : {} },
      title: { default: null, parseHTML: element => element.getAttribute('title'), renderHTML: attributes => attributes.title ? { title: attributes.title } : {} },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { title, 'data-align': align, ...imageAttributes } = HTMLAttributes;
    return ['figure', mergeAttributes({ class: 'cms-image', 'data-align': align || 'left' }), ['img', imageAttributes], ...(title ? [['figcaption', {}, title]] : [])];
  },
});

export default function RichEditor({ value = '', onChange, disabled = false, folder = 'cms/content' }) {
  const fileRef = useRef(null);
  const documentRef = useRef(null);
  const contentRef = useRef(sanitizeHtml(value));
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageMenu, setImageMenu] = useState({ open: false, align: 'left' });
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: {} }),
      CmsLink.configure({ openOnClick: false, autolink: true, linkOnPaste: true, protocols: ['http', 'https', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer' } }),
      CmsImage.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CmsYoutube.configure({
        modestBranding: true,
        nocookie: true,
        HTMLAttributes: {
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          referrerpolicy: 'strict-origin-when-cross-origin',
          loading: 'lazy',
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: contentRef.current,
    editable: !disabled,
    onUpdate: ({ editor: instance }) => {
      if (instance.isDestroyed) return;
      const html = sanitizeHtml(instance.getHTML());
      contentRef.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    const nextContent = sanitizeHtml(value);
    if (!editor || editor.isDestroyed || editor.isFocused || contentRef.current === nextContent) return;
    editor.commands.setContent(nextContent, false);
    contentRef.current = nextContent;
  }, [editor, value]);
  useEffect(() => { if (editor && !editor.isDestroyed) editor.setEditable(!disabled); }, [editor, disabled]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return undefined;
    const updateImageSelection = () => {
      const node = editor.state.selection.node;
      if (node?.type.name === 'image') {
        setSelectedImage(node.attrs);
        setImageMenu({ open: false, align: node.attrs['data-align'] || 'left' });
      } else setSelectedImage(null);
    };
    editor.on('selectionUpdate', updateImageSelection);
    return () => editor.off('selectionUpdate', updateImageSelection);
  }, [editor]);

  const updateImage = useCallback(attributes => {
    if (!editor || editor.isDestroyed || !selectedImage) return;
    editor.chain().focus().updateAttributes('image', attributes).run();
  }, [editor, selectedImage]);

  const setImageAlign = align => {
    setImageMenu(prev => ({ ...prev, align, open: false }));
    updateImage({ 'data-align': align });
  };

  const addImage = useCallback(async file => {
    const url = await uploadCmsImage(file, folder);
    const alt = window.prompt('Mô tả ảnh (alt):', '') || '';
    const caption = window.prompt('Chú thích ảnh:', '') || '';
    if (!editor || editor.isDestroyed) return;
    editor.chain().focus().setImage({ src: url, alt, title: caption, 'data-align': 'left' }).run();
  }, [editor, folder]);
  const addFile = useCallback(async (file) => {
    if (!editor || !file) return;
    const result = await uploadCmsFile(file, 'cms/files');
    const label = escapeHtml(file.name || 'Tải tệp');
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${result.url}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(file.name)}">${label}</a>`).run();
    } else {
      editor.chain().focus().setLink({ href: result.url, target: '_blank', download: file.name }).run();
    }
  }, [editor]);
  const addLink = useCallback(() => {
    if (!editor) return;
    const current = editor.getAttributes('link').href || '';
    const url = window.prompt('URL liên kết (có thể dùng /du-an/...):', current);
    if (url === null) return;
    const next = url.trim();
    if (!next) { editor.chain().focus().unsetLink().run(); return; }
    if (!/^(?:https?:\/\/|mailto:|\/|#)/i.test(next)) { window.alert('URL phải bắt đầu bằng https://, mailto:, / hoặc #.'); return; }
    editor.chain().focus().setLink({ href: next, target: /^https?:/i.test(next) ? '_blank' : null, rel: 'noopener noreferrer' }).run();
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return undefined;
    const drop = event => { const file = event.dataTransfer?.files?.[0]; if (file?.type.startsWith('image/')) { event.preventDefault(); addImage(file).catch(err => window.alert(err.message)); } };
    const paste = event => { const file = [...(event.clipboardData?.files || [])].find(item => item.type.startsWith('image/')); if (file) { event.preventDefault(); addImage(file).catch(err => window.alert(err.message)); } };
    const element = editor.view.dom; element.addEventListener('drop', drop); element.addEventListener('paste', paste);
    return () => { element.removeEventListener('drop', drop); element.removeEventListener('paste', paste); };
  }, [editor, addImage]);

  if (!editor) return <div className="min-h-[360px] rounded-lg border border-white/10 bg-black/20" />;
  const cmd = (action) => editor.chain().focus()[action]().run();
  return <div className="rich-editor overflow-hidden rounded-lg border border-white/10 bg-black/20">
    <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-white/10 bg-surface/95 p-2 backdrop-blur">
      <button type="button" className={button} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Tiêu đề H2">H2</button>
      <button type="button" className={button} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Tiêu đề H3">H3</button>
      {['toggleBold','toggleItalic','toggleUnderline','toggleStrike','toggleBulletList','toggleOrderedList','toggleBlockquote','toggleCodeBlock'].map((action, i) => <button type="button" key={action} className={button} onClick={() => cmd(action)}>{['B','I','U','S','• list','1. list','quote','code'][i]}</button>)}
      {['left', 'center', 'right', 'justify'].map(align => <button type="button" key={align} className={button} onClick={() => editor.chain().focus().setTextAlign(align).run()} title={`Căn ${align}`}>{align === 'left' ? '←' : align === 'center' ? '↔' : align === 'right' ? '→' : '☷'}</button>)}
      <button type="button" className={button} onClick={() => { const raw = window.prompt('URL YouTube:'); const url = raw ? raw.trim() : ''; if (url && !editor.commands.setYoutubeVideo({ src: url, width: 640, height: 360 })) window.alert('URL YouTube không hợp lệ.'); }}>YouTube</button>
      <button type="button" className={button} onClick={addLink} disabled={!editor}>Link</button>
      <button type="button" className={button} onClick={() => fileRef.current?.click()}>Ảnh</button>
      <button type="button" className={button} onClick={() => documentRef.current?.click()}>File</button>
      {selectedImage && <div className="relative">
        <button type="button" className={button} onClick={() => setImageMenu(prev => ({ ...prev, open: !prev.open }))}>Ảnh: căn & kích thước</button>
        {imageMenu.open && <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-white/10 bg-surface p-2 shadow-xl">
          <p className="mb-1 px-1 text-[11px] text-white/50">Căn ảnh</p>
          <div className="mb-2 grid grid-cols-3 gap-1">{[['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']].map(([align, label]) => <button type="button" key={align} className={`${button} ${imageMenu.align === align ? 'border-primary/60 bg-primary/20 text-white' : ''}`} onClick={() => setImageAlign(align)}>{label}</button>)}</div>
          <p className="mb-1 px-1 text-[11px] text-white/50">Độ rộng</p>
          <div className="grid grid-cols-4 gap-1">
            {[['360', 'S'], ['640', 'M'], ['960', 'L'], ['', 'Tự động']].map(([width, label]) => <button type="button" key={label} className={button} onClick={() => { updateImage({ width, height: '' }); setImageMenu(prev => ({ ...prev, open: false })); }}>{label}</button>)}
          </div>
        </div>}
      </div>}
      <button type="button" className={button} onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run()}>Bảng</button>
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) addImage(file).catch(err => window.alert(err.message)); event.target.value = ''; }} />
      <input ref={documentRef} hidden type="file" onChange={event => { const file = event.target.files?.[0]; if (file) addFile(file).catch(err => window.alert(err.message)); event.target.value = ''; }} />
    </div>
    <EditorContent editor={editor} className="rich-editor-content min-h-[360px] p-4 text-sm leading-7 text-white/90" />
    <style>{`.rich-editor-content .ProseMirror{min-height:330px;outline:none}.rich-editor-content .ProseMirror figure.cms-image{max-width:100%;margin:1rem 0}.rich-editor-content .ProseMirror figure.cms-image img{display:block;max-width:100%;height:auto}.rich-editor-content .ProseMirror figure.cms-image[data-align="center"]{margin-left:auto;margin-right:auto}.rich-editor-content .ProseMirror figure.cms-image[data-align="right"]{margin-left:auto}.rich-editor-content .ProseMirror figcaption{padding-top:.35rem;text-align:center;font-size:.8rem;color:#aaa}.rich-editor-content p[style*="text-align"]{min-height:1.5em}.rich-editor-content .ProseMirror table{display:block;max-width:100%;overflow-x:auto}`}</style>
  </div>;
}