export default function QuestionBlock({ block, template }) {
  return <div className="bp-question-block">
    <strong>{block.props?.heading || 'Câu hỏi cuối bài'}</strong>
    <p>{template?.name || 'Chưa chọn bộ câu hỏi'}</p>
    {template?.fields?.map((field) => <small key={field.key} className="block">{field.label}{field.required ? ' *' : ''}</small>)}
  </div>;
}