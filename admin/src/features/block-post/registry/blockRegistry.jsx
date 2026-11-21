import { AlignLeft, CheckSquare, CircleHelp, Image, PanelBottom, Type, Video } from 'lucide-react';
import HeaderBlock from '../blocks/HeaderBlock';
import TextBlock from '../blocks/TextBlock';
import FooterBlock from '../blocks/FooterBlock';
import QuestionBlock from '../blocks/QuestionBlock';
import CheckboxBlock from '../blocks/CheckboxBlock';
import ImageBlock from '../blocks/ImageBlock';
import VideoBlock from '../blocks/VideoBlock';

export const blockRegistry = {
  header: { label: 'Header', description: 'Tiêu đề và mở đầu', icon: Type, component: HeaderBlock },
  text: { label: 'Text', description: 'Nội dung rich text', icon: AlignLeft, component: TextBlock },
  footer: { label: 'Footer', description: 'Kết bài và ghi chú', icon: PanelBottom, component: FooterBlock },
  question: { label: 'Câu hỏi', description: 'Câu hỏi và câu trả lời', icon: CircleHelp, component: QuestionBlock },
  checkbox: { label: 'Hộp kiểm', description: 'Nhiều lựa chọn', icon: CheckSquare, component: CheckboxBlock },
  image: { label: 'Hình ảnh', description: 'Ảnh và mô tả', icon: Image, component: ImageBlock },
  video: { label: 'Video', description: 'YouTube, Vimeo, MP4', icon: Video, component: VideoBlock },
};