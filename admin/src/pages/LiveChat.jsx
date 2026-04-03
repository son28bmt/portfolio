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
  Search,
  Bell,
  BellOff,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const LiveChat = () => {
  const [sessions, setSessions] = useState([]); // Array of { guestId, name, email, lastMessageAt, unreadCount }
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]); // Current active chat messages
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const socketRef = useRef();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const API_BASE_URL = (
      import.meta.env.VITE_API_BASE_URL || 
      (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
        ? 'https://api.nguyenquangson.id.vn/api' 
        : 'http://localhost:5000/api')
    ).replace(/\/+$/, '');
    
    let socketUrl = '';
    try {
      const urlObj = new URL(API_BASE_URL);
      socketUrl = urlObj.origin;
    } catch (e) {
      socketUrl = 'https://api.nguyenquangson.id.vn';
    }
    
    // Ensure production domains don't fallback to localhost
    if (window.location.hostname !== 'localhost' && socketUrl.includes('localhost')) {
      socketUrl = 'https://api.nguyenquangson.id.vn'; 
    }

    socketRef.current = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.emit('join_admin_room');

    socketRef.current.on('init_sessions', (data) => {
      setSessions(data.map(s => ({
        ...s,
        unreadCount: parseInt(s.unreadCount) || 0
      })));
    });

    socketRef.current.on('new_user_message', (data) => {
      const { guestId, text, name, email, timestamp } = data;
      
      setSessions(prev => {
        const index = prev.findIndex(s => s.guestId === guestId);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            lastMessageAt: timestamp,
            unreadCount: activeChatId === guestId ? 0 : (updated[index].unreadCount + 1)
          };
          // Move to top
          const session = updated.splice(index, 1)[0];
          return [session, ...updated];
        } else {
          return [{
            guestId,
            name: name || guestId,
            email: email || 'N/A',
            lastMessageAt: timestamp,
            unreadCount: activeChatId === guestId ? 0 : 1
          }, ...prev];
        }
      });

      if (activeChatId === guestId) {
        setMessages(prev => [...prev, { role: 'user', content: text, createdAt: timestamp }]);
        socketRef.current.emit('mark_as_read', { guestId });
      }

      if (isNotificationsEnabled) {
        new Audio('/notification.mp3').play().catch(() => {});
      }
    });

    socketRef.current.on('receive_admin_message', (data) => {
       // This is for syncing multiple admin tabs if needed
    });

    return () => socketRef.current.disconnect();
  }, [activeChatId, isNotificationsEnabled]);

  useEffect(() => {
    if (activeChatId) {
      loadChatHistory(activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async (guestId) => {
    setIsLoadingHistory(true);
    try {
      const { data } = await api.get(`/chat/history/${guestId}`);
      setMessages(data);
      
      // Update session unread count to 0 in local state
      setSessions(prev => prev.map(s => s.guestId === guestId ? { ...s, unreadCount: 0 } : s));
      
      // Tell server we read it
      socketRef.current.emit('mark_as_read', { guestId });
      await api.put(`/chat/read/${guestId}`);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChatId) return;

    const text = input.trim();
    socketRef.current.emit('send_to_user', { guestId: activeChatId, text });

    setMessages(prev => [...prev, { role: 'admin', content: text, createdAt: new Date() }]);
    setInput('');
    
    // Update last message time in sidebar
    setSessions(prev => prev.map(s => s.guestId === activeChatId ? { ...s, lastMessageAt: new Date() } : s));
  };

  const filteredSessions = sessions.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.guestId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeSession = sessions.find(s => s.guestId === activeChatId);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6 p-4 md:p-0">
      {/* List Sidebar */}
      <div className="w-full lg:w-96 flex flex-col gap-4 border-r border-white/5 pr-0 lg:pr-6 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
             Live <span className="text-primary italic">Support</span>
          </h1>
          <button 
            onClick={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
            className={`p-2.5 rounded-2xl border transition-all ${isNotificationsEnabled ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/5 border-white/10 text-white/20'}`}
          >
            {isNotificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            type="text" 
            placeholder="Tìm kiếm khách hàng..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:border-primary outline-none transition-all placeholder:text-white/10"
          />
        </div>

        <div className="flex-grow overflow-y-auto space-y-2.5 custom-scrollbar pr-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-[40px] text-white/10 text-xs uppercase tracking-widest font-bold">
               Zero active sessions
            </div>
          ) : filteredSessions.map(session => (
            <button
              key={session.guestId}
              onClick={() => setActiveChatId(session.guestId)}
              className={`w-full p-4 rounded-[30px] flex items-center gap-4 transition-all text-left border relative group ${
                activeChatId === session.guestId 
                ? 'bg-primary/10 border-primary/20 shadow-[0_15px_30px_-10px_rgba(var(--primary-rgb),0.3)]' 
                : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05]'
              }`}
            >
              <div className="w-12 h-12 rounded-[20px] bg-white/5 border border-white/5 flex items-center justify-center font-black text-primary shadow-inner">
                {session.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-sm truncate">{session.name || 'Guest User'}</h3>
                  <span className="text-[9px] text-white/20 font-medium">
                    {new Date(session.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-white/30 truncate uppercase tracking-tighter font-medium italic">Guest ID: {session.guestId.slice(-6)}</p>
              </div>
              {session.unreadCount > 0 && (
                <div className="absolute top-4 right-4 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-primary/40">
                  {session.unreadCount}
                </div>
              )}
              <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${activeChatId === session.guestId ? 'text-primary' : 'text-white/5'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-grow flex flex-col glass rounded-[48px] border border-white/5 overflow-hidden shadow-2xl relative">
        <AnimatePresence mode="wait">
          {activeSession ? (
            <motion.div 
              key={activeChatId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-grow flex flex-col h-full"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between backdrop-blur-3xl">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[24px] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-lg">
                    {activeSession.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black text-lg md:text-xl uppercase tracking-tighter">{activeSession.name}</h3>
                    <p className="text-[11px] text-white/40 flex items-center gap-2 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> {activeSession.email} • {activeChatId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="hidden md:flex flex-col text-right mr-4">
                      <div className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Connection</div>
                      <div className="text-[10px] text-green-400 font-black uppercase">Established</div>
                   </div>
                   <button className="w-12 h-12 bg-white/5 rounded-[20px] flex items-center justify-center hover:bg-white/10 transition-all border border-white/5 shadow-lg">
                      <MoreVertical className="w-5 h-5 text-white/20" />
                   </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-grow p-6 md:p-10 overflow-y-auto space-y-8 custom-scrollbar bg-black/10">
                {isLoadingHistory && (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                    <div className={`max-w-[85%] md:max-w-[70%] space-y-2`}>
                      <div className={`p-4 md:p-5 rounded-[30px] text-[13px] md:text-sm leading-relaxed shadow-xl border ${
                        msg.role === 'admin' 
                        ? 'bg-primary text-white rounded-tr-none border-white/10' 
                        : 'bg-white/[0.06] text-white/90 border-white/5 rounded-tl-none backdrop-blur-md'
                      }`}>
                        {msg.content}
                      </div>
                      <div className={`text-[9px] text-white/10 font-bold uppercase tracking-widest ${msg.role === 'admin' ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString()} • {new Date(msg.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-6 md:p-8 bg-white/[0.03] border-t border-white/5 backdrop-blur-3xl shrink-0">
                <form onSubmit={handleSend} className="flex gap-4 items-center">
                  <div className="flex-grow bg-black/40 border border-white/10 rounded-[28px] focus-within:border-primary/50 transition-all duration-500 px-2 group">
                    <input 
                      type="text" 
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Type a premium response..."
                      className="w-full bg-transparent px-6 py-5 text-sm outline-none placeholder:text-white/5 font-medium"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-16 h-16 bg-primary text-white rounded-[28px] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_-10px_rgba(var(--primary-rgb),0.5)] group overflow-hidden relative border border-white/10"
                  >
                    <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-grow flex flex-col items-center justify-center text-center p-12 space-y-10"
            >
              <div className="relative">
                 <div className="w-32 h-32 md:w-40 md:h-40 bg-white/[0.02] rounded-[60px] flex items-center justify-center border border-white/5 shadow-inner animate-pulse">
                    <MessageSquare className="w-12 h-12 md:w-16 md:h-16 text-white/5" />
                 </div>
                 <div className="absolute -top-2 -right-2 w-12 h-12 bg-primary/20 rounded-full blur-2xl animate-pulse" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter">Command <span className="text-primary italic">Center</span></h2>
                <p className="text-[11px] md:text-xs text-white/20 max-w-sm mx-auto uppercase tracking-[0.3em] font-bold leading-relaxed">
                  Select a guest perspective to begin real-time engagement and support synchronization.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: rgba(255,255,255,0.05); 
          border-radius: 10px; 
          transition: background 0.3s;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
        }
        .glass { 
          background: rgba(12, 12, 12, 0.7) !important; 
          backdrop-filter: blur(60px) saturate(200%) brightness(0.8) !important;
          -webkit-backdrop-filter: blur(60px) saturate(200%) brightness(0.8) !important;
        }
      `}</style>
    </div>
  );
};

export default LiveChat;
