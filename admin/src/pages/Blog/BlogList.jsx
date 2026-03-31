import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { 
  FileText, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Calendar,
  Clock
} from 'lucide-react';

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const BlogList = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPosts(page);
  }, [page]);

  const fetchPosts = async (pageNum = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/blog', { params: { page: pageNum, limit: 10 } });
      const items = Array.isArray(data.items) ? data.items : [];
      setPosts(items);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Lỗi khi tải bài viết:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc muốn xóa bài viết này?')) {
      try {
        await api.delete(`/blog/${id}`);
        // If current page is now empty and not page 1, go back one page
        if (posts.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          fetchPosts(page);
        }
      } catch (err) {
        alert('Lỗi khi xóa: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <FileText className="text-secondary" /> Bài viết Blog
          </h1>
          <p className="text-white/40">Chia sẻ kiến thức và cập nhật mới nhất.</p>
        </div>
        <Link 
          to="/blog/add" 
          className="px-6 py-3 bg-secondary text-white rounded-2xl font-bold flex items-center gap-2 hover:scale-[1.02] transition-all glow-blue"
        >
          <Plus className="w-5 h-5" /> Viết bài mới
        </Link>
      </div>

      <div className="glass rounded-[32px] overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5 flex items-center gap-4">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text" 
              placeholder="Tìm kiếm bài viết..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-sm focus:outline-none focus:border-secondary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-white/40 font-bold border-b border-white/5">
                <th className="px-8 py-4">Tiêu đề</th>
                <th className="px-8 py-4">Ngày đăng</th>
                <th className="px-8 py-4">Thẻ</th>
                <th className="px-8 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan="4" className="px-8 py-20 text-center text-white/20">Đang tải dữ liệu...</td></tr>
              ) : posts.length > 0 ? posts.map((post) => {
                const tags = parseJsonArray(post.tags);

                return (
                <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
                        {post.image ? (
                          <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10 text-xs">IMG</div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm tracking-tight line-clamp-1">{post.title}</p>
                        <p className="text-[10px] text-white/20 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {post.readTime || '5 min'} read
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs text-white/60 flex items-center gap-2">
                       <Calendar className="w-3 h-3" /> {post.date || new Date().toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex gap-1 flex-wrap">
                      {tags.map((t, i) => (
                        <span key={i} className="text-[10px] text-secondary bg-secondary/10 px-2 py-0.5 rounded-md font-bold">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/blog/edit/${post.id}`} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all">
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={() => handleDelete(post.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-white/40 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              }) : (
                <tr><td colSpan="4" className="px-8 py-20 text-center text-white/20">Chưa có bài viết nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 bg-white/5 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-white/40 font-medium">Trang {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                Trước
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogList;
