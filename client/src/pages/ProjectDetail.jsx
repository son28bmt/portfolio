import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Layers, Smartphone, ExternalLink, Download, Globe, Cpu } from 'lucide-react';
import api from '../services/api';

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data } = await api.get(`/projects/${id}`);
        setProject(data);
      } catch (err) {
        console.error('Lỗi khi tải dự án:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  const siteUrl = 'https://nguyenquangson.id.vn';
  const pageTitle = project ? `${project.title} | Dự án Nguyễn Quang Sơn` : 'Đang tải dự án...';
  const pageDesc = project ? (project.description || project.title) : 'Chi tiết dự án phần mềm của Nguyễn Quang Sơn.';
  const canonicalUrl = `${siteUrl}/du-an/${id}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060e20]">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-16 h-16 border-t-4 border-primary rounded-full" 
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-[#060e20]">
        <h2 className="text-4xl font-black mb-6 text-white">Không tìm thấy dự án</h2>
        <Link to="/du-an" className="px-10 py-4 bg-primary text-white rounded-2xl font-black hover:scale-105 transition-transform shadow-2xl shadow-primary/20">
          QUAY LẠI CỬA HÀNG
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060e20] text-[#dee5ff] selection:bg-primary/30">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={project.image} />
      </Helmet>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-6 border-b border-white/5 bg-[#060e20]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            to="/du-an"
            className="group flex items-center gap-3 text-sm font-bold tracking-widest text-[#a3aac4] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="uppercase">Quay lại dự án</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">Stable Release</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                {project.category || 'PROJECT CASE STUDY'}
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-8 leading-[1.1] tracking-tight">
                {project.title}
              </h1>
              <p className="text-lg md:text-xl text-[#a3aac4] leading-relaxed mb-10 max-w-xl">
                {project.description}
              </p>

              <div className="flex flex-wrap gap-4">
                {project.demo && (
                  <a
                    href={project.demo}
                    target="_blank"
                    rel="noreferrer"
                    className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:scale-105 transition-transform shadow-2xl shadow-primary/40 group"
                  >
                    <span>XEM LIVE DEMO</span>
                    <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  </a>
                )}
                
                <div className="flex gap-2">
                  {project.apkUrl && (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/apk`}
                      className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-colors"
                      title="Download APK"
                    >
                      <Smartphone className="w-5 h-5" />
                    </a>
                  )}
                  {project.iosUrl && (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/ios`}
                      className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-colors"
                      title="Download IPA"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative aspect-video rounded-[3rem] overflow-hidden group shadow-[0_0_100px_rgba(189,157,255,0.1)]"
            >
              <img
                src={project.image}
                alt={project.title}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#060e20] via-transparent to-transparent opacity-40" />
              
              {/* Glassmorphic Badge */}
              <div className="absolute bottom-6 left-6 p-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] max-w-[200px]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary rounded-lg text-white">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#dee5ff]">High Quality UI</span>
                </div>
                <p className="text-[10px] text-[#a3aac4] leading-tight">Mọi dự án đều được chăm chút tới từng pixel.</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/10 rounded-full blur-[150px] -z-10" />
      </section>

      {/* Content Sections */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* Tech Stack - Side Column */}
          <aside className="lg:col-span-3">
            <div className="sticky top-32">
              <div className="flex items-center gap-2 mb-6">
                <Cpu className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#dee5ff]">Stack Công Nghệ</h3>
              </div>
              <div className="flex flex-wrap lg:flex-col gap-3">
                {project.tech && project.tech.length > 0 ? project.tech.map((t, i) => (
                  <motion.div
                    key={t}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="px-5 py-3 bg-[#141f38] border border-white/5 rounded-2xl text-xs font-bold text-[#a3aac4] hover:text-white hover:border-primary/30 transition-all cursor-default flex items-center justify-between group"
                  >
                    <span>{t}</span>
                    <div className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                )) : (
                  <span className="text-xs text-[#a3aac4]">Đang cập nhật...</span>
                )}
              </div>
            </div>
          </aside>

          {/* Gallery & Description - Main Column */}
          <main className="lg:col-span-9">
            {/* Gallery Grid */}
            {project.images && project.images.length > 1 && (
              <div className="mb-20">
                <div className="flex items-center gap-2 mb-10">
                  <div className="w-12 h-[1px] bg-white/10" />
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#dee5ff]">Bộ sưu tập hình ảnh</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {project.images.slice(1).map((img, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ y: -10 }}
                      className="group relative rounded-[2.5rem] overflow-hidden border border-white/5 bg-[#0f1930] aspect-video"
                    >
                      <img
                        src={img}
                        alt={`${project.title} screenshot ${idx + 1}`}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#060e20] via-transparent to-transparent opacity-0 group-hover:opacity-60 transition-opacity" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Final CTA Footer Area */}
            <div className="glass rounded-[3rem] p-12 border border-white/5 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/5 -z-10" />
              <h2 className="text-3xl font-black mb-6">Sẵn sàng để thử nghiệm?</h2>
              <p className="text-sm text-[#a3aac4] mb-10 max-w-lg mx-auto leading-relaxed">
                Tất cả các dự án của tôi đều được đóng gói sẵn sàng để bạn có thể cài đặt và trải nghiệm trực tiếp trên điện thoại hoặc trình duyệt.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {project.github && (
                  <a
                    href={project.github}
                    target="_blank"
                    rel="noreferrer"
                    className="px-8 py-4 bg-white text-black rounded-2xl font-black text-xs flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>XEM SOURCE CODE</span>
                  </a>
                )}
                <Link
                  to="/lien-he"
                  className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-xs hover:bg-white/10 transition-all uppercase tracking-widest"
                >
                  Liên hệ hợp tác
                </Link>
              </div>
            </div>
          </main>
        </div>
      </section>

      {/* Footer Spacing */}
      <div className="h-20" />
    </div>
  );
};

export default ProjectDetail;
