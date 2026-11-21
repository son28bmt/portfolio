import { AlignLeft, PanelBottom, Type } from 'lucide-react';
import HeaderBlock from '../blocks/HeaderBlock';
import TextBlock from '../blocks/TextBlock';
import FooterBlock from '../blocks/FooterBlock';

export const blockRegistry = {
  header: { label: 'Header', description: 'Tiêu đề và mở đầu', icon: Type, component: HeaderBlock },
  text: { label: 'Text', description: 'Nội dung rich text', icon: AlignLeft, component: TextBlock },
  footer: { label: 'Footer', description: 'Kết bài và ghi chú', icon: PanelBottom, component: FooterBlock },
};