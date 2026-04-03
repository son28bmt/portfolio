import { motion, AnimatePresence } from 'framer-motion';
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
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Turnstile } from '@marsidev/react-turnstile';
import { useState, useEffect, useRef } from 'react';

const AI_CHAT_HISTORY_KEY = 'global_floating_ai_chat_history_v1';
const MAX_CHAT_HISTORY_MESSAGES = 50;
const GUEST_ID_KEY = 'chat_guest_id';

const AI_WELCOME = {
  role: 'ai',
  content: 'Xin chào! Tôi là trợ lý AI của Sơn. Tôi có thể giúp gì cho bạn hôm nay?',
  timestamp: new Date()
};

const getGuestId = () => {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = 'guest_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
};

const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'staff'
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [guestId] = useState(getGuestId);
  
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
  const [offlineForm, setOfflineForm] = useState({ name: '', email: '', message: '' });
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  
  const socketRef = useRef();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Persistence for AI chat
  useEffect(() => {
    localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(aiMessages.slice(-MAX_CHAT_HISTORY_MESSAGES)));
  }, [aiMessages]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, staffMessages, isAiTyping, activeTab, isOpen]);

  // Socket setup
  useEffect(() => {
    const API_BASE_URL = (
      import.meta.env.VITE_API_BASE_URL || 
      (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
        ? 'https://api.nguyenquangson.id.vn/api' 
        : 'http://localhost:5000/api')
    ).replace(/\/+$/, '');
    
    let socketUrl = API_BASE_URL;
    if (socketUrl.includes('/api')) {
      socketUrl = socketUrl.split('/api')[0];
    }
    if (socketUrl.startsWith('/') || (window.location.hostname !== 'localhost' && socketUrl.includes('localhost'))) {
      socketUrl = window.location.origin;
    }

    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_chat', { guestId });
    });

    socketRef.current.on('admin_status', ({ online }) => {
      setIsAdminOnline(online);
    });

    socketRef.current.on('receive_admin_message', (data) => {
      setStaffMessages(prev => [...prev, { role: 'admin', content: data.text, timestamp: data.timestamp || new Date() }]);
    });

    const loadStaffHistory = async () => {
      try {
        const { data } = await api.get(`/chat/history/${guestId}`);
        setStaffMessages(data.map(m => ({ 
          role: m.role, 
          content: m.content, 
          timestamp: m.createdAt 
        })));
      } catch (err) {
        console.error('Failed to load staff history:', err);
      }
    };

    if (isOpen && activeTab === 'staff') {
      loadStaffHistory();
    }

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [guestId, activeTab, isOpen]);

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
        guestId,
        text: staffInput.trim()
      });
    }

    setStaffMessages(prev => [...prev, { role: 'user', content: staffInput.trim(), timestamp: new Date() }]);
    setStaffInput('');
  };

  const handleOfflineSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingForm(true);
    try {
      await api.post('/contact', { ...offlineForm, subject: 'Hỗ trợ từ Chatbox' });
      setFormSuccess(true);
      setOfflineForm({ name: '', email: '', message: '' });
      setTimeout(() => setFormSuccess(false), 5000);
    } catch (error) {
      console.error('Error sending support request:', error);
      alert('Lỗi gửi yêu cầu. Vui lòng thử lại.');
    } finally {
      setIsSubmittingForm(false);
    }
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
                    {isAdminOnline && <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_#4ade80]" />}
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
                  {isAdminOnline ? (
                    <div className="space-y-4">
                      <div className="text-center py-1 text-[8px] text-green-400 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-1.5">
                         Administrator Online
                      </div>
                      {staffMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 px-4 rounded-[18px] text-[12px] ${
                            msg.role === 'user' 
                              ? 'bg-secondary text-white rounded-tr-none' 
                              : 'bg-white/[0.12] text-white/90 border border-white/5 rounded-tl-none'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-8 py-4">
                      {formSuccess ? (
                        <div className="text-center space-y-6 py-20 animate-in fade-in zoom-in">
                          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
                          <h3 className="font-black text-2xl uppercase">Đã gửi thành công!</h3>
                        </div>
                      ) : (
                        <>
                          <div className="text-center space-y-4 mb-10">
                            <Headphones className="w-12 h-12 text-white/20 mx-auto" />
                            <h3 className="font-black text-xl uppercase tracking-tight">Hôm nay tôi vắng mặt</h3>
                          </div>
                          <form onSubmit={handleOfflineSubmit} className="space-y-4">
                            <input 
                              required
                              placeholder="Họ và tên"
                              value={offlineForm.name}
                              onChange={e => setOfflineForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-[20px] px-6 py-4 text-sm focus:border-secondary transition-all outline-none"
                            />
                            <input 
                              required
                              type="email"
                              placeholder="Email của bạn"
                              value={offlineForm.email}
                              onChange={e => setOfflineForm(f => ({ ...f, email: e.target.value }))}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-[20px] px-6 py-4 text-sm focus:border-secondary transition-all outline-none"
                            />
                            <textarea 
                              required
                              rows={4}
                              placeholder="Bạn đang cần hỗ trợ điều gì?"
                              value={offlineForm.message}
                              onChange={e => setOfflineForm(f => ({ ...f, message: e.target.value }))}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-[24px] px-6 py-4 text-sm focus:border-secondary transition-all outline-none resize-none"
                            />
                            <button 
                              disabled={isSubmittingForm}
                              className="w-full py-5 bg-secondary text-white font-black uppercase text-[11px] rounded-[24px]"
                            >
                              Gửi cho Quang Sơn
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Input Area */}
            {(!isAdminOnline && activeTab === 'staff') || formSuccess ? null : (
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
            )}
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
              {isAdminOnline && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-4 border-primary animate-pulse" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .glass { 
          background: rgba(12, 12, 12, 0.75) !important; 
          backdrop-filter: blur(40px) saturate(200%) !important; 
          -webkit-backdrop-filter: blur(40px) saturate(200%) !important; 
        }
      `}</style>
    </div>
  );
};

export default FloatingChat;
