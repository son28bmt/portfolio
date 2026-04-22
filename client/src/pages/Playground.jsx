import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Sparkles, MessageSquare, Upload, Play, CheckCircle2, AlertCircle, Wand2, ArrowRight, Download, Send, ImagePlus, X, Trash2, KeyRound, Mail } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Turnstile } from '@marsidev/react-turnstile';
import TempMailDemo from '../components/playground/TempMailDemo';

const PLAYGROUND_TOOLS = [
  { key: 'chat', label: 'AI Chat', icon: MessageSquare, activeClass: 'bg-primary text-white glow', inactiveClass: 'text-white/40 hover:text-white' },
  { key: 'subtitle', label: 'Dịch Phụ đề', icon: Wand2, activeClass: 'bg-secondary text-white glow-blue', inactiveClass: 'text-white/40 hover:text-white' },
  { key: 'tts', label: 'TTS & Lồng tiếng', icon: Play, activeClass: 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]', inactiveClass: 'text-white/40 hover:text-white' },
  { key: 'mail', label: 'Mail ảo', icon: Mail, activeClass: 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]', inactiveClass: 'text-white/40 hover:text-white' },
];

const PlaygroundTabs = ({ activeTool, onChangeTool }) => {
  const activeToolMeta = PLAYGROUND_TOOLS.find((tool) => tool.key === activeTool);
  const ActiveIcon = activeToolMeta?.icon || Sparkles;

  return (
    <div className="w-full md:w-[360px] lg:w-[420px]">
      <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-1">Chọn công cụ</label>
      <div className="mt-2 relative">
        <ActiveIcon className="w-4 h-4 text-white/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          value={activeTool}
          onChange={(e) => onChangeTool(e.target.value)}
          className="w-full bg-surface border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-white focus:outline-none focus:border-primary"
        >
          {PLAYGROUND_TOOLS.map((tool) => (
            <option key={tool.key} value={tool.key}>
              {tool.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const PlaygroundLanding = ({ onOpenTool }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
    <div className="text-center space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl md:text-5xl font-bold flex items-center justify-center gap-4">
        AI Playground
        <Sparkles className="text-primary w-6 h-6 md:w-8 md:h-8 animate-pulse" />
      </h1>
      <p className="text-white/60 text-base md:text-lg leading-relaxed">
        Đây là khu vực trải nghiệm các công cụ AI mình đang phát triển. Bạn có thể trò chuyện với AI, dịch phụ đề, hoặc tạo giọng đọc TTS ngay trong một trang duy nhất.
      </p>
      <button
        type="button"
        onClick={() => onOpenTool('chat')}
        className="px-6 py-3 rounded-2xl bg-primary text-white font-bold glow hover:scale-105 transition-transform"
      >
        Bắt đầu với AI Chat
      </button>
    </div>

    <div className="grid md:grid-cols-3 gap-4 md:gap-6">
      {PLAYGROUND_TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <div key={tool.key} className="glass rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">{tool.label}</h3>
            <button
              type="button"
              onClick={() => onOpenTool(tool.key)}
              className="w-full py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-white/80 hover:bg-white/5 transition-colors"
            >
              Mở {tool.label}
            </button>
          </div>
        );
      })}
    </div>
  </motion.div>
);

const PlaygroundToolShell = ({ activeTool, onChangeTool, children }) => (
  <>
    <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8 text-center md:text-left">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-3xl md:text-5xl font-bold mb-4 flex items-center justify-center md:justify-start gap-4">
          AI Playground
          <Sparkles className="text-primary w-6 h-6 md:w-8 md:h-8 animate-pulse" />
        </h1>
        <p className="text-white/50 text-base md:text-lg max-w-xl mx-auto md:mx-0">
          Chọn một công cụ bên dưới để trải nghiệm. Mỗi công cụ có đường dẫn riêng để bạn có thể chia sẻ trực tiếp.
        </p>
      </motion.div>
      <PlaygroundTabs activeTool={activeTool} onChangeTool={onChangeTool} />
    </div>

    <div className="min-h-[600px] flex items-stretch">
      <motion.div key={activeTool} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
        {children}
      </motion.div>
    </div>
  </>
);

const Playground = () => {
  const navigate = useNavigate();

  const handleOpenTool = (tool) => {
    navigate(`/playground/${tool}`);
  };

  return (
    <div className="py-12 max-w-6xl mx-auto px-4">
      <Routes>
        <Route index element={<PlaygroundLanding onOpenTool={handleOpenTool} />} />
        <Route path="chat" element={<PlaygroundToolShell activeTool="chat" onChangeTool={handleOpenTool}><AIChatDemoLocalHistory /></PlaygroundToolShell>} />
        <Route path="subtitle" element={<PlaygroundToolShell activeTool="subtitle" onChangeTool={handleOpenTool}><SubTranslatorDemo /></PlaygroundToolShell>} />
        <Route path="sub" element={<Navigate to="/playground/subtitle" replace />} />
        <Route path="tts" element={<PlaygroundToolShell activeTool="tts" onChangeTool={handleOpenTool}><TTSDemo /></PlaygroundToolShell>} />
        <Route path="mail" element={<PlaygroundToolShell activeTool="mail" onChangeTool={handleOpenTool}><TempMailDemo /></PlaygroundToolShell>} />
        <Route path="tempmail" element={<Navigate to="/playground/mail" replace />} />
        <Route path="*" element={<Navigate to="/playground" replace />} />
      </Routes>

      <style>{`
        select option {
          background-color: #1a1a1a;
          color: white;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
// --- Sub-components ---

const AI_CHAT_HISTORY_KEY = 'playground_ai_chat_history_v1';
const MAX_CHAT_HISTORY_MESSAGES = 80;
const AI_WELCOME_MESSAGE = {
  role: 'ai',
  content: 'Xin chào! Tôi là trợ lý ảo của Sơn. Tôi có thể giúp gì được cho bạn?',
};

const normalizeStoredMessages = (rawMessages) => {
  if (!Array.isArray(rawMessages)) return [];

  return rawMessages
    .map((msg) => ({
      role: msg?.role === 'user' ? 'user' : 'ai',
      content: typeof msg?.content === 'string' ? msg.content.trim() : '',
    }))
    .filter((msg) => msg.content.length > 0);
};

const AIChatDemoLocalHistory = () => {
  const [messages, setMessages] = useState(() => {
    try {
      if (typeof window === 'undefined') return [AI_WELCOME_MESSAGE];
      const stored = window.localStorage.getItem(AI_CHAT_HISTORY_KEY);
      if (!stored) return [AI_WELCOME_MESSAGE];

      const parsed = JSON.parse(stored);
      const normalized = normalizeStoredMessages(parsed);
      return normalized.length > 0
        ? normalized.slice(-MAX_CHAT_HISTORY_MESSAGES)
        : [AI_WELCOME_MESSAGE];
    } catch (error) {
      console.warn('Không đọc được lịch sử chat local:', error);
      return [AI_WELCOME_MESSAGE];
    }
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatModelProvider, setChatModelProvider] = useState('chatgpt');
  const [userApiKey, setUserApiKey] = useState('');
  const [userBaseUrl, setUserBaseUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const turnstileRef = useRef();
  const [turnstileToken, setTurnstileToken] = useState(null);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const normalized = normalizeStoredMessages(messages).slice(-MAX_CHAT_HISTORY_MESSAGES);
      window.localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.warn('Không lưu được lịch sử chat local:', error);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleClearHistory = () => {
    setMessages([AI_WELCOME_MESSAGE]);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AI_CHAT_HISTORY_KEY);
      }
    } catch (error) {
      console.warn('Không xóa được lịch sử chat local:', error);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh quá lớn, vui lòng chọn ảnh dưới 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setSelectedImage(e.target.result);
    reader.readAsDataURL(file);
    e.target.value = null; // reset input
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file.size > 2 * 1024 * 1024) {
          alert('Ảnh dán vào quá lớn (trên 2MB).');
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => setSelectedImage(e.target.result);
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    if (!turnstileToken) {
      alert("Hệ thống đang kiểm tra bảo mật (Anti-Bot)... Vui lòng đợi 1 giây rồi thử lại!");
      return;
    }

    const userMessage = { role: 'user', content: input.trim(), imageBase64: selectedImage };
    setMessages((prev) => [...prev, userMessage]);
    
    const sentImageBase64 = selectedImage;
    setInput('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
      const { data } = await api.post('/ai/chat', {
        message: userMessage.content,
        imageBase64: sentImageBase64,
        modelProvider: chatModelProvider,
        userApiKey,
        userBaseUrl,
        turnstileToken,
      }, {
        headers: {
          'x-turnstile-token': turnstileToken
        }
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: data.reply,
        },
      ]);
    } catch (error) {
      console.error('Lỗi Chat:', error);
      const errorMessage = error.response?.data?.reply || 'Rất tiếc, tôi đang gặp sự cố kết nối. Hãy thử lại sau nhé!';
      
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: errorMessage,
        },
      ]);
    } finally {
      setIsTyping(false);
      setTurnstileToken(null);
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    }
  };

  return (
    <div className="glass rounded-[24px] md:rounded-[32px] overflow-hidden flex flex-col h-[500px] md:h-[600px]">
      <div className="p-4 md:p-6 bg-white/5 border-b border-white/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm md:text-base">Trợ Lý GuangShan</h3>
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Trực tuyến
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={chatModelProvider}
            onChange={(e) => setChatModelProvider(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/70 focus:outline-none focus:border-primary"
          >
            <option value="chatgpt">ChatGPT</option>
            <option value="gemini">Gemini</option>
            <option value="claude">Claude</option>
            <option value="grok">Grok</option>
            <option value="deepseek">DeepSeek</option>
          </select>
          <button
            type="button"
            onClick={handleClearHistory}
            className="px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            Xóa lịch sử
          </button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
        <p className="text-[10px] text-white/30 text-center">Lịch sử chat chỉ lưu trên trình duyệt này.</p>

        {messages.map((msg, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={`${msg.role}-${i}`}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] md:max-w-[80%] p-3 md:p-4 rounded-2xl overflow-hidden ${
                msg.role === 'user' ? 'bg-primary text-white ml-8' : 'bg-white/10 text-white/80 mr-8'
              }`}
            >
              {msg.role === 'user' ? (
                <>
                  <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  {msg.imageBase64 && (
                    <img src={msg.imageBase64} alt="Attached" className="mt-3 max-w-full rounded-lg max-h-48 object-contain border border-white/20" />
                  )}
                </>
              ) : (
                <div className="prose prose-invert prose-sm md:prose-base max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:text-white prose-a:text-secondary prose-strong:text-white marker:text-white/60">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white/10 p-3 md:p-4 rounded-2xl flex gap-1">
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {selectedImage && (
        <div className="px-4 md:px-6 pt-4 bg-white/5 flex gap-2">
          <div className="relative inline-block">
            <img src={selectedImage} alt="Preview" className="h-14 w-14 object-cover rounded-xl border border-white/20" />
            <button 
              type="button" 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:scale-110 transition-transform shadow-lg"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Cloudflare Turnstile */}
      <div className="px-4 md:px-6 pt-2 pb-2 bg-white/5 flex justify-center">
        <Turnstile
          ref={turnstileRef}
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
          onSuccess={(token) => setTurnstileToken(token)}
          options={{ theme: 'dark' }}
        />
      </div>

      <form onSubmit={handleSend} className="p-4 md:p-6 bg-white/5 border-t border-white/5 flex gap-2 md:gap-3 items-center">
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={handleImageUpload} 
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-3 bg-white/5 text-white/50 rounded-xl hover:text-white hover:bg-white/10 transition-colors"
          title="Đính kèm ảnh"
        >
          <ImagePlus className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          placeholder="Nhập câu hỏi hoặc nhấn Ctrl+V để dán ảnh..."
          className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs md:text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          className="p-3 bg-primary text-white rounded-xl hover:scale-105 transition-transform glow"
        >
          <Send className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </form>
    </div>
  );
};

const UserConfig = ({ apiKey, setApiKey, baseUrl, setBaseUrl }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full bg-white/5 rounded-2xl border border-white/10 overflow-hidden transition-all text-left">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">Cấu hình cá nhân (Tùy chọn)</span>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ArrowRight className="w-4 h-4 rotate-90" />
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-2">
            <label className="text-[10px] text-white/40 font-bold uppercase">API Key (Gemini/ChatGPT/Claude/Grok/DeepSeek)</label>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Dùng key của bạn nếu web hết quota..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-white/40 font-bold uppercase">Base URL (Dành cho Proxy)</label>
            <input 
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary"
            />
          </div>
          <p className="text-[9px] text-white/30 italic">* Thông tin Key của bạn chỉ được dùng cho yêu cầu này, không lưu lại trên máy chủ.</p>
        </div>
      )}
    </div>
  );
};

const sanitizeErrorMessage = (error) => {
  const msg = error.response?.data?.error || error.response?.data?.message || error.message || 'Có lỗi xảy ra.';
  const lowerMsg = String(msg).toLowerCase();
  const isSensitive = lowerMsg.includes('/') || lowerMsg.includes('\\') || lowerMsg.includes('wwwroot') || lowerMsg.includes('python') || lowerMsg.includes('import error');
  return isSensitive ? 'Hệ thống gặp sự cố kỹ thuật. Vui lòng thử lại sau hoặc liên hệ quản trị viên.' : msg;
};

const SubTranslatorDemo = () => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Transcribing, 3: Edit & Translate, 4: Done
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef();
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [error, setError] = useState('');
  const [srt, setSrt] = useState('');
  const [translatedSrt, setTranslatedSrt] = useState('');
  const [targetLang, setTargetLang] = useState('vi');
  const [translationProvider, setTranslationProvider] = useState('chatgpt');
  const [userApiKey, setUserApiKey] = useState('');
  const [userBaseUrl, setUserBaseUrl] = useState('');
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      if (selectedFile.name.endsWith('.srt')) {
        const reader = new FileReader();
        reader.onload = (re) => setSrt(re.target.result);
        reader.readAsText(selectedFile);
        setStep(3);
      }
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    if (!turnstileToken) {
      alert("Hệ thống đang kiểm tra bảo mật (Anti-Bot)... Vui lòng đợi 1 giây rồi thử lại!");
      return;
    }
    
    setLoading(true);
    setStep(2);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', 'transcribe');
    formData.append('turnstileToken', turnstileToken);
    if (userApiKey) formData.append('userApiKey', userApiKey);
    if (userBaseUrl) formData.append('userBaseUrl', userBaseUrl);
    try {
      const { data } = await api.post('/ai/generate-sub', formData, {
        headers: {
          'x-turnstile-token': turnstileToken
        }
      });
      setSrt(data.srt);
      setStep(3);
    } catch (err) {
      console.error(err);
      const msg = sanitizeErrorMessage(err);
      if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('api key')) {
        setError(msg + ' Gợi ý: Hãy nhập API Key cá nhân của bạn bên dưới.');
      } else {
        setError(msg);
      }
      setStep(1);
    } finally {
      setLoading(false);
      setTurnstileToken(null);
      if (turnstileRef.current) turnstileRef.current.reset();
    }
  };

  const handleTranslate = async () => {
    if (!turnstileToken) {
      alert("Hệ thống đang kiểm tra bảo mật (Anti-Bot)... Vui lòng đợi 1 giây rồi thử lại!");
      return;
    }
    
    setLoading(true);
    setError('');
    const formData = new FormData();
    const srtBlob = new Blob([srt], { type: 'text/plain' });
    formData.append('file', srtBlob, 'input.srt');
    formData.append('mode', 'translate');
    formData.append('targetLang', targetLang);
    formData.append('translationProvider', translationProvider);
    formData.append('translationModelProvider', translationProvider);
    formData.append('turnstileToken', turnstileToken);
    if (userApiKey) formData.append('userApiKey', userApiKey);
    if (userBaseUrl) formData.append('userBaseUrl', userBaseUrl);
    try {
      const { data } = await api.post('/ai/generate-sub', formData, {
        headers: {
          'x-turnstile-token': turnstileToken
        }
      });
      const translatedItems = Array.isArray(data?.translatedSubs) ? data.translatedSubs : null;
      if (!translatedItems) {
        throw new Error(data?.error || data?.message || 'Du lieu dich khong hop le.');
      }

      const translatedLines = translatedItems
        .map((s, idx) => {
          const index = s?.index ?? idx + 1;
          const start = s?.start_str || s?.start || '00:00:00,000';
          const end = s?.end_str || s?.end || '00:00:00,000';
          const text = s?.text || s?.content || '';
          return `${index}\n${start} --> ${end}\n${text}\n`;
        })
        .join('\n');
      setTranslatedSrt(translatedLines);
      setStep(4);
    } catch (err) {
      console.error(err);
      const msg = sanitizeErrorMessage(err);
      if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit')) {
        setError(msg + ' Gợi ý: Thử nhập API Key cá nhân trong phần Cấu hình nâng cao.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setTurnstileToken(null);
      if (turnstileRef.current) turnstileRef.current.reset();
    }
  };

  return (
    <div className="glass rounded-[32px] p-8 md:p-12 flex flex-col items-center justify-center text-center h-full min-h-[600px] relative overflow-hidden">
      
      {/* Turnstile Widget */}
      {(step === 1 || step === 3) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0">
          <Turnstile
            ref={turnstileRef}
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
            onSuccess={(token) => setTurnstileToken(token)}
            options={{ theme: 'dark', size: 'invisible' }}
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8 max-w-md w-full relative z-10">
            <div className="space-y-2">
              <h3 className="text-3xl font-bold">Dịch thuật Phụ đề</h3>
              <p className="text-white/40">Tải lên video hoặc file .srt để dịch tự động</p>
            </div>
            <label className="cursor-pointer group block space-y-4">
              <input type="file" className="hidden" accept="video/*,audio/*,.srt" onChange={handleFileChange} />
              <div className="w-32 h-32 bg-secondary/10 text-secondary rounded-[40px] flex items-center justify-center mx-auto border-2 border-dashed border-secondary/40 group-hover:border-secondary transition-all">
                <Upload className="w-12 h-12 group-hover:scale-110 transition-transform" />
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <h4 className="font-bold text-lg truncate">{file ? file.name : 'Chọn video/srt'}</h4>
              </div>
            </label>
            {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-xl">{error}</p>}
            
            <UserConfig 
              apiKey={userApiKey} setApiKey={setUserApiKey} 
              baseUrl={userBaseUrl} setBaseUrl={setUserBaseUrl} 
            />

            <button onClick={handleTranscribe} disabled={!file || loading} className="w-full py-4 bg-secondary text-white rounded-2xl font-bold flex items-center justify-center gap-3 glow-blue">
              {file?.name.endsWith('.srt') ? 'Tiếp tục' : 'Bắt đầu nhận diện'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 relative z-10">
            <div className="w-32 h-32 border-4 border-white/5 border-t-secondary rounded-full animate-spin mx-auto" />
            <h3 className="text-2xl font-bold">Đang trích xuất phụ đề...</h3>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-4xl space-y-6 relative z-10">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-grow space-y-4">
                <h4 className="text-left font-bold text-white/60">Nội dung phụ đề</h4>
                <div className="bg-white/5 rounded-2xl border border-white/10 p-4 h-[300px] overflow-y-auto custom-scrollbar text-left text-xs font-mono text-white/50 whitespace-pre-wrap">
                  {srt}
                </div>
              </div>
              <div className="w-full md:w-80 space-y-6 text-left">
                <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/10">
                  <h4 className="font-bold text-sm uppercase text-white/40 tracking-wider">Cài đặt dịch</h4>
                  <div className="space-y-2">
                    <label className="text-xs text-white/60">Ngôn ngữ đích</label>
                    <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-secondary">
                      <option value="vi">Tiếng Việt</option>
                      <option value="en">Tiếng Anh</option>
                      <option value="zh">Tiếng Trung</option>
                      <option value="ja">Tiếng Nhật</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-white/60">Nhóm AI dịch</label>
                    <select value={translationProvider} onChange={(e) => setTranslationProvider(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-secondary">
                      <option value="chatgpt">ChatGPT</option>
                      <option value="gemini">Gemini</option>
                      <option value="claude">Claude</option>
                      <option value="grok">Grok</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="google">Google Translate (Miễn phí)</option>
                    </select>
                  </div>
                </div>

                <UserConfig 
                  apiKey={userApiKey} setApiKey={setUserApiKey} 
                  baseUrl={userBaseUrl} setBaseUrl={setUserBaseUrl} 
                />

                {error && <p className="text-red-400 text-[10px] bg-red-400/5 p-2 rounded-lg">{error}</p>}

                <button onClick={handleTranslate} disabled={loading} className="w-full py-4 bg-secondary text-white rounded-2xl font-bold glow-blue flex items-center justify-center gap-2">
                  {loading ? 'Đang xử lý...' : 'Dịch ngay'}
                  <Wand2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button onClick={() => setStep(1)} className="text-white/40 text-sm">← Quay lại</button>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 max-w-lg w-full relative z-10">
            <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-3xl font-bold">Hoàn tất!</h3>
            <div className="bg-white/5 rounded-2xl p-4 text-left border border-white/10 h-48 overflow-y-auto custom-scrollbar text-[10px] font-mono text-white/40 whitespace-pre-wrap">
              {translatedSrt}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setStep(1)} className="py-4 bg-white/5 text-white rounded-2xl font-bold border border-white/10">Thử lại</button>
              <button onClick={() => {
                const blob = new Blob([translatedSrt], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'translated.srt';
                a.click();
              }} className="py-4 bg-secondary text-white rounded-2xl font-bold glow-blue flex items-center justify-center gap-2">
                Tải về .SRT
                <Download className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TTSDemo = () => {
  const [step, setStep] = useState(1); // 1: Input, 2: Rendering, 3: Done
  const [inputType, setInputType] = useState('text'); // 'text' or 'srt'
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [targetLang, setTargetLang] = useState('vi');
  const [ttsProvider, setTtsProvider] = useState('gtts');
  const [voice, setVoice] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [userApiKey, setUserApiKey] = useState('');
  const [userBaseUrl, setUserBaseUrl] = useState('');
  const turnstileRef = useRef();
  const [turnstileToken, setTurnstileToken] = useState(null);
  const isVideoResult = /\.mp4($|\?)/i.test(resultUrl);

  const resolveResultUrl = (rawUrl) => {
    const cleanUrl = String(rawUrl || '').trim();
    if (!cleanUrl) return '';
    if (/^https?:\/\//i.test(cleanUrl)) return cleanUrl;

    let apiOrigin = '';
    try {
      apiOrigin = new URL(api.defaults.baseURL).origin;
    } catch {
      apiOrigin = window.location.origin;
    }

    const normalizedPath = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
    return `${apiOrigin}${normalizedPath}`;
  };

  const handleDownloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = isVideoResult ? 'tts_rendered.mp4' : 'tts_rendered.mp3';
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleGenerate = async () => {
    if (!turnstileToken && import.meta.env.VITE_TURNSTILE_SITE_KEY) {
      alert("Hệ thống đang kiểm tra bảo mật (Anti-Bot)... Vui lòng đợi 1 giây rồi thử lại!");
      return;
    }

    setLoading(true);
    setStep(2);
    setError('');
    setResultUrl('');

    let subs = [];
    if (inputType === 'text') {
      if (!text.trim()) { setError('Vui lòng nhập văn bản.'); setStep(1); setLoading(false); return; }
      subs = [{ index: 1, start: "00:00:00,000", end: "00:00:10,000", content: text }];
    } else {
      if (!file) { setError('Vui lòng chọn file .srt.'); setStep(1); setLoading(false); return; }
      const content = await file.text();
      subs = content;
    }

    try {
      const { data } = await api.post('/ai/generate-sub', {
        mode: 'render',
        subs: typeof subs === 'string' ? subs : JSON.stringify(subs),
        targetLang,
        ttsProvider,
        voice,
        userApiKey,
        userBaseUrl,
        turnstileToken
      });
      if (data.success && data.output) {
        setResultUrl(resolveResultUrl(data.output));
        setStep(3);
      } else {
        throw new Error(data.error || 'Không có tệp đầu ra.');
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit')) {
        setError(msg + ' Gợi ý: Hãy nhập API Key cá nhân trong phần Cấu hình nâng cao.');
      } else {
        setError('Lỗi khi thuyết minh: ' + msg);
      }
      setStep(1);
    } finally {
      setLoading(false);
      setTurnstileToken(null);
      if (turnstileRef.current) turnstileRef.current.reset();
    }
  };

  return (
    <div className="glass rounded-[32px] p-6 md:p-12 flex flex-col items-center justify-center text-center h-[500px] md:h-[600px] relative overflow-hidden">
      
      {/* Turnstile Widget */}
      {step === 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0">
          <Turnstile
            ref={turnstileRef}
            siteKey={
              (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? '1x00000000000000000000AA'
                : (import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA')
            }
            onSuccess={(token) => setTurnstileToken(token)}
            options={{ theme: 'dark', size: 'invisible' }}
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-8 relative z-10">
            <div className="space-y-2">
              <h3 className="text-3xl font-bold">TTS & Thuyết minh</h3>
              <p className="text-white/40">Chuyển văn bản thành giọng nói hoặc lồng tiếng cho file SRT</p>
            </div>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-fit mx-auto">
              <button onClick={() => setInputType('text')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${inputType === 'text' ? 'bg-purple-600 text-white' : 'text-white/40'}`}>Văn bản thuần</button>
              <button onClick={() => setInputType('srt')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${inputType === 'srt' ? 'bg-purple-600 text-white' : 'text-white/40'}`}>File Phụ đề (.srt)</button>
            </div>
            {inputType === 'text' ? (
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhập văn bản cần thuyết minh tại đây..." className="w-full h-40 bg-white/5 border border-white/10 rounded-[24px] p-4 text-sm focus:outline-none focus:border-purple-500 transition-all custom-scrollbar" />
            ) : (
              <label className="cursor-pointer group block p-12 border-2 border-dashed border-white/10 rounded-[32px] hover:border-purple-500/50 transition-all">
                <input type="file" className="hidden" accept=".srt" onChange={handleFileChange} />
                <Upload className="w-10 h-10 text-purple-600 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-bold">{file ? file.name : 'Nhấn để tải file .srt'}</p>
              </label>
            )}
            <div className="flex flex-wrap justify-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="space-y-2 text-left">
                <label className="text-[10px] text-white/40 font-bold uppercase">Ngôn ngữ</label>
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs">
                  <option value="vi">Tiếng Việt</option><option value="en">Tiếng Anh</option>
                </select>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] text-white/40 font-bold uppercase">Công cụ</label>
                <select value={ttsProvider} onChange={(e) => {
                  setTtsProvider(e.target.value);
                  setVoice(e.target.value === 'gemini' ? 'Kore' : e.target.value === 'openai' ? 'alloy' : '');
                }} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs">
                  <option value="gtts">Google (Free)</option><option value="gemini">Gemini</option><option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="space-y-2 text-left flex-grow">
                <label className="text-[10px] text-white/40 font-bold uppercase">Giọng đọc</label>
                <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs" disabled={ttsProvider === 'gtts'}>
                  {ttsProvider === 'gtts' && <option value="">Mặc định</option>}
                  {ttsProvider === 'gemini' && (
                    <>
                      <option value="Kore">Kore (Nữ trầm)</option>
                      <option value="Aoede">Aoede (Nữ thanh)</option>
                      <option value="Puck">Puck (Nam trầm)</option>
                      <option value="Fenrir">Fenrir (Nam ấm)</option>
                      <option value="Charon">Charon (Nam đĩnh đạc)</option>
                      <option value="Leda">Leda (Nữ trầm tĩnh)</option>
                    </>
                  )}
                  {ttsProvider === 'openai' && (
                    <>
                      <option value="alloy">Alloy (Trung tính)</option>
                      <option value="echo">Echo (Nam)</option>
                      <option value="fable">Fable (Anh-Anh)</option>
                      <option value="onyx">Onyx (Nam trầm)</option>
                      <option value="nova">Nova (Nữ năng động)</option>
                      <option value="shimmer">Shimmer (Nữ ấm áp)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <UserConfig 
              apiKey={userApiKey} setApiKey={setUserApiKey} 
              baseUrl={userBaseUrl} setBaseUrl={setUserBaseUrl} 
            />

            {error && <p className="text-red-400 text-sm bg-red-400/5 p-3 rounded-xl border border-red-400/10">{error}</p>}
            <button onClick={handleGenerate} disabled={loading} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
              Bắt đầu thuyết minh
              <Play className="w-4 h-4 inline-block ml-2 fill-current" />
            </button>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 relative z-10">
            <div className="w-32 h-32 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto relative">
              <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <Play className="w-10 h-10 text-purple-600 animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold">Đang lồng tiếng AI...</h3>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 relative z-10">
            <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 className="w-12 h-12" /></div>
            <h3 className="text-3xl font-bold">Thành phẩm sẵn sàng!</h3>
            {resultUrl && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-white/70">Nghe thử trước khi tải</p>
                {isVideoResult ? (
                  <video src={resultUrl} controls className="w-full rounded-xl bg-black/30" />
                ) : (
                  <audio src={resultUrl} controls className="w-full" />
                )}
              </div>
            )}
            <div className="flex flex-col gap-4">
              <button onClick={handleDownloadResult} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2">Tải Video/Audio <Download className="w-5 h-5" /></button>
              <button onClick={() => setStep(1)} className="text-white/40 text-sm">Quay lại</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SendIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

export default Playground;



