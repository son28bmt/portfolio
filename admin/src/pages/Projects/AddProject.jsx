import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api';
import { ArrowLeft, Save, Image as ImageIcon, Github, Globe, Upload, X, Download } from 'lucide-react';

const AddProject = () => {
  const navigate = useNavigate();
  const coverInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const apkInputRef = useRef(null);
  const iosInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [uploadingIos, setUploadingIos] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Web',
    tech: '',
    github: '',
    demo: '',
    image: '',
    images: [],
    apkUrl: '',
    iosUrl: '',
  });

  const uploadToCloudflareR2 = async (files, folder) => {
    const payload = new FormData();
    Array.from(files).forEach((file) => payload.append('files', file));
    payload.append('folder', folder);

    const { data } = await api.post('/projects/upload-images', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return Array.isArray(data?.urls) ? data.urls : [];
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const [url] = await uploadToCloudflareR2([file], 'projects/cover');
      if (url) {
        setFormData((prev) => {
          const mergedImages = [...new Set([url, ...(prev.images || [])])];
          return { ...prev, image: url, images: mergedImages };
        });
      }
    } catch (err) {
      alert('Tải ảnh đại diện thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingCover(false);
      event.target.value = '';
    }
  };

  const handleGalleryUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    try {
      const urls = await uploadToCloudflareR2(files, 'projects/gallery');
      if (urls.length > 0) {
        setFormData((prev) => {
          const mergedImages = [...new Set([...(prev.images || []), ...urls])];
          const coverImage = prev.image || mergedImages[0] || '';
          return { ...prev, images: mergedImages, image: coverImage };
        });
      }
    } catch (err) {
      alert('Tải bộ ảnh dự án thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingGallery(false);
      event.target.value = '';
    }
  };

  const handleAppUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (type === 'apk') setUploadingApk(true);
    else setUploadingIos(true);

    try {
      const folder = type === 'apk' ? 'projects/apps/android' : 'projects/apps/ios';
      
      // 1. Get presigned URL from backend
      const { data } = await api.get('/projects/get-upload-url', {
        params: {
          fileName: file.name,
          mimeType: file.type || (type === 'apk' ? 'application/vnd.android.package-archive' : 'application/octet-stream'),
          folder
        }
      });

      const { uploadUrl, publicUrl } = data;

      // 2. Upload directly to Cloudflare R2
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type || (type === 'apk' ? 'application/vnd.android.package-archive' : 'application/octet-stream'),
          'Content-Disposition': `attachment; filename="${file.name}"`
        }
      });

      setFormData(prev => ({ ...prev, [`${type}Url`]: publicUrl }));
    } catch (err) {
      console.error('❌ App Upload Error:', err);
      alert(`Tải file ${type.toUpperCase()} thất bại: ` + (err.response?.data?.message || err.message));
    } finally {
      if (type === 'apk') setUploadingApk(false);
      else setUploadingIos(false);
      event.target.value = '';
    }
  };

  const removeImage = (url) => {
    setFormData((prev) => {
      const nextImages = (prev.images || []).filter((item) => item !== url);
      const nextCover = prev.image === url ? (nextImages[0] || '') : prev.image;
      return { ...prev, images: nextImages, image: nextCover };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const techArray = formData.tech.split(',').map((t) => t.trim()).filter(Boolean);
      const galleryImages = Array.isArray(formData.images)
        ? formData.images.filter(Boolean)
        : [];
      const coverImage = (formData.image || galleryImages[0] || '').trim();
      const mergedImages = [...new Set([coverImage, ...galleryImages].filter(Boolean))];

      await api.post('/projects', {
        ...formData,
        tech: techArray,
        image: coverImage,
        images: mergedImages,
      });
      navigate('/projects');
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const categories = ['Web', 'Tool', 'Mobile', 'AI', 'UI/UX'];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/projects')}
          className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold">Thêm dự án mới</h1>
          <p className="text-white/40">Điền thông tin chi tiết về dự án của bạn.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 pb-20">
        {/* Main Info */}
        <div className="glass p-8 rounded-[32px] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Tên dự án</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-primary transition-all"
                placeholder="Ví dụ: AI Subtitle Gen"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Danh mục</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="admin-select"
              >
                {categories.map(c => <option key={c} value={c} className="bg-surface">{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase ml-1">Mô tả</label>
            <textarea 
              rows="4"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-primary transition-all resize-none"
              placeholder="Mô tả tóm tắt về dự án..."
              required
            ></textarea>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase ml-1">Công nghệ (cách nhau bởi dấu phẩy)</label>
            <input 
              type="text" 
              value={formData.tech}
              onChange={(e) => setFormData({...formData, tech: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-primary transition-all"
              placeholder="React, NodeJS, PostgreSQL..."
              required
            />
          </div>
        </div>

        {/* Media & Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass p-8 rounded-[32px] space-y-6">
            <h3 className="font-bold flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" /> Hình ảnh</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Link ảnh đại diện</label>
              <input 
                type="text" 
                value={formData.image}
                onChange={(e) => setFormData({...formData, image: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-primary transition-all"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Tải ảnh đại diện từ máy</label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverUpload}
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="w-full px-4 py-3 rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-all text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploadingCover ? 'Đang tải ảnh đại diện...' : 'Chọn ảnh đại diện'}
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Ảnh dự án (nhiều ảnh)</label>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGalleryUpload}
              />
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploadingGallery}
                className="w-full px-4 py-3 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 transition-all text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploadingGallery ? 'Đang tải bộ ảnh dự án...' : 'Chọn ảnh dự án'}
              </button>
            </div>

            {formData.image && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-white/40 uppercase">Ảnh đại diện hiện tại</p>
                <img
                  src={formData.image}
                  alt="Ảnh đại diện dự án"
                  className="w-full h-36 object-cover rounded-2xl border border-white/10"
                />
              </div>
            )}

            {formData.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-white/40 uppercase">Bộ ảnh dự án</p>
                <div className="grid grid-cols-3 gap-2">
                  {formData.images.map((url) => (
                    <div key={url} className="relative group rounded-xl overflow-hidden border border-white/10">
                      <img src={url} alt="Ảnh dự án" className="w-full h-20 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="glass p-8 rounded-[32px] space-y-6">
            <h3 className="font-bold flex items-center gap-2"><Globe className="w-4 h-4 text-secondary" /> Liên kết</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Github className="w-4 h-4 text-white/20" />
                  <label className="text-[10px] font-bold text-white/40 uppercase">GitHub Repo</label>
                </div>
                <input 
                  type="text" 
                  value={formData.github}
                  onChange={(e) => setFormData({...formData, github: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-2 px-4 text-xs focus:outline-none focus:border-primary transition-all"
                  placeholder="https://github.com/..."
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-white/20" />
                  <label className="text-[10px] font-bold text-white/40 uppercase">Live Demo</label>
                </div>
                <input 
                  type="text" 
                  value={formData.demo}
                  onChange={(e) => setFormData({...formData, demo: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-2 px-4 text-xs focus:outline-none focus:border-primary transition-all"
                  placeholder="https://..."
                />
              </div>

              {/* Mobile Apps Section */}
              <div className="pt-4 border-t border-white/5 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Mobile Downloads (APK/iOS)</h4>
                
                {/* APK */}
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Android (APK) URL</label>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       value={formData.apkUrl}
                       onChange={(e) => setFormData({...formData, apkUrl: e.target.value})}
                       className="flex-grow bg-white/5 border border-white/10 rounded-2xl py-2 px-4 text-xs focus:outline-none focus:border-primary transition-all"
                       placeholder="https://...apk"
                     />
                     <input ref={apkInputRef} type="file" accept=".apk" className="hidden" onChange={(e) => handleAppUpload(e, 'apk')} />
                     <button 
                       type="button" 
                       onClick={() => apkInputRef.current?.click()}
                       disabled={uploadingApk}
                       className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-50"
                     >
                        <Upload className="w-4 h-4" />
                     </button>
                   </div>
                   {uploadingApk && <div className="text-[10px] text-primary animate-pulse font-bold uppercase">Đang tải APK...</div>}
                </div>

                {/* ISO/IPA */}
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-white/40 uppercase ml-1">iOS (IPA) URL</label>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       value={formData.iosUrl}
                       onChange={(e) => setFormData({...formData, iosUrl: e.target.value})}
                       className="flex-grow bg-white/5 border border-white/10 rounded-2xl py-2 px-4 text-xs focus:outline-none focus:border-primary transition-all"
                       placeholder="https://...ipa"
                     />
                     <input ref={iosInputRef} type="file" accept=".ipa,.ios" className="hidden" onChange={(e) => handleAppUpload(e, 'ios')} />
                     <button 
                       type="button" 
                       onClick={() => iosInputRef.current?.click()}
                       disabled={uploadingIos}
                       className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-50"
                     >
                        <Upload className="w-4 h-4" />
                     </button>
                   </div>
                   {uploadingIos && <div className="text-[10px] text-secondary animate-pulse font-bold uppercase">Đang tải IPA...</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/projects')}
            className="px-8 py-4 text-white/60 font-medium hover:text-white transition-all"
          >
            Hủy bỏ
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="px-10 py-4 bg-primary text-white rounded-2xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all glow disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Đang lưu...' : 'Lưu dự án'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProject;
