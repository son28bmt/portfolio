import RichEditor from '../../../components/RichEditor/RichEditor';

export default function TextBlock({ block, onChange, editable = true }) {
  return (
    <div className="bp-text-block" onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
      <RichEditor
        value={block.props.content || ''}
        onChange={(content) => onChange({ content })}
        folder="cms/layout-posts"
        disabled={!editable}
      />
    </div>
  );
}