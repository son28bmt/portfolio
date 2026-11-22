import { AlignLeft } from 'lucide-react';
import RichEditor from '../../../components/RichEditor/RichEditor';

export default function HeaderBlock({ block, onChange, onContentChange, editable = true, align = 'left' }) {
  return (
    <div className="bp-header-block" style={{ textAlign: align }}>
      <span className="bp-block-eyebrow"><AlignLeft size={13} /> HEADER</span>
      <RichEditor
        value={block.props.title || ''}
        onChange={(content) => { onChange({ title: content }); onContentChange?.({ kind: 'richText', html: content }); }}
        folder="cms/layout-posts"
        disabled={!editable}
      />
    </div>
  );
}