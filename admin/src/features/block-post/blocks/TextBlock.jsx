import RichEditor from '../../../components/RichEditor/RichEditor';

export default function TextBlock({ block, onChange, onContentChange, editable = true, align = 'left' }) {
  return (
    <div className="bp-text-block" style={{ textAlign: align }}>
      <RichEditor
        value={block.props.content || ''}
        onChange={(content) => { onChange({ content }); onContentChange?.({ kind: 'richText', html: content }); }}
        folder="cms/layout-posts"
        disabled={!editable}
      />
    </div>
  );
}