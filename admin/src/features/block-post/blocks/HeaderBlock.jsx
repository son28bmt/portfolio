import { AlignLeft } from 'lucide-react';

export default function HeaderBlock({ block }) {
  return (
    <div className="bp-header-block">
      <span className="bp-block-eyebrow"><AlignLeft size={13} /> HEADER</span>
      <h2>{block.props.title || 'Tiêu đề bài viết'}</h2>
      <p>Tiêu đề và phần mở đầu của bài viết</p>
    </div>
  );
}