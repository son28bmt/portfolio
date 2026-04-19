import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Layers, Smartphone } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Không tìm thấy dự án</h2>
        <Link to="/du-an" className="px-8 py-3 bg-primary text-white rounded-xl font-bold">Quay lại Dự án</Link>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-10 md:py-12 max-w-4xl mx-auto px-4">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonicalUrl} />
      </Helmet>

      <Link
        to="/du-an"
        className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors group mb-8"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Tất cả dự án</span>
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Layers className="text-secondary w-8 h-8" />
        <h1 className="text-3xl md:text-5xl font-black">{project.title}</h1>
      </div>

      <div className="glass rounded-[40px] overflow-hidden mb-12 border border-white/10">
        <img
          src={project.image || 'https://images.unsplash.com/photo-1675271591211-126ad94e495d?q=80&w=2670&auto=format&fit=crop'}
          alt={project.title}
          className="w-full h-auto max-h-[600px] object-cover"
        />
      </div>

      <div className="prose prose-invert max-w-none">
        <p className="text-xl text-white/70 leading-relaxed mb-10">{project.description}</p>
        
        {/* Tech Stack */}
        {project.tech && project.tech.length > 0 && (
          <div className="mb-12">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-4">Công nghệ sử dụng</h3>
            <div className="flex flex-wrap gap-2">
              {project.tech.map((t) => (
                <span key={t} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/60 hover:text-white transition-colors">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {project.images && project.images.length > 1 && (
          <div className="mb-12">
            <h3 className="text-sm font-black uppercase tracking-widest text-secondary mb-6">Hình ảnh dự án</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {project.images.slice(1).map((img, idx) => (
                <div key={idx} className="glass rounded-3xl overflow-hidden border border-white/5 aspect-video hover:border-secondary/30 transition-all group">
                  <img src={img} alt={`${project.title} - ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t border-white/5">
          {project.demo && (
            <a
              href={project.demo}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:scale-105 transition-transform shadow-xl glow"
            >
              Xem trực tiếp (Live Demo)
            </a>
          )}
          
          {project.apkUrl && (
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/apk`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 text-white rounded-2xl font-bold hover:scale-105 transition-transform shadow-xl shadow-green-900/20"
            >
              <Smartphone className="w-5 h-5" />
              Tải APK (Android)
            </a>
          )}

          {project.iosUrl && (
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || 'https://api.nguyenquangson.id.vn/api'}/projects/${project.id}/download/ios`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:scale-105 transition-transform shadow-xl shadow-blue-900/20"
            >
              <Smartphone className="w-5 h-5" />
              Tải iOS (IPA)
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
