import { HeaderBlock, TextBlock, FooterBlock, QuestionBlock, CheckboxBlock, ImageBlock, VideoBlock } from './RendererBlocks';
import './renderer.css';
import { getGridItemStyle, orderMobileBlocks } from './rendererUtils';
import { ROW_HEIGHT } from './constants';

const components = { header: HeaderBlock, text: TextBlock, footer: FooterBlock, question: QuestionBlock, checkbox: CheckboxBlock, image: ImageBlock, video: VideoBlock };

export default function BlockPostRenderer({ layout = [], content = {}, slots = {} }) {
  const blocks = orderMobileBlocks(layout);
  return <main className="lpr-root"><div className="lpr-grid" style={{ '--lpr-row-height': `${ROW_HEIGHT}px` }}>{blocks.map((block) => { const Component = components[block.type]; if (!Component) return null; const slot = block.type === 'question' ? slots.question : null; return <section key={block.id} data-block-id={block.id} data-block-type={block.type} className="lpr-block" style={{ ...getGridItemStyle(block), '--lpr-x': block.x + 1, '--lpr-w': block.w, '--lpr-y': block.y + 1, '--lpr-h': block.h }}>{slot ? slot({ block, props: block.props }) : <Component block={block} content={content[block.id]} />}</section>; })}</div></main>;
}