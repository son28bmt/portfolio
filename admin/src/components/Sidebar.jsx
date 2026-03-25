import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  FileText, 
  Settings, 
  MessageSquare, 
  LogOut,
  Sparkles
} from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FolderKanban, label: 'Dự án', path: '/projects' },
    { icon: FileText, label: 'Blog', path: '/blog' },
    { icon: MessageSquare, label: 'Tin nhắn', path: '/messages' },
    { icon: Settings, label: 'Cấu hình AI', path: '/ai-settings' },
  ];

  return (
    <div className="w-64 h-screen bg-surface border-r border-white/5 flex flex-col p-6 sticky top-0">
      <div className="flex items-center gap-3 mb-10 px-2">
        <Sparkles className="text-primary w-6 h-6" />
        <span className="font-bold text-lg">Admin Panel</span>
      </div>

      <nav className="flex-grow space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${isActive 
                ? 'bg-primary/10 text-primary border border-primary/20' 
                : 'text-white/40 hover:text-white hover:bg-white/5'}
            `}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button 
        onClick={handleLogout}
        className="flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all mt-auto"
      >
        <LogOut className="w-5 h-5" />
        Đăng xuất
      </button>
    </div>
  );
};

export default Sidebar;
