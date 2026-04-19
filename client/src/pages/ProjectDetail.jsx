import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, Layers, Smartphone, Github, Globe, 
  Copy, Check, Share2, Calendar, Tag, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const ProjectDetail = () => {
  const { id } = useParams(); // This 'id' can be a UUID or a Slug
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: project?.title,
          text: project?.description,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Lỗi chia sẻ:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full" 
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background">
        <motion.div
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
        >
          <h2 className="text-4xl font-black mb-6 text-white/20">404</h2>
          <h2 className="text-2xl font-bold mb-8">Không tìm thấy dự án</h2>
          <Link to="/du-an" className="px-8 py-3 bg-primary text-white rounded-2xl font-bold hover:scale-105 transition-transform inline-block">Quay lại Dự án</Link>
        </motion.div>
      </div>
    );
  }

  const galleryImages = Array.isArray(project.images) ? project.images : (project.image ? [project.image] : []);
  const techStack = Array.isArray(project.tech) ? project.tech : [];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-20">
      <Helmet>
        <title>{project.title} | Nguyễn Quang Sơn Project</title>
        <meta name="description" content={project.description} />
      </Helmet>

      {/* Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px] -z-10" />

      <div className="max-w-6xl mx-auto px-4 pt-12 md:pt-20">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            to="/du-an"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Quay lại danh sách</span>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Visuals */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative group glass rounded-[40px] overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center bg-black/40 ${
                project.category === 'Mobile' ? 'aspect-[4/5] md:aspect-[3/4] max-h-[600px] mx-auto' : 'aspect-video'
              }`}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImage}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.4 }}
                  src={galleryImages[activeImage]}
                  alt={project.title}
                  className={`w-full h-full ${project.category === 'Mobile' ? 'object-contain p-4' : 'object-cover'}`}
                />
              </AnimatePresence>
              
              {galleryImages.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => setActiveImage((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)}
                     className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-primary transition-colors"
                   >
                     <ChevronLeft className="w-6 h-6" />
                   </button>
                   <button 
                     onClick={() => setActiveImage((prev) => (prev + 1) % galleryImages.length)}
                     className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-primary transition-colors"
                   >
                     <ChevronRight className="w-6 h-6" />
                   </button>
                </div>
              )}
            </motion.div>

            {/* Thumbnail Selection */}
            {galleryImages.length > 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 overflow-x-auto no-scrollbar pb-2"
              >
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`shrink-0 w-24 aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                      activeImage === idx ? 'border-primary scale-105' : 'border-white/5 opacity-50 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Right Column: Key Info & Small Stats */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                 <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-widest text-primary">
                   {project.category}
                 </div>
                 <div className="flex items-center gap-1.5 text-white/30 text-xs text-nowrap">
                   <Calendar className="w-3 h-3" />
                   <span>{new Date(project.updatedAt).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' })}</span>
                 </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">{project.title}</h1>
              
              <div className="glass p-6 rounded-3xl border border-white/5 space-y-4 mb-8">
                 <div className="flex items-center gap-2 text-white/60 mb-2">
                   <Tag className="w-4 h-4 text-secondary" />
                   <span className="text-xs font-bold uppercase tracking-wider">Tech Stack</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {techStack.map((tech) => (
                     <span key={tech} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-medium hover:border-primary/50 transition-colors">
                       {tech}
                     </span>
                   ))}
                 </div>
              </div>

              {/* Actions Box */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  {project.demo && (
                    <a
                      href={project.demo}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-grow flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 glow"
                    >
                      <Globe className="w-5 h-5" />
                      Xem Website
                    </a>
                  )}
                  
                  <button
                    onClick={handleShare}
                    className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2 group"
                  >
                    <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>Chia sẻ</span>
                  </button>
                </div>

                {project.github && (
                  <a
                    href={project.github}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-white text-black rounded-2xl font-bold hover:scale-[1.02] transition-all"
                  >
                    <Github className="w-5 h-5" />
                    Mã nguồn GitHub
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Full Width Bottom Section: Description & Downloads */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 pt-16 border-t border-white/5">
          {/* Main Description */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-8 space-y-6"
          >
            <h3 className="text-2xl font-black flex items-center gap-3">
              <div className="w-8 h-1 bg-primary rounded-full" />
              Chi tiết dự án
            </h3>
            <div className="prose prose-invert max-w-none">
               <p className="text-white/70 leading-relaxed text-lg whitespace-pre-wrap">{project.description}</p>
            </div>
          </motion.div>

          {/* Download & Sidebar Info */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="lg:col-span-4 space-y-8"
          >
            {(project.apkUrl || project.iosUrl) && (
              <div className="glass p-8 rounded-[40px] border border-white/10 space-y-6">
                <h4 className="font-black text-sm uppercase tracking-widest text-white/40">Tải ứng dụng</h4>
                <div className="space-y-4">
                  {project.apkUrl && (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/apk`}
                      className="flex items-center justify-between p-4 bg-green-600/10 border border-green-500/20 text-green-400 rounded-2xl hover:bg-green-600/20 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5" />
                        <span className="font-bold">Android APK</span>
                      </div>
                      <ArrowLeft className="w-4 h-4 rotate-180 opacity-0 group-hover:opacity-100 transition-all" />
                    </a>
                  )}
                  {project.iosUrl && (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/ios`}
                      className="flex items-center justify-between p-4 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl hover:bg-blue-600/20 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5" />
                        <span className="font-bold">iOS (IPA)</span>
                      </div>
                      <ArrowLeft className="w-4 h-4 rotate-180 opacity-0 group-hover:opacity-100 transition-all" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col gap-3">
               <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Đường dẫn chia sẻ</span>
               <div className="flex items-center justify-between gap-4">
                 <span className="text-xs text-primary truncate font-mono">{window.location.href}</span>
                 <button 
                  onClick={copyToClipboard}
                  className="shrink-0 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-white/40" />}
                </button>
               </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
