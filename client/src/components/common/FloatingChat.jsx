import React, { useState, useEffect, useRef } from 'react';
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, staffMessages, isAiTyping, activeTab, isOpen]);

  // Socket setup
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://api.nguyenquangson.id.vn';
    socketRef.current = io(socketUrl);

    socketRef.current.emit('join_chat', { guestId });

    socketRef.current.on('admin_status', ({ online }) => {
      setIsAdminOnline(online);
    });

    socketRef.current.on('receive_admin_message', (data) => {
      setStaffMessages(prev => [...prev, { role: 'admin', content: data.text, timestamp: data.timestamp }]);
    });

    return () => socketRef.current.disconnect();
  }, [guestId]);

  const handleAiSend = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() && !selectedImage) return;

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
      setAiMessages(prev => [...prev, { role: 'ai', content: 'Lỗi kết nối AI. Vui lòng thử lại.', timestamp: new Date() }]);
    } finally {
      setIsAiTyping(false);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  };

  const handleStaffSend = (e) => {
    e.preventDefault();
    if (!staffInput.trim()) return;

    socketRef.current.emit('send_to_admin', {
      guestId,
      text: staffInput.trim()
    });

    setStaffMessages(prev => [...prev, { role: 'user', content: staffInput.trim(), timestamp: new Date() }]);
    setStaffInput('');
  };

  const handleOfflineSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingForm(true);
    try {
      await api.post('/contact', { ...offlineForm, subject: 'Yêu cầu hỗ trợ từ Floating Chat' });
      setFormSuccess(true);
      setOfflineForm({ name: '', email: '', message: '' });
      setTimeout(() => setFormSuccess(false), 5000);
    } catch (err) {
      alert('Lỗi gửi yêu cầu. Vui lòng thử lại.');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="w-[90vw] md:w-[380px] h-[550px] md:h-[600px] glass rounded-[32px] border border-white/10 shadow-2xl overflow-hidden flex flex-col pointer-events-auto mb-2"
          >
            {/* Header / Tabs */}
            <div className="p-2 border-b border-white/5 bg-white/5 flex gap-1">
              <button 
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-3 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'ai' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                <Sparkles className="w-3.5 h-3.5" /> AI
              </button>
              <button 
                onClick={() => setActiveTab('staff')}
                className={`flex-1 py-3 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'staff' ? 'bg-secondary text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                <Headphones className="w-3.5 h-3.5" /> Nhân viên
                {isAdminOnline && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-3 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-4">
              {activeTab === 'ai' ? (
                <>
                  {aiMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[90%] p-3 rounded-2xl text-[13px] md:text-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white/10 text-white/80'}`}>
                        {msg.role === 'user' ? (
                          <>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            {msg.imageBase64 && <img src={msg.imageBase64} className="mt-2 rounded-lg max-h-40" alt="sent" />}
                          </>
                        ) : (
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isAiTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 p-3 rounded-2xl flex gap-1">
                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {isAdminOnline ? (
                    <>
                      <div className="text-center py-2 text-[10px] text-green-400 font-bold uppercase flex items-center justify-center gap-2">
                         <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                         Nhân viên đang trực tuyến
                      </div>
                      {staffMessages.length === 0 && (
                        <p className="text-center text-white/20 text-xs py-10 px-6">
                          Chào bạn! Đội ngũ hỗ trợ đã sẵn sàng. Hãy đặt câu hỏi bất kỳ nhé.
                        </p>
                      )}
                      {staffMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 rounded-2xl text-[13px] md:text-sm ${msg.role === 'user' ? 'bg-secondary text-white' : 'bg-white/10 text-white/80'}`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="space-y-6 py-4">
                      {formSuccess ? (
                        <div className="text-center space-y-4 py-10">
                          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
                          <h3 className="font-bold text-lg">Đã gửi yêu cầu!</h3>
                          <p className="text-white/50 text-sm">Cảm ơn bạn. Sơn sẽ phản hồi qua email sớm nhất có thể.</p>
                        </div>
                      ) : (
                        <>
                          <div className="text-center space-y-2">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                              <Headphones className="text-white/40" />
                            </div>
                            <h3 className="font-bold text-base">Hiện đang vắng mặt</h3>
                            <p className="text-xs text-white/40">Nhân viên hiện không online, vui lòng để lại lời nhắn bạn nhé!</p>
                          </div>
                          <form onSubmit={handleOfflineSubmit} className="space-y-3">
                            <input 
                              required
                              placeholder="Họ và tên"
                              value={offlineForm.name}
                              onChange={e => setOfflineForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-secondary outline-none"
                            />
                            <input 
                              required
                              type="email"
                              placeholder="Email nhận phản hồi"
                              value={offlineForm.email}
                              onChange={e => setOfflineForm(f => ({ ...f, email: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-secondary outline-none"
                            />
                            <textarea 
                              required
                              rows={3}
                              placeholder="Nội dung cần hỗ trợ..."
                              value={offlineForm.message}
                              onChange={e => setOfflineForm(f => ({ ...f, message: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-secondary outline-none resize-none"
                            />
                            <button 
                              disabled={isSubmittingForm}
                              className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                              {isSubmittingForm ? 'Đang gửi...' : 'Gửi cho Sơn'}
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

            {/* Footer Input */}
            {(!isAdminOnline && activeTab === 'staff') || formSuccess ? null : (
              <div className="p-4 bg-white/5 border-t border-white/5">
                {activeTab === 'ai' && (
                   <div className="flex justify-center mb-2 scale-[0.7] md:scale-[0.8] origin-bottom">
                      <Turnstile 
                        ref={turnstileRef}
                        siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                        onSuccess={setTurnstileToken}
                      />
                   </div>
                )}
                
                <form onSubmit={activeTab === 'ai' ? handleAiSend : handleStaffSend} className="flex gap-2 items-center">
                  {activeTab === 'ai' && (
                    <>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={e => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => setSelectedImage(e.target.result);
                          reader.readAsDataURL(file);
                        }
                      }} />
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-white/40 hover:text-white"
                      >
                        <ImagePlus className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <input 
                    value={activeTab === 'ai' ? aiInput : staffInput}
                    onChange={e => activeTab === 'ai' ? setAiInput(e.target.value) : setStaffInput(e.target.value)}
                    placeholder={activeTab === 'ai' ? "Hỏi AI..." : "Chat..."}
                    className="flex-grow bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none"
                  />
                  <button type="submit" className={`p-3 rounded-xl text-white transition-transform active:scale-90 ${activeTab === 'ai' ? 'bg-primary' : 'bg-secondary'}`}>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Trigger Button */}
      <motion.button
        layout
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary flex items-center justify-center text-white shadow-2xl relative group overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }}>
              <X className="w-6 h-6 md:w-8 md:h-8" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="relative">
              <MessageSquare className="w-6 h-6 md:w-8 md:h-8" />
              {isAdminOnline && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-primary animate-pulse" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .glass { background: rgba(18, 18, 18, 0.8) !important; backdrop-filter: blur(20px) !important; -webkit-backdrop-filter: blur(20px) !important; }
      `}</style>
    </div>
  );
};

export default FloatingChat;
