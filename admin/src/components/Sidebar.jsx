import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Settings,
  MessageSquare,
  LogOut,
  Sparkles,
  Gift,
  ShoppingBag,
  X
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
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
    { icon: Gift, label: 'Donate', path: '/donate' },
    { icon: ShoppingBag, label: 'Chợ số', path: '/marketplace' },
    { icon: Settings, label: 'Cấu hình AI', path: '/ai-settings' },
  ];

  return (
    <div 
      className={`fixed inset-y-0 left-0 z-50 w-64 h-screen bg-surface border-r border-white/5 flex flex-col p-6 transition-transform duration-300 transform 
      ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} 
      lg:translate-x-0 lg:static lg:shadow-none`}
    >
      <button 
        onClick={onClose} 
        className="lg:hidden absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3 mb-8 lg:mb-10 px-2 mt-4 lg:mt-0">
        <Sparkles className="text-primary w-6 h-6" />
        <span className="font-bold text-lg">Admin Panel</span>
      </div>

      <nav className="flex-grow space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => { if (onClose) onClose(); }}
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
