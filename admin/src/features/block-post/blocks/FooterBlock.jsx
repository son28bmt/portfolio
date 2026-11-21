import { PanelBottom } from 'lucide-react';

export default function FooterBlock({ block, align = 'left' }) {
  const justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <div className="bp-footer-block" style={{ justifyContent, textAlign: align }}>
      <PanelBottom size={16} />
      <span>{block.props.text || 'Thông tin cuối bài'}</span>
    </div>
  );
}