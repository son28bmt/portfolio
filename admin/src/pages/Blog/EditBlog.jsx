import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Save, Image as ImageIcon, Tag, Clock, Upload } from 'lucide-react';

const decodePossibleJson = (value) => {
  let current = value;

  for (let i = 0; i < 4; i += 1) {
    if (typeof current !== 'string') break;
    const text = current.trim();
    if (!text) return '';
    if (!['[', '{', '"'].includes(text[0])) break;

    try {
      current = JSON.parse(text);
    } catch {
      break;
    }
  }

  return current;
};

const normalizeTagsForInput = (tags) => {
  const decoded = decodePossibleJson(tags);

  if (Array.isArray(decoded)) {
    return decoded.map((tag) => String(tag || '').trim()).filter(Boolean).join(', ');
  }

  if (typeof decoded === 'string') {
    const text = decoded.trim();
    if (!text) return '';
    if (text.includes(',')) {
      return text
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(', ');
    }
    return text;
  }

  return '';
};

const EditBlog = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const quillRef = useRef(null);
  const coverInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    tags: '',
    readTime: '',
    image: '',
  });

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const { data } = await api.get(`/blog/${id}`);
        setFormData({
          ...data,
          tags: normalizeTagsForInput(data.tags),
        });
      } catch (err) {
        alert('Lỗi khi tải bài viết: ' + err.message);
        navigate('/blog');
      } finally {
        setFetching(false);
      }
    };

    fetchBlog();
  }, [id, navigate]);

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
      const [url] = await uploadToCloudflareR2([file], 'blogs/cover');
      if (url) {
        setFormData((prev) => ({ ...prev, image: url }));
      }
    } catch (err) {
      alert('Tải ảnh đại diện thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingCover(false);
      if (event.target) event.target.value = '';
    }
  };

  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      try {
        const [url] = await uploadToCloudflareR2([file], 'blogs/content');
        if (url) {
          const quill = quillRef.current.getEditor();
          const range = quill.getSelection(true);
          quill.insertEmbed(range?.index || 0, 'image', url);
        }
      } catch (err) {
        alert('Tải ảnh nội dung thất bại: ' + (err.response?.data?.message || err.message));
      }
    };
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image', 'code-block'],
        ['clean'],
      ],
      handlers: {
        image: imageHandler,
      },
    },
  }), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tagsArray = formData.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await api.put(`/blog/${id}`, {
        ...formData,
        tags: tagsArray,
      });
      navigate('/blog');
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/blog')}
          className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold">Chỉnh sửa bài viết</h1>
          <p className="text-white/40">Cập nhật nội dung cho bài blog của bạn.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 pb-20">
        <div className="glass p-8 rounded-[32px] space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase ml-1">Tiêu đề bài viết</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-secondary transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Thẻ (cách nhau bởi dấu phẩy)</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-secondary transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Thời gian đọc</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  value={formData.readTime}
                  onChange={(e) => setFormData({ ...formData, readTime: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-secondary transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase ml-1">Mô tả tóm tắt</label>
            <textarea
              rows="3"
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-secondary transition-all resize-none"
            ></textarea>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase ml-1">Nội dung bài viết</label>
            <div className="quill-container glass rounded-2xl overflow-hidden min-h-[400px]">
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
                modules={modules}
                className="text-white h-full"
                placeholder="Viết nội dung tại đây... Ảnh dán vào hoặc upload sẽ tự động lưu lên Cloudflare R2 để tải nhanh hơn."
              />
            </div>
          </div>
        </div>

        <div className="glass p-8 rounded-[32px] space-y-6">
          <h3 className="font-bold flex items-center gap-2"><ImageIcon className="w-4 h-4 text-secondary" /> Hình ảnh tiêu đề</h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Link ảnh</label>
              <input
                type="text"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-secondary transition-all"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 uppercase ml-1">Hoặc tải ảnh từ máy</label>
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
                className="w-full px-4 py-3 rounded-2xl border border-secondary/30 bg-secondary/10 hover:bg-secondary/20 transition-all text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploadingCover ? 'Đang tải ảnh...' : 'Chọn ảnh đại diện'}
              </button>
            </div>

            {formData.image && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-white/40 uppercase">Ảnh đại diện hiện tại</p>
                <img
                  src={formData.image}
                  alt="Ảnh đại diện"
                  className="w-full max-h-48 object-cover rounded-2xl border border-white/10"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/blog')}
            className="px-8 py-4 text-white/60 font-medium hover:text-white transition-all"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-10 py-4 bg-secondary text-white rounded-2xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all glow-blue disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditBlog;
