import { useEffect, useState } from 'react';
import { useBlockPostStore } from '../store/useBlockPostStore';
import { layoutPostApi } from '../api/layoutPostApi';

const input = 'bp-field';
const normalizeOptions = (text) => String(text || '').split('\n').map((item) => item.trim()).filter(Boolean);

export default function BlockSpecificProperties({ block, updateBlock, onNotice }) {
  const [optionText, setOptionText] = useState((block.props?.options || []).join('\n'));
  const [questionTemplates, setQuestionTemplates] = useState([]);
  const setValidationError = useBlockPostStore((state) => state.setBlockValidationError);
  useEffect(() => { setOptionText((block.props?.options || []).join('\n')); setValidationError(block.id, null); }, [block.id, setValidationError]);
  useEffect(() => {
    if (block.type !== 'question') return;
    layoutPostApi.questionTemplates().then(setQuestionTemplates).catch(() => setQuestionTemplates([]));
  }, [block.type]);
  const update = (props) => updateBlock(block.id, { props });
  const commitOptions = (nextText) => {
    const options = normalizeOptions(nextText);
    if (options.length > 10 || options.some((option) => option.length > 100) || new Set(options).size !== options.length || ((block.type === 'checkbox') && !options.length)) {
      const error = 'Mỗi lựa chọn cần khác nhau, dài 1–100 ký tự; tối đa 10 mục.';
      setValidationError(block.id, error);
      onNotice(error);
      return;
    }
    setValidationError(block.id, null);
    update({ options });
  };
  if (block.type === 'question') return <>
    <label className={input}>Bộ câu hỏi<select value={block.props.templateId || ''} onChange={(event) => update({ templateId: event.target.value || undefined })}><option value="">Chưa chọn</option>{questionTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
    <label className={input}>Tiêu đề khu vực<input maxLength={100} value={block.props.heading || ''} onChange={(event) => update({ heading: event.target.value })} /></label>
    <div className="bp-field">{questionTemplates.find((template) => template.id === block.props.templateId)?.fields?.map((field) => <p key={field.key}>{field.label}{field.required ? ' *' : ''} · {field.type}</p>) || <span>Chưa chọn bộ câu hỏi</span>}</div>
  </>;
  if (block.type === 'checkbox') return <>
    <label className={input}>Lựa chọn <span>mỗi dòng một mục</span><textarea value={optionText} onChange={(event) => setOptionText(event.target.value)} onBlur={(event) => commitOptions(event.target.value)} /></label>
    <label className="bp-switch"><input type="checkbox" checked={block.props.allowMultiple !== false} onChange={(event) => update({ allowMultiple: event.target.checked })} />Cho phép chọn nhiều</label>
  </>;
  if (block.type === 'image') return <>
    <label className={input}>Cách hiển thị<select value={block.props.fit || 'cover'} onChange={(event) => update({ fit: event.target.value })}><option value="cover">Cover</option><option value="contain">Contain</option></select></label>
    <label className={input}>Tỷ lệ<select value={block.props.ratio || 'free'} onChange={(event) => update({ ratio: event.target.value })}><option value="free">Tự do</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option></select></label>
    <label className={input}>Bo góc (px)<input type="number" min="0" max="100" value={block.props.borderRadius ?? 8} onChange={(event) => update({ borderRadius: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /></label>
  </>;
  if (block.type === 'video') return <>
    <label className={input}>Tỷ lệ<select value={block.props.ratio || '16:9'} onChange={(event) => update({ ratio: event.target.value })}><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option></select></label>
    <label className="bp-switch"><input type="checkbox" checked={Boolean(block.props.autoplay)} onChange={(event) => update({ autoplay: event.target.checked })} />Tự phát (luôn tắt tiếng)</label>
    <label className="bp-switch"><input type="checkbox" checked={block.props.controls !== false} onChange={(event) => update({ controls: event.target.checked })} />Hiện điều khiển</label>
  </>;
  return null;
}