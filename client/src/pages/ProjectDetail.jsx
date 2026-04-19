import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, Layers, Smartphone, ExternalLink, Download, Globe, Cpu, ChevronRight, Layout, Maximize2, X } from 'lucide-react';
import api from '../services/api';

// Reusable Section Header to replace manual characters like ━━━━
const SectionHeader = ({ title, icon: Icon, color = "primary" }) => (
  <div className="flex items-center gap-4 mb-10 overflow-hidden">
    <div className={`flex-none p-2 rounded-lg bg-${color}/10 text-${color}`}>
      {Icon && <Icon className="w-4 h-4" />}
    </div>
    <h3 className="flex-none text-[10px] sm:text-xs font-black uppercase tracking-[0.4em] text-[#dee5ff]">
      {title}
    </h3>
    <div className="flex-grow h-[1px] bg-gradient-to-r from-white/10 to-transparent ml-4" />
  </div>
);

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Scroll Progress Logic
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

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
          QUAY LẠI DỰ ÁN
        </Link>
      </div>
    );
  }

  // Helper to clean up the description if it contains manually added horizontal bars
  const cleanDescription = (text) => {
    if (!text) return '';
    return text.replace(/[━─]{3,}/g, '').trim();
  };

  return (
    <div className="min-h-screen bg-[#060e20] text-[#dee5ff] selection:bg-primary/30 font-inter overflow-x-hidden">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={project.image} />
      </Helmet>

      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-secondary z-[60] origin-left"
        style={{ scaleX }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5 bg-[#060e20]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            to="/du-an"
            className="group flex items-center gap-3 text-sm font-bold tracking-[0.2em] text-[#a3aac4] hover:text-white transition-all"
          >
            <div className="p-2 rounded-lg bg-white/5 group-hover:bg-primary/20 transition-colors">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
            <span className="uppercase text-[10px] hidden sm:inline">Quay lại dự án</span>
          </Link>
          
          <div className="flex items-center gap-6">
            <div className="hidden xs:flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(189,157,255,1)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Status: Active</span>
            </div>
            {project.demo && (
              <a href={project.demo} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest">
                Live Preview
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-16 items-center">
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-7"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] mb-6 sm:mb-8 text-primary/80">
                <Layers className="w-3 h-3" />
                <span>{project.category || 'CASE STUDY'}</span>
              </div>
              <h1 className="text-4xl sm:text-6xl md:text-8xl font-black mb-6 sm:mb-8 leading-[1.1] tracking-tighter text-glow break-words overflow-hidden">
                {project.title}
              </h1>
              <div className="text-base sm:text-lg md:text-xl text-[#a3aac4] leading-relaxed mb-8 sm:mb-10 max-w-2xl border-l-2 border-primary/20 pl-4 sm:pl-6 italic whitespace-pre-line">
                {cleanDescription(project.description)}
              </div>

              <div className="flex flex-wrap gap-4 sm:gap-5">
                {project.demo && (
                  <a
                    href={project.demo}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-primary text-white rounded-2xl font-black text-xs flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_15px_30px_-10px_rgba(124,58,237,0.4)] group"
                  >
                    <span>KHÁM PHÁ NGAY</span>
                    <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  </a>
                )}
                
                <div className="flex gap-3 w-full sm:w-auto">
                  {project.apkUrl && (
                    <a 
                      href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/apk`}
                      className="flex-1 sm:flex-none p-4 sm:p-5 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all group flex justify-center"
                      title="Download Android"
                    >
                      <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
                      <span>Tải Xuống APK</span>
                    </a>
                  )}
                  {project.iosUrl && (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/ios`}
                      className="flex-1 sm:flex-none p-4 sm:p-5 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all group flex justify-center"
                      title="Download iOS"
                    >
                      <Download className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
                      <span>Tải Xuống iOS</span>
                    </a>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="lg:col-span-5 relative"
            >
              <div 
                onClick={() => setSelectedImage(project.image)}
                className={`relative cursor-zoom-in ${project.category?.toLowerCase() === 'mobile app' ? 'aspect-[9/16] max-w-[320px] mx-auto' : 'aspect-[4/3] sm:aspect-[4/5]'} rounded-[3rem] overflow-hidden shadow-2xl group border border-white/5`}
              >
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060e20] via-transparent to-transparent opacity-60" />
                
                <div className="absolute bottom-6 sm:bottom-8 left-6 sm:right-8 left-6 right-6 sm:left-8 p-6 sm:p-8 glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <div className="flex items-center gap-3 mb-2 sm:mb-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
                      <Layout className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Premium UI</span>
                  </div>
                  <p className="text-[10px] text-[#a3aac4] leading-relaxed line-clamp-2">Click để phóng to ảnh nền</p>
                </div>
              </div>
              
              <div className="absolute -inset-10 sm:-inset-20 bg-primary/20 rounded-full blur-[80px] sm:blur-[120px] -z-10 animate-pulse" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-20">
            
            {/* Sidebar */}
            <aside className="lg:col-span-3">
              <div className="sticky top-28 sm:top-32">
                <SectionHeader title="Stack Công Nghệ" icon={Cpu} />
                <div className="flex flex-wrap lg:flex-col gap-2 sm:gap-3">
                  {project.tech && project.tech.length > 0 ? project.tech.map((t, i) => (
                    <motion.div
                      key={t}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="px-4 sm:px-6 py-3 sm:py-4 bg-[#141f38]/50 backdrop-blur-md border border-white/5 rounded-2xl text-[10px] sm:text-[11px] font-black tracking-widest text-[#a3aac4] hover:text-white hover:border-primary/40 transition-all group flex items-center justify-between"
                    >
                      <span className="uppercase">{t}</span>
                      <ChevronRight className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                    </motion.div>
                  )) : (
                    <div className="text-xs text-[#a3aac4] italic">Đang cập nhật kỹ thuật...</div>
                  )}
                </div>
              </div>
            </aside>

            {/* Gallery */}
            <main className="lg:col-span-9 space-y-24 sm:space-y-32">
              
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
              >
                <SectionHeader title="Bộ sưu tập dự án" icon={Layers} color="secondary" />
                {project.images && project.images.length > 1 ? (
                  <div className={`grid grid-cols-2 ${project.category?.toLowerCase() === 'mobile app' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 sm:gap-10`}>
                    {project.images.slice(1).map((img, idx) => (
                      <motion.div
                        key={idx}
                        whileHover={{ y: -10, scale: 1.02 }}
                        onClick={() => setSelectedImage(img)}
                        className={`group relative cursor-zoom-in rounded-[2rem] sm:rounded-[3rem] overflow-hidden border border-white/10 bg-[#0f1930] ${project.category?.toLowerCase() === 'mobile app' ? 'aspect-[9/16]' : 'aspect-video'} shadow-2xl`}
                      >
                        <img
                          src={img}
                          alt={`${project.title} screenshot ${idx + 1}`}
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-700"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#060e20] to-transparent opacity-0 group-hover:opacity-80 transition-opacity" />
                        <div className="absolute bottom-4 sm:bottom-8 left-4 sm:left-8 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                          <Maximize2 className="w-3 h-3" />
                          <span>Xem ảnh</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-[2rem] sm:rounded-[3rem] p-12 sm:p-20 text-center border border-white/5 italic text-[#a3aac4] text-xs sm:text-sm">
                    Chưa có thêm hình ảnh mô tả cho dự án này.
                  </div>
                )}
              </motion.div>

              {/* CTA Footer */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative glass rounded-[2.5rem] sm:rounded-[4rem] p-10 sm:p-16 md:p-24 border border-white/10 text-center overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 -z-10" />
                <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-6 sm:mb-8 tracking-tighter">Bạn thích sản phẩm này chứ?</h2>
                <p className="text-[#a3aac4] mb-8 sm:mb-12 max-w-xl mx-auto leading-relaxed text-xs sm:text-base">
                  Hãy kết nối với tôi để thảo luận về các dự án tương tự hoặc đặt hàng thiết kế riêng cho ứng dụng của bạn.
                </p>
                <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
                  <Link
                    to="/lien-he"
                    className="w-full sm:w-auto px-10 sm:px-12 py-4 sm:py-5 bg-white text-black rounded-2xl font-black text-xs hover:bg-primary hover:text-white transition-all shadow-xl"
                  >
                    LIÊN HỆ HỢP TÁC
                  </Link>
                  {project.github && (
                    <a
                      href={project.github}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto px-10 sm:px-12 py-4 sm:py-5 bg-white/5 border border-white/20 text-white rounded-2xl font-black text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>SOURCE CODE</span>
                    </a>
                  )}
                </div>
              </motion.div>
            </main>
          </div>
        </div>
      </section>

      {/* Lightbox / Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] bg-[#060e20]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-10 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-5xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage}
                alt="Project detail"
                className="rounded-2xl sm:rounded-[2rem] shadow-2xl border border-white/10 object-contain max-h-[85vh]"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 p-3 sm:p-4 bg-white text-black rounded-full hover:bg-primary hover:text-white transition-all shadow-2xl"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-16 sm:h-24" />
      
      <style dangerouslySetInnerHTML={{ __html: `
        .text-glow {
          text-shadow: 0 0 30px rgba(189,157,255,0.3);
        }
        @media (max-width: 640px) {
          h1 { word-wrap: break-word; }
        }
      `}} />
    </div>
  );
};

export default ProjectDetail;
