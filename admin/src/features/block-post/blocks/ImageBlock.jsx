import { useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { uploadCmsImage } from '../../../services/cmsUploadService';
import { safeUrl } from '@layout-post-renderer/media';

export default function ImageBlock({ block, content, onContentChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const imageUrl = content?.url || '';
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true); setError('');
    try { onContentChange({ kind: 'image', url: await uploadCmsImage(file, 'cms/layout-posts'), alt: content?.alt || '' }); }
    catch (uploadError) { setError(uploadError.message || 'Không thể tải ảnh.'); }
    finally { setLoading(false); event.target.value = ''; }
  };
  const updateUrl = (url) => {
    if (url && !safeUrl(url)) { setError('URL ảnh chỉ được http/https hoặc đường dẫn upload nội bộ.'); return; }
    setError(''); onContentChange({ kind: 'image', url, alt: content?.alt || '' });
  };
  return <div className={`bp-image-block bp-ratio-${String(block.props?.ratio || 'free').replace(':', '-')}`} style={{ borderRadius: `${block.props?.borderRadius ?? 8}px` }}>
    {imageUrl ? <img src={imageUrl} alt={content?.alt || ''} style={{ objectFit: block.props?.fit || 'cover' }} onError={() => setError('Không tải được ảnh.')} /> : <label className="bp-media-placeholder"><ImagePlus size={23} />Chọn ảnh hoặc dán URL<input type="file" accept="image/*" hidden onChange={upload} /></label>}
    <div className="bp-media-fields"><input value={imageUrl} placeholder="https://..." onChange={(event) => updateUrl(event.target.value)} /><input value={content?.alt || ''} placeholder="Mô tả ảnh" onChange={(event) => onContentChange({ kind: 'image', url: imageUrl, alt: event.target.value })} /></div>
    {loading && <span className="bp-media-loading"><Loader2 size={14} className="bp-spin" />Đang tải ảnh...</span>}{error && <span className="bp-media-error">{error}</span>}
  </div>;
}