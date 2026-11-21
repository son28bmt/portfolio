import { PanelBottom } from 'lucide-react';

export default function FooterBlock({ block }) {
  return (
    <div className="bp-footer-block">
      <PanelBottom size={16} />
      <span>{block.props.text || 'Thông tin cuối bài'}</span>
    </div>
  );
}