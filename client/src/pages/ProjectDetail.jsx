import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, Layers, Smartphone, ExternalLink, Download, Globe, Cpu, ChevronRight } from 'lucide-react';
import api from '../services/api';

// Reusable Section Header to replace manual characters like ━━━━
const SectionHeader = ({ title, icon: Icon, color = "primary" }) => (
  <div className="flex items-center gap-4 mb-10 overflow-hidden">
    <div className={`flex-none p-2 rounded-lg bg-${color}/10 text-${color}`}>
      {Icon && <Icon className="w-4 h-4" />}
    </div>
    <h3 className="flex-none text-xs font-black uppercase tracking-[0.4em] text-[#dee5ff]">
      {title}
    </h3>
    <div className="flex-grow h-[1px] bg-gradient-to-r from-white/10 to-transparent ml-4" />
  </div>
);

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
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
        <h2 className="text-4xl font-black mb-6 text-white text-glow">Không tìm thấy dự án</h2>
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
    <div className="min-h-screen bg-[#060e20] text-[#dee5ff] selection:bg-primary/30 font-inter">
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
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-5 border-b border-white/5 bg-[#060e20]/80 backdrop-blur-2xl">
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
            <div className="hidden sm:flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(189,157,255,1)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Status: Active</span>
            </div>
            {project.demo && (
              <a href={project.demo} target="_blank" rel="noreferrer" className="text-xs font-black text-primary hover:text-white transition-colors uppercase tracking-widest hidden md:block">
                View Live Site
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-7"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] mb-8 text-primary/80">
                <Layers className="w-3 h-3" />
                <span>{project.category || 'CASE STUDY'}</span>
              </div>
              <h1 className="text-5xl md:text-8xl font-black mb-8 leading-[1.05] tracking-tighter text-glow">
                {project.title}
              </h1>
              <p className="text-lg md:text-xl text-[#a3aac4] leading-relaxed mb-10 max-w-2xl border-l-2 border-primary/20 pl-6 italic">
                {cleanDescription(project.description)}
              </p>

              <div className="flex flex-wrap gap-5">
                {project.demo && (
                  <a
                    href={project.demo}
                    target="_blank"
                    rel="noreferrer"
                    className="px-10 py-5 bg-primary text-white rounded-2xl font-black text-xs flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_-10px_rgba(124,58,237,0.4)] group"
                  >
                    <span>KHÁM PHÁ NGAY</span>
                    <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  </a>
                )}
                
                <div className="flex gap-3">
                  {project.apkUrl && (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/apk`}
                      className="p-5 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 hover:border-primary/40 transition-all group"
                      title="Download Android"
                    >
                      <Smartphone className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </a>
                  )}
                  {project.iosUrl && (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/ios`}
                      className="p-5 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 hover:border-primary/40 transition-all group"
                      title="Download iOS"
                    >
                      <Download className="w-6 h-6 group-hover:scale-110 transition-transform" />
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
              <div className="relative aspect-[4/5] rounded-[4rem] overflow-hidden shadow-2xl group border border-white/5">
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060e20] via-transparent to-transparent opacity-60" />
                
                <div className="absolute bottom-8 left-8 right-8 p-8 glass rounded-[2.5rem] border border-white/10 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
                      <Layout className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">Premium UI</span>
                  </div>
                  <p className="text-[10px] text-[#a3aac4] leading-relaxed">Được thiết kế với tư duy tập trung vào trải nghiệm người dùng cuối cùng.</p>
                </div>
              </div>
              
              {/* Background glow */}
              <div className="absolute -inset-20 bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
            
            {/* Sticky Sidebar */}
            <aside className="lg:col-span-3">
              <div className="sticky top-32">
                <SectionHeader title="Stack Công Nghệ" icon={Cpu} />
                <div className="flex flex-wrap lg:flex-col gap-3">
                  {project.tech && project.tech.length > 0 ? project.tech.map((t, i) => (
                    <motion.div
                      key={t}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="px-6 py-4 bg-[#141f38]/50 backdrop-blur-md border border-white/5 rounded-2xl text-[11px] font-black tracking-widest text-[#a3aac4] hover:text-white hover:border-primary/40 transition-all group flex items-center justify-between"
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

            {/* Detailed Info & Gallery */}
            <main className="lg:col-span-9 space-y-32">
              
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
              >
                <SectionHeader title="Bộ sưu tập dự án" icon={Layers} color="secondary" />
                {project.images && project.images.length > 1 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {project.images.slice(1).map((img, idx) => (
                      <motion.div
                        key={idx}
                        whileHover={{ y: -12, scale: 1.02 }}
                        className="group relative rounded-[3rem] overflow-hidden border border-white/10 bg-[#0f1930] aspect-[16/10] shadow-2xl"
                      >
                        <img
                          src={img}
                          alt={`${project.title} screenshot ${idx + 1}`}
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-700"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#060e20] to-transparent opacity-0 group-hover:opacity-80 transition-opacity" />
                        <div className="absolute bottom-8 left-8 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                          <Maximize2 className="w-3 h-3" />
                          <span>Mở rộng hình ảnh</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-[3rem] p-20 text-center border border-white/5 italic text-[#a3aac4]">
                    Chưa có thêm hình ảnh mô tả cho dự án này.
                  </div>
                )}
              </motion.div>

              {/* Call to Action Footer */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative glass rounded-[4rem] p-16 md:p-24 border border-white/10 text-center overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 -z-10" />
                <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter">Bạn thích sản phẩm này chứ?</h2>
                <p className="text-[#a3aac4] mb-12 max-w-xl mx-auto leading-relaxed text-sm md:text-base">
                  Hãy kết nối với tôi để thảo luận về các dự án tương tự hoặc đặt hàng thiết kế riêng cho ứng dụng của bạn. 
                  Mọi sản phẩm của tôi đều được tối ưu hóa cho tốc độ và trải nghiệm.
                </p>
                <div className="flex flex-wrap justify-center gap-5">
                  <Link
                    to="/lien-he"
                    className="px-12 py-5 bg-white text-black rounded-2xl font-black text-xs hover:bg-primary hover:text-white transition-all shadow-xl"
                  >
                    LIÊN HỆ HỢP TÁC
                  </Link>
                  {project.github && (
                    <a
                      href={project.github}
                      target="_blank"
                      rel="noreferrer"
                      className="px-12 py-5 bg-white/5 border border-white/20 text-white rounded-2xl font-black text-xs hover:bg-white/10 transition-all flex items-center gap-3"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>XEM SOURCE CODE</span>
                    </a>
                  )}
                </div>
              </motion.div>
            </main>
          </div>
        </div>
      </section>

      {/* Footer Buffer */}
      <div className="h-24" />
      
      {/* Global CSS for text glow */}
      <style dangerouslySetInnerHTML={{ __html: `
        .text-glow {
          text-shadow: 0 0 30px rgba(189,157,255,0.3);
        }
        @media (max-width: 640px) {
          .text-8xl { font-size: 3.5rem; }
        }
      `}} />
    </div>
  );
};

// Missing Imports and Components for the above code
const Layout = ({ className }) => <Layers className={className} />;
const Maximize2 = ({ className }) => <ExternalLink className={className} />;

export default ProjectDetail;
