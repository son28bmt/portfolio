import { useCallback, useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { uploadCmsImage } from '../../services/cmsUploadService';
import { sanitizeHtml } from '../../utils/cms';

const button = 'rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-primary/20 hover:text-white';

export default function RichEditor({ value = '', onChange, disabled = false, folder = 'cms/content' }) {
  const fileRef = useRef(null);
  const contentRef = useRef(sanitizeHtml(value));
  const editor = useEditor({
    extensions: [StarterKit, Underline, Image.configure({ inline: false, allowBase64: false }), Link.configure({ openOnClick: false }), Youtube.configure({ modestBranding: true, nocookie: true }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell],
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

  const addImage = useCallback(async file => {
    const url = await uploadCmsImage(file, folder);
    const alt = window.prompt('Mô tả ảnh (alt):', '') || '';
    const caption = window.prompt('Chú thích ảnh:', '') || '';
    editor?.chain().focus().setImage({ src: url, alt, title: caption }).run();
  }, [editor, folder]);

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
      <button type="button" className={button} onClick={() => { const url = window.prompt('URL YouTube:'); if (url) editor.commands.setYoutubeVideo({ src: url, width: 640, height: 360 }); }}>YouTube</button>
      <button type="button" className={button} onClick={() => fileRef.current?.click()}>Ảnh</button>
      <button type="button" className={button} onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run()}>Bảng</button>
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) addImage(file).catch(err => window.alert(err.message)); event.target.value = ''; }} />
    </div>
    <EditorContent editor={editor} className="rich-editor-content min-h-[360px] p-4 text-sm leading-7 text-white/90" />
  </div>;
}