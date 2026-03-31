import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { 
  FolderKanban, 
  FileText, 
  MessageSquare, 
  TrendingUp,
  Clock
} from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    projects: 0,
    blogs: 0,
    messages: 0,
  });
  const [recentMessages, setRecentMessages] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [p, b, m] = await Promise.all([
          api.get('/projects'),
          api.get('/blog'),
          api.get('/contact'),
        ]);
        setStats({
          projects: p.data.total || 0,
          blogs: b.data.total || 0,
          messages: Array.isArray(m.data) ? m.data.length : (m.data.total || 0),
        });
        const messages = Array.isArray(m.data) ? m.data : (m.data.items || []);
        setRecentMessages(messages.slice(0, 5));
      } catch (err) {
        console.error('Lỗi khi lấy dữ liệu dashboard:', err);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Dự án', value: stats.projects, icon: FolderKanban, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Blog Posts', value: stats.blogs, icon: FileText, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Tin nhắn', value: stats.messages, icon: MessageSquare, color: 'text-accent', bg: 'bg-accent/10' },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-2">Xin chào, Admin! 👋</h1>
        <p className="text-white/40">Đây là những gì đang diễn ra trong hệ thống của bạn.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="glass p-6 rounded-[24px] flex items-center gap-6 group hover:border-white/20 transition-all">
            <div className={`w-14 h-14 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-white/40 font-bold uppercase tracking-wider">{card.label}</p>
              <h3 className="text-3xl font-bold mt-1">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Recent Messages */}
        <div className="glass rounded-[32px] overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-accent" /> Tin nhắn mới nhất
            </h3>
            <button className="text-xs text-accent hover:underline font-bold">Xem tất cả</button>
          </div>
          <div className="p-6 space-y-4">
            {recentMessages.length > 0 ? recentMessages.map((msg, i) => (
              <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-start justify-between">
                <div>
                  <p className="font-bold text-sm mb-1">{msg.name}</p>
                  <p className="text-xs text-white/40 truncate max-w-[200px]">{msg.message}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                   <span className="text-[10px] text-white/20 flex items-center gap-1">
                     <Clock className="w-3 h-3" />
                     {new Date(msg.createdAt).toLocaleDateString()}
                   </span>
                   {msg.status === 'unread' && (
                     <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                   )}
                </div>
              </div>
            )) : (
              <p className="text-center py-10 text-white/20 text-sm italic">Chưa có tin nhắn nào</p>
            )}
          </div>
        </div>

        {/* System Activity/Welcome Card */}
        <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-[32px] p-10 flex flex-col justify-center items-center text-center space-y-6 border border-white/10">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
            <TrendingUp className="text-white w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2">Hệ thống sẵn sàng</h3>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Mọi thứ đều ổn định. Hãy tiếp tục xây dựng nội dung tuyệt vời nhé!
            </p>
          </div>
          <button className="px-8 py-3 bg-white text-black rounded-full font-bold text-sm hover:scale-105 transition-transform">
            Bắt đầu bài viết mới
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
