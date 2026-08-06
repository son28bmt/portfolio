import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  Terminal,
  Code2,
  Rocket,
  ArrowRight,
  Database,
  Server,
  Cpu,
  Layers,
  ExternalLink,
  Github,
  Calendar,
  Clock,
  Sparkles,
  BookOpen,
  Smartphone,
  Globe,
  CheckCircle2,
} from 'lucide-react';

const parseArrayField = (value) => {
  if (Array.isArray(value)) return value.map((i) => String(i || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((i) => String(i || '').trim()).filter(Boolean);
    } catch {
      if (value.includes(',')) return value.split(',').map((i) => i.trim()).filter(Boolean);
      return [value.trim()];
    }
  }
  return [];
};

const normalizeProject = (project) => {
  const tech = parseArrayField(project.tech);
  const images = parseArrayField(project.images);
  const coverImage = (typeof project.image === 'string' ? project.image.trim() : '') || images[0] || '';
  return {
    ...project,
    tech,
    image: coverImage || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
  };
};

const Home = () => {
  // 1. Typing Slogan Effect
  const words = useMemo(
    () => [
      'Xây dựng Web & Mobile Apps tối ưu',
      'Thiết kế hệ thống hiệu năng cao',
      'Biến ý tưởng thành sản phẩm thực tế',
    ],
    []
  );
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Data States
  const [featuredProjects, setFeaturedProjects] = useState([]);
  const [recentBlogs, setRecentBlogs] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingBlogs, setLoadingBlogs] = useState(true);

  // Active Tech Category
  const [activeTechCategory, setActiveTechCategory] = useState('all');

  useEffect(() => {
    const timeout = setTimeout(() => {
      const currentWord = words[currentWordIndex];

      if (!isDeleting) {
        setCurrentText(currentWord.substring(0, currentText.length + 1));
        if (currentText === currentWord) {
          setTimeout(() => setIsDeleting(true), 2200);
        }
      } else {
        setCurrentText(currentWord.substring(0, currentText.length - 1));
        if (currentText === '') {
          setIsDeleting(false);
          setCurrentWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? 40 : 100);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentWordIndex, words]);

  // Fetch Featured Projects & Blogs
  useEffect(() => {
    const fetchData = async () => {
      // Projects
      try {
        const { data } = await api.get('/projects', { params: { limit: 4 } });
        const items = Array.isArray(data.items) ? data.items : [];
        setFeaturedProjects(items.map(normalizeProject));
      } catch (err) {
        console.error('Lỗi khi tải dự án tiêu biểu:', err);
      } finally {
        setLoadingProjects(false);
      }

      // Blogs
      try {
        const { data } = await api.get('/blog', { params: { limit: 3 } });
        const items = Array.isArray(data.items) ? data.items : [];
        setRecentBlogs(items);
      } catch (err) {
        console.error('Lỗi khi tải blog mới nhất:', err);
      } finally {
        setLoadingBlogs(false);
      }
    };

    fetchData();
  }, []);

  // Tech Stack Data
  const techCategories = [
    { id: 'all', label: 'Tất cả' },
    { id: 'frontend', label: 'Frontend' },
    { id: 'backend', label: 'Backend' },
    { id: 'database', label: 'Database & Cloud' },
    { id: 'tools', label: 'DevOps & Tools' },
  ];

  const techStack = [
    { name: 'React', category: 'frontend', icon: <Code2 className="w-6 h-6 text-cyan-400" />, level: 'Thành thạo' },
    { name: 'JavaScript (ES6+)', category: 'frontend', icon: <Code2 className="w-6 h-6 text-yellow-400" />, level: 'Thành thạo' },
    { name: 'TailwindCSS', category: 'frontend', icon: <Code2 className="w-6 h-6 text-sky-400" />, level: 'Thành thạo' },
    { name: 'HTML5 / CSS3', category: 'frontend', icon: <Code2 className="w-6 h-6 text-orange-400" />, level: 'Thành thạo' },
    { name: 'Framer Motion', category: 'frontend', icon: <Sparkles className="w-6 h-6 text-purple-400" />, level: 'Hiệu ứng UI' },

    { name: 'Node.js', category: 'backend', icon: <Server className="w-6 h-6 text-emerald-400" />, level: 'Thành thạo' },
    { name: 'Express.js', category: 'backend', icon: <Server className="w-6 h-6 text-gray-300" />, level: 'Thành thạo' },
    { name: 'C# / .NET', category: 'backend', icon: <Terminal className="w-6 h-6 text-purple-400" />, level: 'Nền tảng' },
    { name: 'Python', category: 'backend', icon: <Terminal className="w-6 h-6 text-blue-400" />, level: 'Scripting / AI' },
    { name: 'RESTful API', category: 'backend', icon: <Rocket className="w-6 h-6 text-amber-400" />, level: 'Thiết kế chuẩn' },

    { name: 'MySQL', category: 'database', icon: <Database className="w-6 h-6 text-blue-500" />, level: 'Quản trị tốt' },
    { name: 'MongoDB', category: 'database', icon: <Database className="w-6 h-6 text-emerald-500" />, level: 'NoSQL' },
    { name: 'Cloudflare R2 / S3', category: 'database', icon: <CloudflareIcon className="w-6 h-6 text-amber-500" />, level: 'Lưu trữ Cloud' },

    { name: 'Git & GitHub', category: 'tools', icon: <Github className="w-6 h-6 text-white" />, level: 'Quản lý mã nguồn' },
    { name: 'Docker / PM2', category: 'tools', icon: <Cpu className="w-6 h-6 text-sky-400" />, level: 'Deploy & Server' },
    { name: 'Nginx Reverse Proxy', category: 'tools', icon: <Server className="w-6 h-6 text-emerald-400" />, level: 'Cấu hình VPS' },
  ];

  const filteredTech = useMemo(() => {
    if (activeTechCategory === 'all') return techStack;
    return techStack.filter((t) => t.category === activeTechCategory);
  }, [activeTechCategory]);

  return (
    <div className="relative overflow-hidden pt-16 pb-20 md:pt-28 md:pb-36">
      {/* Background Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-25 pointer-events-none">
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-primary/30 rounded-full blur-[140px]" />
        <div className="absolute top-40 right-1/4 w-[450px] h-[450px] bg-secondary/30 rounded-full blur-[140px]" />
      </div>

      <div className="container mx-auto px-4 max-w-6xl">
        {/* ==================== 1. HERO SECTION ==================== */}
        <section className="flex flex-col items-center text-center mb-24 md:mb-36">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm font-medium text-emerald-400 backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sẵn sàng hợp tác cho dự án mới
          </motion.div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
            Nguyễn Quang Sơn <br />
            <span className="text-gradient">Software Developer</span>
          </h1>

          {/* Typing Effect */}
          <div className="h-10 sm:h-14 md:h-16 mb-6">
            <p className="text-lg sm:text-2xl md:text-3xl font-display text-white/80">
              {currentText}
              <span className="animate-pulse bg-primary ml-1 inline-block w-1 h-5 sm:h-7 md:h-9 align-middle" />
            </p>
          </div>

          <p className="text-base sm:text-lg md:text-xl text-white/70 max-w-3xl mb-10 leading-relaxed">
            Chuyên xây dựng các ứng dụng Web & Mobile tối ưu hiệu năng, giao diện hiện đại và trải nghiệm người dùng hoàn hảo.
          </p>

          {/* Hero CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4 mb-16"
          >
            <Link
              to="/du-an"
              className="px-7 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold flex items-center gap-2 transition-all shadow-[0_0_25px_rgba(139,92,246,0.35)] group"
            >
              Xem Dự Án
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/lien-he"
              className="px-7 py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold backdrop-blur-md transition-all hover:border-white/30"
            >
              Liên Hệ Tôi
            </Link>
            <Link
              to="/donate"
              className="px-7 py-3.5 bg-secondary hover:bg-secondary/90 text-white rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(0,191,255,0.3)]"
            >
              Ủng Hộ Tôi
            </Link>
          </motion.div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl glass p-6 rounded-2xl border border-white/10">
            <div className="p-3 text-center border-r border-white/5 last:border-r-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-primary mb-1">10+</div>
              <div className="text-xs text-white/60 font-medium uppercase tracking-wider">Dự án hoàn thành</div>
            </div>
            <div className="p-3 text-center border-r border-white/5 last:border-r-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-secondary mb-1">100%</div>
              <div className="text-xs text-white/60 font-medium uppercase tracking-wider">Cam kết chất lượng</div>
            </div>
            <div className="p-3 text-center border-r border-white/5 last:border-r-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mb-1">Full-Stack</div>
              <div className="text-xs text-white/60 font-medium uppercase tracking-wider">Web & Mobile App</div>
            </div>
            <div className="p-3 text-center last:border-r-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mb-1">24/7</div>
              <div className="text-xs text-white/60 font-medium uppercase tracking-wider">Hỗ trợ & Bảo trì</div>
            </div>
          </div>
        </section>

        {/* ==================== 2. FEATURED PROJECTS ==================== */}
        <section className="mb-28 md:mb-36">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-2">
                <Sparkles className="w-4 h-4" /> Portfolio tiêu biểu
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white">Dự Án Nổi Bật</h2>
            </div>
            <Link
              to="/du-an"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group"
            >
              Xem tất cả dự án
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loadingProjects ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[1, 2].map((n) => (
                <div key={n} className="glass rounded-2xl p-6 h-80 animate-pulse bg-white/5" />
              ))}
            </div>
          ) : featuredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {featuredProjects.map((project, idx) => (
                <motion.div
                  key={project.id || idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className="glass rounded-2xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-300 flex flex-col group"
                >
                  <div className="relative h-52 sm:h-64 overflow-hidden bg-black/40">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/60 backdrop-blur-md border border-white/10 text-primary">
                        {project.category || 'Featured Project'}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-sm text-white/60 line-clamp-2 mb-4">
                        {project.description || 'Dự án được xây dựng với công nghệ hiện đại, tối ưu trải nghiệm và hiệu năng cao.'}
                      </p>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-2 mb-6">
                        {project.tech?.slice(0, 4).map((tech, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2.5 py-1 text-xs font-medium bg-white/5 border border-white/10 rounded-md text-white/80"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Project Links */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <Link
                        to={`/du-an?id=${project.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                      >
                        Chi tiết dự án <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      <div className="flex items-center gap-3">
                        {project.githubUrl && (
                          <a
                            href={project.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                            title="Mã nguồn GitHub"
                          >
                            <Github className="w-4 h-4" />
                          </a>
                        )}
                        {project.demoUrl && (
                          <a
                            href={project.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                            title="Xem Trực Tiếp"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50 glass rounded-2xl">
              Đang cập nhật các dự án tiêu biểu...
            </div>
          )}
        </section>

        {/* ==================== 3. KỸ NĂNG & CÔNG NGHỆ (TECH STACK) ==================== */}
        <section className="mb-28 md:mb-36">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-2">
              <Layers className="w-4 h-4" /> Năng Lực Kỹ Thuật
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">Công Nghệ & Kỹ Năng</h2>
            <p className="text-white/60 text-sm sm:text-base">
              Các công nghệ và công cụ tôi thực sự làm chủ và ứng dụng hiệu quả trong các sản phẩm thực tế.
            </p>
          </div>

          {/* Filter Category Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {techCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTechCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTechCategory === cat.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Tech Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredTech.map((tech, idx) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="glass p-5 rounded-2xl border border-white/10 hover:border-primary/40 transition-all flex flex-col items-center text-center group"
              >
                <div className="p-3 rounded-xl bg-white/5 mb-3 group-hover:scale-110 transition-transform">
                  {tech.icon}
                </div>
                <h4 className="font-bold text-white text-sm mb-1 group-hover:text-primary transition-colors">
                  {tech.name}
                </h4>
                <span className="text-[11px] text-white/40 font-medium">{tech.level}</span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ==================== 4. BLOG / BÀI VIẾT MỚI NHẤT ==================== */}
        <section className="mb-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-secondary font-bold text-xs uppercase tracking-widest mb-2">
                <BookOpen className="w-4 h-4" /> Chia sẻ kiến thức
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white">Bài Viết Mới Nhất</h2>
            </div>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors group"
            >
              Xem tất cả bài viết
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loadingBlogs ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="glass rounded-2xl p-6 h-64 animate-pulse bg-white/5" />
              ))}
            </div>
          ) : recentBlogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentBlogs.map((post, idx) => (
                <motion.div
                  key={post.id || idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className="glass rounded-2xl overflow-hidden border border-white/10 hover:border-secondary/40 transition-all flex flex-col justify-between group"
                >
                  <div className="p-6">
                    <div className="flex items-center gap-4 text-xs text-white/50 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(post.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {post.readTime || '5 min'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-secondary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/60 line-clamp-3 mb-4">
                      {post.excerpt || 'Đọc bài viết chi tiết để tìm hiểu thêm kinh nghiệm và kiến thức lập trình hữu ích...'}
                    </p>
                  </div>

                  <div className="px-6 pb-6 pt-0">
                    <Link
                      to={`/blog/${post.slug || post.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:underline"
                    >
                      Đọc tiếp <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50 glass rounded-2xl">
              Chưa có bài viết mới...
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// Cloudflare Icon Helper
const CloudflareIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 13c-.3 0-.5-.2-.5-.5s.2-.5.5-.5h.1c.3 0 .5.2.5.5s-.2.5-.5.5h-.1zm2.8-1.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm.9 1.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.65 11.23c-.15.42-.48.74-.91.86-.4.11-1.92.11-2.24.11H8.5c-1.38 0-2.5-1.12-2.5-2.5 0-1.13.75-2.09 1.79-2.39.24-.76.92-1.31 1.76-1.31.62 0 1.17.3 1.52.77.44-.47 1.07-.77 1.77-.77 1.25 0 2.29.92 2.47 2.13.59.16 1.05.62 1.21 1.22.13.48.06 1.02-.17 1.48z" />
  </svg>
);

export default Home;

