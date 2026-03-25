import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Layers, X, Maximize2, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const parseArrayField = (value, { allowCommaSplit = true } = {}) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  let current = value;
  for (let i = 0; i < 3; i += 1) {
    if (typeof current !== 'string') break;
    const text = current.trim();
    if (!text) return [];
    if (!['[', '{', '"'].includes(text[0])) break;
    try {
      current = JSON.parse(text);
    } catch {
      break;
    }
  }

  if (Array.isArray(current)) {
    return current.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof current === 'string' && current.trim()) {
    if (allowCommaSplit && current.includes(',')) {
      return current.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [current.trim()];
  }

  return [];
};

const normalizeProject = (project) => {
  const tech = parseArrayField(project.tech, { allowCommaSplit: true });
  const images = parseArrayField(project.images, { allowCommaSplit: false });
  const coverImage = (typeof project.image === 'string' ? project.image.trim() : '') || images[0] || '';
  const mergedImages = [...new Set([coverImage, ...images].filter(Boolean))];

  return {
    ...project,
    tech,
    image: coverImage || 'https://images.unsplash.com/photo-1675271591211-126ad94e495d?q=80&w=2670&auto=format&fit=crop',
    images: mergedImages,
  };
};

const Projects = () => {
  const categories = ['All', 'Web', 'Mobile', 'Tool'];
  const [activeCategory, setActiveCategory] = useState('All');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data } = await axios.get('https://api.nguyenquangson.id.vn/api/projects');
        const normalized = Array.isArray(data) ? data.map(normalizeProject) : [];
        setProjects(normalized);
      } catch (err) {
        console.error('Lỗi khi tải dự án:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const filteredProjects = activeCategory === 'All'
    ? projects
    : projects.filter((project) => project.category === activeCategory);

  const openGallery = (project) => {
    setSelectedProject(project);
    setSelectedImageIndex(0);
  };

  const closeGallery = () => {
    setSelectedProject(null);
    setSelectedImageIndex(0);
  };

  const galleryImages = selectedProject?.images || [];
  const currentGalleryImage = galleryImages[selectedImageIndex] || '';

  const goPrevImage = () => {
    if (!galleryImages.length) return;
    setSelectedImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const goNextImage = () => {
    if (!galleryImages.length) return;
    setSelectedImageIndex((prev) => (prev + 1) % galleryImages.length);
  };

  return (
    <div className="py-12">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
        <div className="px-4 md:px-0">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center gap-3">
            Dự án tiêu biểu
            <Layers className="text-secondary w-6 h-6 md:w-8 md:h-8" />
          </h1>
          <p className="text-white/60 text-sm md:text-base">Nơi lưu giữ những ý tưởng đã được hiện thực hóa.</p>
        </div>

        <div className="flex bg-surface p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar max-w-[calc(100vw-2rem)] mx-4 md:mx-0">
          <div className="flex gap-1 min-w-max">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 md:px-6 py-2 rounded-xl text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-primary text-white shadow-lg glow'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-white/40 animate-pulse">Đang tải danh sách dự án...</p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 px-4 md:px-0"
        >
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project) => (
              <motion.div
                layout
                key={project.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="group glass rounded-3xl overflow-hidden hover:border-primary/30 transition-colors"
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />

                  <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20">
                    {project.category}
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                    {project.github && (
                      <a
                        href={project.github}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                        title="Github Repo"
                      >
                        <Github className="w-5 h-5" />
                      </a>
                    )}
                    {project.images.length > 0 && (
                      <button
                        onClick={() => openGallery(project)}
                        className="p-3 bg-secondary text-white rounded-full hover:scale-110 transition-transform shadow-xl"
                        title="Xem ảnh dự án"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                    )}
                    {project.demo && (
                      <button
                        onClick={() => setSelectedDemo(project)}
                        className="p-3 bg-primary text-white rounded-full hover:scale-110 transition-transform shadow-xl"
                        title="Live Demo"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  <h3 className="text-xl md:text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{project.title}</h3>
                  <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-4 line-clamp-3">
                    {project.description}
                  </p>

                  {project.images.length > 0 && (
                    <div className="flex items-center gap-2 mb-6">
                      {project.images.slice(0, 4).map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt={project.title}
                          className="w-12 h-12 rounded-lg object-cover border border-white/10"
                        />
                      ))}
                      {project.images.length > 4 && (
                        <span className="text-[10px] text-white/50 font-bold">+{project.images.length - 4} ảnh</span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {project.tech.map((tech) => (
                      <span key={`${project.id}-${tech}`} className="text-[10px] font-bold px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white/60">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8"
          >
            <div
              className="absolute inset-0 bg-background/90 backdrop-blur-xl"
              onClick={closeGallery}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl glass rounded-3xl overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-secondary" />
                  <div>
                    <h4 className="font-bold text-sm">{selectedProject.title}</h4>
                    <p className="text-[10px] text-white/40">{galleryImages.length} ảnh dự án</p>
                  </div>
                </div>
                <button
                  onClick={closeGallery}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative bg-black/30">
                {currentGalleryImage && (
                  <img
                    src={currentGalleryImage}
                    alt={selectedProject.title}
                    className="w-full h-[60vh] object-contain"
                  />
                )}

                {galleryImages.length > 1 && (
                  <>
                    <button
                      onClick={goPrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={goNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="p-4 bg-background/60 border-t border-white/10 flex gap-2 overflow-x-auto">
                  {galleryImages.map((url, index) => (
                    <button
                      key={url}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`shrink-0 rounded-xl overflow-hidden border-2 ${
                        index === selectedImageIndex ? 'border-secondary' : 'border-white/10'
                      }`}
                    >
                      <img src={url} alt={`Ảnh ${index + 1}`} className="w-20 h-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDemo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          >
            <div
              className="absolute inset-0 bg-background/90 backdrop-blur-xl"
              onClick={() => setSelectedDemo(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full h-full max-w-6xl glass rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10"
            >
              <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/20 p-2 rounded-lg">
                    <Layers className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{selectedDemo.title}</h4>
                    <p className="text-[10px] text-white/40">{selectedDemo.demo}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDemo(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-grow bg-white">
                <iframe
                  src={selectedDemo.demo}
                  className="w-full h-full border-none"
                  title={`Demo: ${selectedDemo.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <div className="p-4 bg-background/50 border-t border-white/10 flex justify-center gap-4">
                <p className="text-xs text-white/30 italic">Đang hiển thị bản demo trực tiếp từ nguồn ngoài.</p>
                {selectedDemo.github && (
                  <a
                    href={selectedDemo.github}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-secondary hover:underline flex items-center gap-1"
                  >
                    <Github className="w-3 h-3" /> Xem mã nguồn
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Projects;
