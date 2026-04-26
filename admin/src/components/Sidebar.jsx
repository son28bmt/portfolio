import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bot,
  FileText,
  FolderKanban,
  Gift,
  Headphones,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShoppingBag,
  Sparkles,
  Settings,
  X,
  UsersRound,
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
    { icon: Headphones, label: 'Hỗ trợ trực tuyến', path: '/live-chat' },
    { icon: FolderKanban, label: 'Dự án', path: '/projects' },
    { icon: FileText, label: 'Blog', path: '/blog' },
    { icon: Bot, label: 'Blog tự động', path: '/blog/automation' },
    { icon: MessageSquare, label: 'Tin nhắn', path: '/messages' },
    { icon: UsersRound, label: 'Người dùng', path: '/users' },
    { icon: Gift, label: 'Donate', path: '/donate' },
    { icon: ShoppingBag, label: 'Chợ số', path: '/marketplace' },
    { icon: Settings, label: 'Cấu hình AI', path: '/ai-settings' },
  ];

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-white/5 bg-surface p-6 transition-transform duration-300 transform
      ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      lg:translate-x-0 lg:static lg:shadow-none`}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-white lg:hidden"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mb-8 mt-4 flex items-center gap-3 px-2 lg:mb-10 lg:mt-0">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Admin Panel</span>
      </div>

      <nav className="flex-grow space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => onClose?.()}
            className={({ isActive }) => `
              flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all
              ${
                isActive
                  ? 'border border-primary/20 bg-primary/10 text-primary'
                  : 'text-white/40 hover:bg-white/5 hover:text-white'
              }
            `}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-auto flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition-all hover:bg-red-400/10"
      >
        <LogOut className="h-5 w-5" />
        Đăng xuất
      </button>
    </div>
  );
};

export default Sidebar;
