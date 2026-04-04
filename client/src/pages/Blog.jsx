import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Search, Calendar, Clock, ArrowUpRight, Hash } from 'lucide-react';

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

const parseTags = (value) => {
  const decoded = decodePossibleJson(value);

  if (Array.isArray(decoded)) {
    return decoded.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof decoded === 'string') {
    const text = decoded.trim();
    if (!text) return [];
    return text.includes(',')
      ? text.split(',').map((item) => item.trim()).filter(Boolean)
      : [text];
  }

  return [];
};

const Blog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/blog', { params: { page, limit: 9 } });
        const items = Array.isArray(data.items) ? data.items : [];
        const normalized = items.map((post) => ({ ...post, normalizedTags: parseTags(post.tags) }));
        
        setPosts(normalized);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        console.error('Lỗi khi tải blog:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [page]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return posts;

    return posts.filter((post) => {
      const titleMatch = post.title?.toLowerCase().includes(query);
      const tagMatch = (post.normalizedTags || []).some((tag) => tag.toLowerCase().includes(query));
      return titleMatch || tagMatch;
    });
  }, [posts, searchQuery]);

  return (
    <div className="py-12 max-w-6xl mx-auto px-4 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="max-w-xl text-center md:text-left"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Blog & Chia sẻ</h1>
          <p className="text-white/50 text-base md:text-lg">
            Nơi tôi chia sẻ về hành trình lập trình, các bài học kinh nghiệm và những phát hiện thú vị trong thế giới công nghệ.
          </p>
        </motion.div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            type="text"
            placeholder="Tìm kiếm bài viết..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-white/40 animate-pulse">Đang tải bài viết...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {filteredPosts.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group glass rounded-3xl overflow-hidden flex flex-col hover:border-secondary/30 transition-all hover:-translate-y-1"
            >
              <Link to={`/blog/${post.slug || post.id}`} className="block">
                <div className="h-48 overflow-hidden relative">
                  <img
                    src={post.image || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop'}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

                  <div className="absolute bottom-4 left-4 flex gap-2 flex-wrap pr-4">
                    {(post.normalizedTags || []).map((tag) => (
                      <span key={tag} className="text-[10px] font-bold px-2 py-1 bg-white/10 backdrop-blur-md rounded-lg text-white/80 border border-white/10">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-6 flex-grow flex flex-col">
                  <div className="flex items-center gap-4 text-[10px] text-white/40 font-bold uppercase tracking-widest mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(post.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {post.readTime || '5 min read'}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold mb-3 group-hover:text-secondary transition-colors line-clamp-2">
                    {post.title}
                  </h3>

                  <p className="text-white/50 text-sm leading-relaxed mb-6 line-clamp-3">
                    {post.excerpt}
                  </p>

                  <div className="mt-auto pt-4 border-t border-white/5">
                    <span className="flex items-center gap-2 text-sm font-bold text-white/80 hover:text-secondary transition-colors group/btn">
                      Đọc tiếp
                      <ArrowUpRight className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-16 pt-8 border-t border-white/5">
          <button
            disabled={page === 1}
            onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Trước
          </button>
          
          <div className="flex items-center gap-2">
            {[...Array(totalPages)].map((_, i) => {
              const p = i + 1;
              // Chỉ hiển thị vài trang đầu, cuối và quanh trang hiện tại nếu quá nhiều trang
              if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - page) > 1) {
                if (p === 2 || p === totalPages - 1) return <span key={p} className="text-white/20">...</span>;
                return null;
              }
              return (
                <button
                  key={p}
                  onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                    page === p ? 'bg-primary text-white glow' : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            disabled={page >= totalPages}
            onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Sau →
          </button>
        </div>
      )}

      {!loading && filteredPosts.length === 0 && (
        <div className="py-20 text-center">
          <Hash className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/50">Không tìm thấy bài viết nào phù hợp.</p>
        </div>
      )}
    </div>
  );
};

export default Blog;
