import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import { Calendar, Clock, ArrowLeft, Share2, MessageCircle } from 'lucide-react';

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
    return text
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeBlogContent = (rawContent) => {
  if (typeof rawContent !== 'string' || !rawContent.trim()) return '';
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return rawContent;

  try {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(rawContent, 'text/html');
    const widthRelatedProps = new Set(['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height']);

    doc.body.querySelectorAll('[style]').forEach((element) => {
      const styleText = element.getAttribute('style') || '';

      const cleanedRules = styleText
        .split(';')
        .map((rule) => rule.trim())
        .filter(Boolean)
        .filter((rule) => {
          const [rawProp, rawValue = ''] = rule.split(':');
          const prop = rawProp?.trim().toLowerCase();
          const value = rawValue.trim().toLowerCase();
          if (!prop) return false;

          if (widthRelatedProps.has(prop)) return false;

          if (prop === 'font-size') {
            const pxValue = Number.parseFloat(value);
            if (value.endsWith('px') && Number.isFinite(pxValue) && pxValue < 14) {
              return false;
            }
          }

          return true;
        });

      if (cleanedRules.length > 0) {
        element.setAttribute('style', cleanedRules.join('; '));
      } else {
        element.removeAttribute('style');
      }
    });

    doc.body.querySelectorAll('img, video, iframe').forEach((media) => {
      media.removeAttribute('width');
      media.removeAttribute('height');
      media.removeAttribute('sizes');
    });

    return doc.body.innerHTML;
  } catch (error) {
    console.warn('Không chuẩn hóa được nội dung blog, dùng raw content:', error);
    return rawContent;
  }
};

const BlogDetail = () => {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [featureNotice, setFeatureNotice] = useState('');
  const [guideSuggestions, setGuideSuggestions] = useState([]);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data } = await api.get(`/blog/${id}`);
        setPost(data);
      } catch (err) {
        console.error('Lỗi khi tải bài viết:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  useEffect(() => {
    api.get('/guides', { params: { limit: 3 } }).then(({ data }) => setGuideSuggestions(data.items || [])).catch(() => setGuideSuggestions([]));
  }, []);

  const tags = useMemo(() => parseTags(post?.tags), [post?.tags]);
  const normalizedContent = useMemo(() => normalizeBlogContent(post?.content), [post?.content]);
  
  // SEO Meta
  const siteUrl = 'https://nguyenquangson.id.vn';
  const pageTitle = post ? `${post.title} | Blog Nguyễn Quang Sơn` : 'Đang tải bài viết...';
  const pageDesc = post ? (post.description || post.title) : 'Đọc bài viết mới nhất từ Nguyễn Quang Sơn.';
  const canonicalUrl = `${siteUrl}/blog/${id}`;

  const showFeatureNotice = (message) => {
    setFeatureNotice(message);
    window.setTimeout(() => {
      setFeatureNotice('');
    }, 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Không tìm thấy bài viết</h2>
        <p className="text-white/50 mb-8">Có vẻ như bài viết này không tồn tại hoặc đã bị xóa.</p>
        <Link to="/blog" className="px-8 py-3 bg-primary text-white rounded-xl font-bold">Quay lại Blog</Link>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-10 md:py-12 max-w-7xl mx-auto px-3 sm:px-4 blog-page-shell grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
      <aside className="hidden lg:block"><div className="sticky top-24 space-y-3"><h2 className="text-xs font-bold uppercase text-white/50">Hướng dẫn</h2>{guideSuggestions.map(item => <Link key={item.slug} to={`/huong-dan/${item.slug}`} className="block border-l border-white/10 py-1 pl-3 text-sm text-white/60 hover:border-primary hover:text-white">{item.title}</Link>)}</div></aside>
      <div className="min-w-0">
      <Helmet>
        <title>{post.seoTitle || pageTitle}</title>
        <meta name="description" content={post.seoDescription || pageDesc} />
        <link rel="canonical" href={post.canonicalUrl || canonicalUrl} />
        <meta property="og:title" content={post.seoTitle || pageTitle} />
        <meta property="og:description" content={post.seoDescription || pageDesc} />
        <meta property="og:image" content={post.ogImage || post.image || 'https://api.nguyenquangson.id.vn/logo.png'} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="article" />
      </Helmet>

      <Link
        to="/blog"
        className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors group mb-6 sm:mb-8 text-sm sm:text-base"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Quay lại Blog</span>
      </Link>

      <header className="mb-7 sm:mb-10 md:mb-12">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-primary mb-4 sm:mb-6 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 sm:px-3 py-1 bg-primary/10 border border-primary/20 rounded-full leading-none break-words"
            >
              #{tag}
            </span>
          ))}
        </div>

        <h1 className="text-[1.85rem] sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-5 sm:mb-8 leading-tight blog-display-font">
          {post.title}
        </h1>

        <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm text-white/40 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-secondary" />
            {new Date(post.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" />
            {post.readTime || '5 min read'}
          </div>
          {(post.authorName || post.authorId) && <div className="flex items-center gap-2">Tác giả: {post.authorName || post.authorId}</div>}
        </div>
      </header>

      <div className="relative h-56 sm:h-[300px] md:h-[500px] rounded-3xl sm:rounded-[40px] overflow-hidden mb-10 sm:mb-16 glass border border-white/10">
        <img
          src={post.image || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop'}
          alt={post.coverAlt || post.title}
          className="w-full h-full object-cover"
        />
      </div>
      {post.coverCaption && <p className="-mt-8 mb-10 text-center text-sm text-white/50">{post.coverCaption}</p>}

      <div className="w-full mb-10 sm:mb-16 mx-auto">
        <style>{`.blog-content figure{margin:1rem 0}.blog-content figure[data-align="center"]{margin-left:auto;margin-right:auto}.blog-content figure[data-align="right"]{margin-left:auto}.blog-content figcaption{text-align:center;font-size:.8rem;color:rgba(255,255,255,.5)}`}</style>
        <div
          className="text-white/80 leading-relaxed blog-content"
          dangerouslySetInnerHTML={{ __html: normalizedContent }}
        />
      </div>

      <footer className="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 italic font-serif text-xl">S</div>
          <div>
            <p className="font-bold">{post.authorName || post.authorId || 'Nguyễn Quang Sơn'}</p>
            <p className="text-xs text-white/40">Tác giả</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => showFeatureNotice('Tính năng chia sẻ đang được cập nhật, quay lại sau nhé.')}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
            title="Chia sẻ"
            type="button"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => showFeatureNotice('Tính năng bình luận đang được cập nhật, quay lại sau nhé.')}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
            title="Bình luận"
            type="button"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {featureNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl border border-white/15 bg-black/80 backdrop-blur text-sm text-white">
          {featureNotice}
        </div>
      )}
      {post.relatedBlogs?.length > 0 && <section className="mt-12 border-t border-white/10 pt-6"><h2 className="mb-3 font-bold">Bài blog khác</h2>{post.relatedBlogs.map(item => <Link key={item.id} to={`/blog/${item.slug || item.id}`} className="mb-2 block text-sm text-white/60 hover:text-secondary">{item.title}</Link>)}</section>}
      </div>
      <aside className="hidden lg:block"><div className="sticky top-24 space-y-3"><h2 className="text-xs font-bold uppercase text-white/50">Bài blog mới</h2>{(post.relatedBlogs || []).map(item => <Link key={item.id} to={`/blog/${item.slug || item.id}`} className="block border-l border-white/10 py-1 pl-3 text-sm text-white/60 hover:border-primary hover:text-white">{item.title}</Link>)}</div></aside>
    </div>
  );
};

export default BlogDetail;
