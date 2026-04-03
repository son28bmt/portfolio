import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  MessageSquare, 
  User, 
  Send, 
  Clock, 
  Circle, 
  Headphones, 
  ChevronRight,
  ShieldCheck,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LiveChat = () => {
  const [chats, setChats] = useState({}); // { guestId: { name, email, messages: [], lastMessageAt } }
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const socketRef = useRef();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://api.nguyenquangson.id.vn';
    socketRef.current = io(socketUrl);

    // Join admin room to start receiving messages
    socketRef.current.emit('join_admin_room');

    socketRef.current.on('new_user_message', (data) => {
      const { guestId, text, name, email, timestamp } = data;
      setChats(prev => {
        const existing = prev[guestId] || { name: name || guestId, email: email || 'N/A', messages: [] };
        return {
          ...prev,
          [guestId]: {
            ...existing,
            messages: [...existing.messages, { role: 'user', content: text, timestamp }],
            lastMessageAt: timestamp
          }
        };
      });
      
      // Play notification sound
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    });

    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatId, chats]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChatId) return;

    socketRef.current.emit('send_to_user', {
      guestId: activeChatId,
      text: input.trim()
    });

    setChats(prev => {
      const chat = prev[activeChatId];
      return {
        ...prev,
        [activeChatId]: {
          ...chat,
          messages: [...chat.messages, { role: 'admin', content: input.trim(), timestamp: new Date() }]
        }
      };
    });

    setInput('');
  };

  const sortedGuestIds = Object.keys(chats).sort((a, b) => {
    return new Date(chats[b].lastMessageAt) - new Date(chats[a].lastMessageAt);
  });

  const activeChat = activeChatId ? chats[activeChatId] : null;

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6">
      {/* List Sidebar */}
      <div className="w-full lg:w-96 flex flex-col gap-4 border-r border-white/5 pr-0 lg:pr-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Headphones className="text-primary" /> Live Support
          </h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Trực tuyến
          </div>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            type="text" 
            placeholder="Tìm kiếm khách hàng..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm focus:border-primary outline-none"
          />
        </div>

        <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-2">
          {sortedGuestIds.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-[32px] text-white/20 text-sm">
              Chưa có khách truy cập nào chat.
            </div>
          ) : sortedGuestIds.map(id => (
            <button
              key={id}
              onClick={() => setActiveChatId(id)}
              className={`w-full p-4 rounded-[24px] flex items-center gap-4 transition-all text-left border ${
                activeChatId === id 
                ? 'bg-primary/10 border-primary/20 shadow-lg' 
                : 'bg-white/5 border-transparent hover:bg-white/[0.08]'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-primary">
                {chats[id].name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-sm truncate">{chats[id].name}</h3>
                  <span className="text-[10px] text-white/20">{new Date(chats[id].lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-white/40 truncate">{chats[id].messages[chats[id].messages.length - 1]?.content}</p>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeChatId === id ? 'text-primary' : 'text-white/10'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-grow flex flex-col glass rounded-[40px] border border-white/5 overflow-hidden">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {activeChat.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{activeChat.name}</h3>
                  <p className="text-xs text-white/40 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> {activeChat.email} • ID: {activeChatId}
                  </p>
                </div>
              </div>
              <button className="px-4 py-2 bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all">
                Đóng phiên
              </button>
            </div>

            {/* Messages */}
            <div className="flex-grow p-6 overflow-y-auto space-y-6 custom-scrollbar">
               {activeChat.messages.map((msg, i) => (
                 <div key={i} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] space-y-1`}>
                       <div className={`p-4 rounded-[24px] text-sm leading-relaxed ${
                         msg.role === 'admin' 
                         ? 'bg-primary text-white rounded-tr-sm' 
                         : 'bg-white/10 text-white/80 rounded-tl-sm'
                       }`}>
                         {msg.content}
                       </div>
                       <div className={`text-[10px] text-white/20 ${msg.role === 'admin' ? 'text-right' : 'text-left'}`}>
                         {new Date(msg.timestamp).toLocaleTimeString()}
                       </div>
                    </div>
                 </div>
               ))}
               <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-6 bg-white/5 border-t border-white/5 flex gap-4 items-center">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Nhập nội dung trả lời khách hàng..."
                className="flex-grow bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-primary outline-none"
              />
              <button 
                type="submit"
                className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform glow"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-12 space-y-6 opacity-40">
             <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
                <MessageSquare className="w-10 h-10" />
             </div>
             <div>
                <h2 className="text-2xl font-bold mb-2">Chọn một cuộc hội thoại</h2>
                <p className="text-sm max-w-sm mx-auto">Click vào danh sách khách hàng bên trái để bắt đầu chat trực tuyến và hỗ trợ họ ngay lập tức.</p>
             </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default LiveChat;
