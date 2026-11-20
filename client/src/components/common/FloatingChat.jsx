import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  User, 
  ImagePlus, 
  Trash2, 
  ArrowRight,
  Headphones,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Turnstile } from '@marsidev/react-turnstile';
import { useAuth } from '../../context/AuthContext';

const AI_CHAT_HISTORY_KEY = 'global_floating_ai_chat_history_v1';
const MAX_CHAT_HISTORY_MESSAGES = 50;
const GUEST_ID_KEY = 'chat_guest_id';
const GUEST_TOKEN_KEY = 'chat_guest_token_v1';

const AI_WELCOME = {
  role: 'ai',
  content: 'Xin chào! Tôi là trợ lý AI của Sơn. Tôi có thể giúp gì cho bạn hôm nay?',
  timestamp: new Date()
};

const getGuestId = () => {
  localStorage.removeItem(GUEST_ID_KEY);
  localStorage.removeItem(GUEST_TOKEN_KEY);
  let id = sessionStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest_${crypto.randomUUID()}`;
    sessionStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
};

const createGuestId = () => {
  const id = `guest_${crypto.randomUUID()}`;
  sessionStorage.setItem(GUEST_ID_KEY, id);
  sessionStorage.removeItem(GUEST_TOKEN_KEY);
  return id;
};

const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { token: userToken, account, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'staff'
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [guestId, setGuestId] = useState(getGuestId);
  const [guestToken, setGuestToken] = useState(() => sessionStorage.getItem(GUEST_TOKEN_KEY) || '');
  const chatId = userToken && account?.id ? `user_${account.id}` : guestId;
  
  // --- AI State ---
  const [aiMessages, setAiMessages] = useState(() => {
    const stored = localStorage.getItem(AI_CHAT_HISTORY_KEY);
    if (!stored) return [AI_WELCOME];
    try {
      return JSON.parse(stored);
    } catch {
      return [AI_WELCOME];
    }
  });
  const [aiInput, setAiInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const turnstileRef = useRef();
  
  // --- Staff State ---
  const [staffMessages, setStaffMessages] = useState([]);
  const [staffInput, setStaffInput] = useState('');
  
  const socketRef = useRef();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const guestTokenRef = useRef(guestToken);
  const isStaffActiveRef = useRef(isOpen && activeTab === 'staff');

  useEffect(() => {
    const handleLogout = () => {
      setStaffMessages([]);
      setUnreadCount(0);
      setGuestToken('');
      guestTokenRef.current = '';
      setGuestId(createGuestId());
    };
    window.addEventListener('chat-auth-logout', handleLogout);
    return () => window.removeEventListener('chat-auth-logout', handleLogout);
  }, []);

  useLayoutEffect(() => {
    setStaffMessages([]);
    setUnreadCount(0);
    setGuestToken(sessionStorage.getItem(GUEST_TOKEN_KEY) || '');
  }, [chatId]);

  // Persistence for AI chat
  useEffect(() => {
    localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(aiMessages.slice(-MAX_CHAT_HISTORY_MESSAGES)));
  }, [aiMessages]);

  useEffect(() => {
    if (guestToken) {
      guestTokenRef.current = guestToken;
      sessionStorage.setItem(GUEST_TOKEN_KEY, guestToken);
    }
  }, [guestToken]);

  useEffect(() => {
    isStaffActiveRef.current = isOpen && activeTab === 'staff';
  }, [isOpen, activeTab]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, staffMessages, isAiTyping, activeTab, isOpen]);

  // Socket setup
  useEffect(() => {
    if (authLoading || (userToken && !account?.id)) return undefined;

    const getSocketUrl = () => {
      const vBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const vSocketUrl = import.meta.env.VITE_SOCKET_URL || '';

      if (vSocketUrl) return vSocketUrl;

      // Handle common 'https' error or empty
      if (vBaseUrl === 'https' || !vBaseUrl) {
        if (window.location.hostname !== 'localhost') {
          return 'https://api.nguyenquangson.id.vn';
        }
        return 'http://localhost:5000';
      }

      try {
        const urlObj = new URL(vBaseUrl);
        // Ensure we handle 'https' as origin which is rare but possible if URL is malformed
        if (urlObj.origin === 'https' || urlObj.hostname === 'https') {
             return 'https://api.nguyenquangson.id.vn';
        }
        return urlObj.origin;
      } catch {
        if (window.location.hostname !== 'localhost') {
          return 'https://api.nguyenquangson.id.vn';
        }
        return window.location.origin;
      }
    };

    const socketUrl = getSocketUrl();
    console.log('[Socket] Connecting to:', socketUrl);

    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    const loadStaffHistory = async (tokenOverride = '') => {
      const token = tokenOverride || guestToken || sessionStorage.getItem(GUEST_TOKEN_KEY) || '';
      if (!userToken && !token) return;

      try {
        const { data } = await api.get(`/chat/history/${chatId}`, {
          headers: userToken ? {} : { 'x-guest-token': token }
        });
        setStaffMessages(data.map(m => ({ 
          id: m.id,
          role: m.role, 
          content: m.content, 
          timestamp: m.createdAt,
          replyContext: m.replyContext,
          messageType: m.messageType,
          guideContext: m.guideContext,
          questionSnapshot: m.questionSnapshot,
        })));
        setUnreadCount(data.filter(m => m.role === 'admin' && !m.isRead).length);
        if (isStaffActiveRef.current) {
          await api.put(`/chat/read-user/${chatId}`, null, { headers: userToken ? {} : { 'x-guest-token': token } });
          setUnreadCount(0);
        }
      } catch (err) {
        console.error('Failed to load staff history:', err);
      }
    };

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_chat', {
        guestId: chatId,
        userToken: userToken || '',
        guestToken: sessionStorage.getItem(GUEST_TOKEN_KEY) || guestTokenRef.current,
      });
    });

    socketRef.current.on('guest_session_token', (payload) => {
      if (userToken) return;
      const token = String(payload?.token || '').trim();
      if (!token) return;
      setGuestToken(token);
      guestTokenRef.current = token;
      sessionStorage.setItem(GUEST_TOKEN_KEY, token);
      api.get(`/chat/unread/${chatId}`, { headers: { 'x-guest-token': token } })
        .then(({ data }) => setUnreadCount(Number(data.unreadCount) || 0))
        .catch(() => {});

      if (isOpen && activeTab === 'staff') {
        loadStaffHistory(token);
      }
    });

    socketRef.current.on('admin_status', ({ online }) => {
      setIsAdminOnline(online);
    });

    socketRef.current.on('receive_admin_message', (data) => {
      setStaffMessages(prev => [...prev, {
        id: data.id,
        role: 'admin',
        content: data.text,
        timestamp: data.timestamp || new Date(),
        replyContext: data.replyContext,
      }]);
      if (isStaffActiveRef.current) {
        api.put(`/chat/read-user/${chatId}`, null, { headers: userToken ? {} : { 'x-guest-token': guestTokenRef.current } })
          .catch(() => {});
        setUnreadCount(0);
      } else {
        setUnreadCount(value => value + 1);
      }
    });

    socketRef.current.on('support_request_created', (data) => {
      setStaffMessages(prev => [...prev.filter(item => item.id !== data.id), {
        id: data.id,
        role: 'user',
        content: data.text,
        timestamp: data.timestamp || new Date(),
        messageType: data.messageType,
        guideContext: data.guideContext,
        questionSnapshot: data.questionSnapshot,
      }]);
    });

    socketRef.current.on('guest_chat_deleted', ({ guestId: deletedGuestId }) => {
      if (deletedGuestId !== chatId) return;
      setStaffMessages([]);
      setUnreadCount(0);
    });

    socketRef.current.on('chat_auth_error', () => {
      if (!userToken) setGuestId(createGuestId());
    });

    if (isOpen && activeTab === 'staff') {
      loadStaffHistory();
    }

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  // Keep guestToken out so receiving a freshly issued token does not reconnect the socket.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authLoading, chatId, account?.id, isOpen, userToken]);

  const handleAiSend = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() && !selectedImage) return;

    // Check turnstile before sending
    if (!turnstileToken) {
      alert("Hệ thống đang kiểm tra bảo mật (Anti-Bot)... Vui lòng đợi 1 giây rồi thử lại!");
      return;
    }

    const userMsg = { role: 'user', content: aiInput.trim(), imageBase64: selectedImage, timestamp: new Date() };
    setAiMessages(prev => [...prev, userMsg]);
    
    const sentImg = selectedImage;
    setAiInput('');
    setSelectedImage(null);
    setIsAiTyping(true);

    try {
      const { data } = await api.post('/ai/chat', {
        message: userMsg.content,
        imageBase64: sentImg,
        turnstileToken
      }, {
        headers: { 'x-turnstile-token': turnstileToken }
      });

      setAiMessages(prev => [...prev, { role: 'ai', content: data.reply, timestamp: new Date() }]);
    } catch (err) {
      const errorMsg = err.response?.data?.reply || 'Rất tiếc, tôi đang gặp sự cố kết nối. Hãy thử lại sau nhé!';
      setAiMessages(prev => [...prev, { role: 'ai', content: errorMsg, timestamp: new Date() }]);
    } finally {
      setIsAiTyping(false);
      setTurnstileToken(null);
      if (turnstileRef.current) turnstileRef.current.reset();
    }
  };

  const handleStaffSend = (e) => {
    e.preventDefault();
    if (!staffInput.trim()) return;

    if (socketRef.current) {
      socketRef.current.emit('send_to_admin', {
        guestId: chatId,
        text: staffInput.trim()
      });
    }

    setStaffMessages(prev => [...prev, { role: 'user', content: staffInput.trim(), timestamp: new Date() }]);
    setStaffInput('');
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 40, scale: 0.9, filter: 'blur(10px)' }}
            className="w-[calc(100vw-32px)] md:w-[350px] max-h-[80vh] h-[520px] glass rounded-[32px] border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col pointer-events-auto mb-4"
          >
            {/* Optimized Header */}
            <div className="p-3 border-b border-white/5 bg-white/[0.02] flex items-center gap-3 shrink-0">
               <div className="flex bg-black/40 rounded-[22px] p-1.5 gap-1.5 flex-grow">
                  <button 
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 py-1.5 md:py-2.5 rounded-[16px] text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'ai' ? 'bg-primary text-white shadow-lg scale-[1.02]' : 'text-white/30 hover:text-white/60'}`}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> 
                    <span className="hidden xs:inline">Sparkles</span> AI
                  </button>
                  <button 
                    onClick={() => setActiveTab('staff')}
                    className={`flex-1 py-1.5 md:py-2.5 rounded-[16px] text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'staff' ? 'bg-secondary text-white shadow-lg scale-[1.02]' : 'text-white/30 hover:text-white/60'}`}
                  >
                    <Headphones className="w-3.5 h-3.5" /> 
                    <span className="hidden xs:inline">Hotline</span> Staff
                    {unreadCount > 0 && <span className="min-w-4 h-4 px-1 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                  </button>
               </div>
               <button 
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 md:w-11 md:h-11 rounded-[20px] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-3">
              {activeTab === 'ai' ? (
                <>
                  {aiMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] p-3 px-4 rounded-[18px] text-[12px] leading-[1.5] ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-white/[0.12] text-white/90 border border-white/5 rounded-tl-none'
                      }`}>
                        {msg.role === 'user' ? (
                          <>
                            <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                            {msg.imageBase64 && <img src={msg.imageBase64} className="mt-3 rounded-lg w-full object-cover border border-white/10" alt="sent" />}
                          </>
                        ) : (
                          <div className="prose prose-invert prose-xs max-w-none prose-p:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isAiTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 p-3 px-4 rounded-[18px] rounded-tl-none flex gap-1.5 border border-white/5">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-duration:0.8s]" />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-4">
                      <div className="text-center py-1 text-[8px] text-green-400 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-1.5">
                         {isAdminOnline ? 'Admin đang trực tuyến' : 'Admin chưa trực tuyến · Tin nhắn sẽ được lưu để phản hồi'}
                      </div>
                      {staffMessages.map((msg, i) => (
                        <div id={msg.messageType === 'guide_question' ? `chat-request-${msg.id}` : undefined} key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 px-4 rounded-[18px] text-[12px] whitespace-pre-wrap ${
                            msg.role === 'user' 
                              ? 'bg-secondary text-white rounded-tr-none' 
                              : 'bg-white/[0.12] text-white/90 border border-white/5 rounded-tl-none'
                          }`}>
                            {msg.replyContext?.requestNumber && <div className="mb-2 rounded-lg border border-secondary/30 bg-black/20 p-2 text-[10px] leading-relaxed"><p className="font-bold uppercase tracking-wider text-secondary">Admin đang trả lời yêu cầu #{msg.replyContext.requestNumber}</p>{msg.replyContext.guideTitle && <p className="mt-0.5 text-white/75">Bài hướng dẫn: {msg.replyContext.guideTitle}</p>}<button type="button" onClick={() => document.getElementById(`chat-request-${msg.replyContext.requestId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="mt-1 inline-block font-semibold text-secondary underline">Xem nội dung yêu cầu</button>{msg.replyContext.guideSlug && <a className="ml-3 inline-block font-semibold text-white/70 underline" href={`/huong-dan/${encodeURIComponent(msg.replyContext.guideSlug)}`} target="_blank" rel="noreferrer">Mở bài viết</a>}</div>}
                            {msg.messageType === 'guide_question' && msg.questionSnapshot?.fields ? <div className="mb-2 rounded-lg border border-white/10 bg-black/20 p-2"><p className="mb-2 font-bold text-white">Yêu cầu #{msg.questionSnapshot.requestNumber || String(msg.id || '').replace(/-/g, '').slice(-8).toUpperCase()} · {msg.guideContext?.title || 'Hỗ trợ hướng dẫn'}</p>{msg.guideContext?.slug && <a className="mb-2 inline-block text-[10px] font-semibold text-secondary underline" href={`/huong-dan/${encodeURIComponent(msg.guideContext.slug)}`} target="_blank" rel="noreferrer">Mở bài hướng dẫn</a>}{msg.questionSnapshot.fields.map((field, index) => <div key={`${field.key}-${index}`} className="mb-1 last:mb-0"><p className="text-[9px] font-bold uppercase text-white/45">{field.label}</p><p className="whitespace-pre-wrap text-white/85">{field.value || '(bỏ trống)'}</p></div>)}</div> : msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Input Area */}
            <div className="p-4 md:p-6 border-t border-white/5 bg-white/[0.03] shrink-0">
                {activeTab === 'ai' && (
                   <div className="flex justify-center mb-4 scale-[0.7] md:scale-[0.8] origin-bottom opacity-40">
                      <Turnstile 
                        ref={turnstileRef}
                        siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                        onSuccess={setTurnstileToken}
                      />
                   </div>
                )}
                
                <form onSubmit={activeTab === 'ai' ? handleAiSend : handleStaffSend} className="flex gap-3 items-center">
                  <div className="flex-grow flex items-center bg-black/40 border border-white/10 rounded-[24px] px-2 focus-within:border-primary/50 transition-all">
                    {activeTab === 'ai' && (
                      <>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={e => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setSelectedImage(ev.target.result);
                            reader.readAsDataURL(file);
                          }
                        }} />
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-10 h-10 flex items-center justify-center text-white/20 hover:text-white rounded-[18px]"
                        >
                          <ImagePlus className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    <input 
                      value={activeTab === 'ai' ? aiInput : staffInput}
                      onChange={e => activeTab === 'ai' ? setAiInput(e.target.value) : setStaffInput(e.target.value)}
                      placeholder={activeTab === 'ai' ? "Hỏi Sparkles AI..." : "Gửi tin nhắn..."}
                      className="flex-grow bg-transparent px-4 py-4 text-[13px] outline-none placeholder:text-white/10"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className={`w-14 h-14 shrink-0 rounded-[24px] text-white flex items-center justify-center shadow-lg ${activeTab === 'ai' ? 'bg-primary' : 'bg-secondary'}`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        layout
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto w-14 h-14 md:w-16 md:h-16 rounded-[22px] bg-primary flex items-center justify-center text-white shadow-2xl relative group overflow-hidden border border-white/10"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
            
              <X className="w-7 h-7 md:w-9 md:h-9 " />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
              <MessageSquare className="w-7 h-7 md:w-9 md:h-9" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 bg-secondary text-white text-[11px] font-black rounded-full border-2 border-primary flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default FloatingChat;
