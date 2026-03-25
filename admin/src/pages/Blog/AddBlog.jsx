import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Save, Image as ImageIcon, Tag, Clock } from 'lucide-react';

const AddBlog = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    tags: '',
    readTime: '5 min',
    image: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tagsArray = formData.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await api.post('/blog', {
        ...formData,
        tags: tagsArray,
        date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }),
      });
      navigate('/blog');
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold">Viết bài mới</h1>
          <p className="text-white/40">Chia sẻ câu chuyện và kiến thức của bạn.</p>
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
              placeholder="Ví dụ: Cách tôi xây dựng Portfolio với AI..."
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
                  placeholder="AI, NodeJS, Web..."
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
                  placeholder="5 min"
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
              placeholder="Một vài dòng giới thiệu ngắn gọn về bài viết..."
            ></textarea>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase ml-1">Nội dung bài viết</label>
            <div className="quill-container glass rounded-2xl overflow-hidden min-h-[400px]">
              <ReactQuill
                theme="snow"
                value={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link', 'image', 'code-block'],
                    ['clean'],
                  ],
                }}
                className="text-white h-full"
                placeholder="Viết nội dung tại đây... Bạn có thể thêm ảnh, định dạng chữ và chèn link cực kỳ dễ dàng."
              />
            </div>
          </div>
        </div>

        <div className="glass p-8 rounded-[32px] space-y-6">
          <h3 className="font-bold flex items-center gap-2"><ImageIcon className="w-4 h-4 text-secondary" /> Hình ảnh tiêu đề</h3>
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
            {loading ? 'Đang lưu...' : 'Đăng bài viết'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddBlog;
