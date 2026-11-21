import { syncCheckboxSelections } from '@layout-post-renderer/syncCheckboxSelections';

export default function CheckboxBlock({ block, content, onContentChange }) {
  const selections = syncCheckboxSelections(block.props?.options, content?.selections, block.props?.allowMultiple);
  const change = (label, checked) => {
    const next = selections.map((item) => ({ ...item, checked: block.props?.allowMultiple ? (item.label === label ? checked : item.checked) : item.label === label ? checked : false }));
    onContentChange({ kind: 'checkbox', selections: syncCheckboxSelections(block.props?.options, next, block.props?.allowMultiple) });
  };
  return <div className="bp-checkbox-block"><p>Hộp kiểm</p>{selections.map((item) => <label key={item.label}><input type="checkbox" checked={item.checked} onChange={(event) => change(item.label, event.target.checked)} />{item.label}</label>)}</div>;
}