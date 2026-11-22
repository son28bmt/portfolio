import { PanelBottom } from 'lucide-react';
import RichEditor from '../../../components/RichEditor/RichEditor';

export default function FooterBlock({ block, onChange, onContentChange, editable = true, align = 'left' }) {
  const justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <div className="bp-footer-block" style={{ justifyContent, textAlign: align }}>
      <span className="bp-block-eyebrow"><PanelBottom size={13} /> FOOTER</span>
      <RichEditor
        value={block.props.text || ''}
        onChange={(content) => { onChange({ text: content }); onContentChange?.({ kind: 'richText', html: content }); }}
        folder="cms/layout-posts"
        disabled={!editable}
      />
    </div>
  );
}