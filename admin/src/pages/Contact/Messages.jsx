import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { MessageSquare, Mail, User, Clock, CheckCircle, Trash2 } from 'lucide-react';

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data } = await api.get('/contact');
      setMessages(data);
    } catch (err) {
      console.error('Lỗi khi tải tin nhắn:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/contact/${id}`);
      setMessages(messages.map(m => m.id === id ? { ...m, status: 'read' } : m));
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái:', err);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <MessageSquare className="text-accent" /> Tin nhắn liên hệ
        </h1>
        <p className="text-white/40">Phản hồi từ khách truy cập và đối tác tiềm năng.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <p className="text-center py-20 text-white/20">Đang tải tin nhắn...</p>
        ) : messages.length > 0 ? messages.map((msg) => (
          <div key={msg.id} className={`glass p-6 rounded-[24px] border-l-4 transition-all ${msg.status === 'unread' ? 'border-l-accent bg-accent/5' : 'border-l-white/10 opacity-60'}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 uppercase font-bold text-xs">
                  {msg.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    {msg.name} {msg.status === 'unread' && <span className="bg-accent text-black text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase">Mới</span>}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {msg.email}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {msg.status === 'unread' && (
                  <button 
                    onClick={() => markAsRead(msg.id)}
                    className="p-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-all title='Đánh dấu đã đọc'"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                <button className="p-2 hover:bg-white/5 rounded-lg text-white/20 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl text-sm leading-relaxed text-white/80">
              {msg.message}
            </div>
          </div>
        )) : (
          <div className="text-center py-20 text-white/20 border border-dashed border-white/10 rounded-[32px]">
            Chưa có tin nhắn nào được gửi tới.
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
