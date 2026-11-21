import { Video } from 'lucide-react';
import { directVideoUrl, safeUrl, videoEmbedUrl } from '@layout-post-renderer/media';

export default function VideoBlock({ block, content, onContentChange }) {
  const url = content?.url || '';
  const embedUrl = videoEmbedUrl(url);
  const directVideo = directVideoUrl(url);
  const valid = !url || embedUrl || directVideo;
  const updateUrl = (nextUrl) => onContentChange({ kind: 'video', url: safeUrl(nextUrl), poster: content?.poster || '' });
  return <div className={`bp-video-block bp-ratio-${String(block.props?.ratio || '16:9').replace(':', '-')}`}>
    {!url && <div className="bp-media-placeholder"><Video size={23} />Dán URL YouTube, Vimeo, MP4 hoặc WebM</div>}
    {embedUrl && <iframe src={embedUrl} title="Video preview" sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowFullScreen />}
    {directVideo && <video src={url} poster={content?.poster || undefined} controls={block.props?.controls !== false} muted autoPlay={Boolean(block.props?.autoplay)} />}
    <div className="bp-media-fields"><input value={url} placeholder="https://youtube.com/... hoặc video.mp4" onChange={(event) => updateUrl(event.target.value)} /><input value={content?.poster || ''} placeholder="URL poster (tùy chọn)" onChange={(event) => onContentChange({ kind: 'video', url, poster: safeUrl(event.target.value) })} /></div>
    {!valid && <span className="bp-media-error">Chỉ hỗ trợ YouTube, Vimeo, MP4 hoặc WebM an toàn.</span>}
  </div>;
}