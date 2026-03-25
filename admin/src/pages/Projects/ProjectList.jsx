import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ExternalLink 
} from 'lucide-react';

const parseJsonArray = (value) => {
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
    return current.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects');
      setProjects(data);
    } catch (err) {
      console.error('Lỗi khi tải dự án:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc muốn xóa dự án này?')) {
      try {
        await api.delete(`/projects/${id}`);
        setProjects(projects.filter(p => p.id !== id));
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
            <FolderKanban className="text-primary" /> Dự án
          </h1>
          <p className="text-white/40">Quản lý các sản phẩm và công cụ của bạn.</p>
        </div>
        <Link 
          to="/projects/add" 
          className="px-6 py-3 bg-primary text-white rounded-2xl font-bold flex items-center gap-2 hover:scale-[1.02] transition-all glow"
        >
          <Plus className="w-5 h-5" /> Thêm dự án mới
        </Link>
      </div>

      {/* Table Area */}
      <div className="glass rounded-[32px] overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5 flex items-center gap-4">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text" 
              placeholder="Tìm kiếm dự án..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-white/40 font-bold border-b border-white/5">
                <th className="px-8 py-4">Tên dự án</th>
                <th className="px-8 py-4">Danh mục</th>
                <th className="px-8 py-4">Công nghệ</th>
                <th className="px-8 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan="4" className="px-8 py-20 text-center text-white/20">Đang tải dữ liệu...</td></tr>
              ) : projects.length > 0 ? projects.map((project) => {
                const techList = parseJsonArray(project.tech);
                const galleryImages = parseJsonArray(project.images);
                const coverImage = project.image || galleryImages[0];

                return (
                <tr key={project.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
                        {coverImage ? (
                          <img src={coverImage} alt={project.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10 text-xs">IMG</div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm tracking-tight">{project.title}</p>
                        <div className="flex gap-2 mt-1">
                          {project.github && <a href={project.github} target="_blank" className="text-white/20 hover:text-primary transition-colors"><ExternalLink className="w-3 h-3" /></a>}
                        </div>
                        <p className="text-[10px] text-white/30 mt-1">{galleryImages.length} ảnh dự án</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase text-white/60">
                      {project.category}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex gap-1 flex-wrap">
                      {techList.slice(0, 3).map((t, i) => (
                        <span key={i} className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md font-bold">
                          {t}
                        </span>
                      ))}
                      {techList.length > 3 && (
                        <span className="text-[10px] text-white/20">+{techList.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/projects/edit/${project.id}`} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all">
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={() => handleDelete(project.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-white/40 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              }) : (
                <tr><td colSpan="4" className="px-8 py-20 text-center text-white/20">Chưa có dự án nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectList;
