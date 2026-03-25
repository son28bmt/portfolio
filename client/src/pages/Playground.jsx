import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, Upload, Play, CheckCircle2, AlertCircle, Wand2, ArrowRight, Download } from 'lucide-react';

const Playground = () => {
  const [activeDemo, setActiveDemo] = useState('chat'); // 'chat', 'sub', or 'tts'

  return (
    <div className="py-12 max-w-6xl mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8 text-center md:text-left">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <h1 className="text-3xl md:text-5xl font-bold mb-4 flex items-center justify-center md:justify-start gap-4">
            AI Playground
            <Sparkles className="text-primary w-6 h-6 md:w-8 md:h-8 animate-pulse" />
          </h1>
          <p className="text-white/50 text-base md:text-lg max-w-xl mx-auto md:mx-0">
            Thử nghiệm các tính năng AI thông minh tôi đã phát triển. Chọn một bộ công cụ bên dưới để bắt đầu.
          </p>
        </motion.div>

        <div className="flex bg-surface p-1 rounded-2xl border border-white/5 gap-1 overflow-x-auto no-scrollbar max-[400px]:flex-col w-full md:w-auto">
          <button 
            onClick={() => setActiveDemo('chat')}
            className={`px-4 md:px-5 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeDemo === 'chat' ? 'bg-primary text-white glow' : 'text-white/40 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> AI Chat
          </button>
          <button 
            onClick={() => setActiveDemo('sub')}
            className={`px-4 md:px-5 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeDemo === 'sub' ? 'bg-secondary text-white glow-blue' : 'text-white/40 hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4" /> Dịch Phụ đề
          </button>
          <button 
            onClick={() => setActiveDemo('tts')}
            className={`px-4 md:px-5 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeDemo === 'tts' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]' : 'text-white/40 hover:text-white'
            }`}
          >
            <Play className="w-4 h-4" /> TTS & Lồng tiếng
          </button>
        </div>
      </div>

      <div className="min-h-[600px] flex items-stretch">
        <AnimatePresence mode="wait">
          {activeDemo === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="w-full">
              <AIChatDemoLocalHistory />
            </motion.div>
          )}
          {activeDemo === 'sub' && (
            <motion.div key="sub" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="w-full">
              <SubTranslatorDemo />
            </motion.div>
          )}
          {activeDemo === 'tts' && (
            <motion.div key="tts" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="w-full">
              <TTSDemo />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
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
  const [userApiKey, setUserApiKey] = useState('');
  const [userBaseUrl, setUserBaseUrl] = useState('');
  const messagesEndRef = useRef(null);

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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const { data } = await api.post('/ai/chat', {
        message: userMessage.content,
        userApiKey,
        userBaseUrl,
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
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: 'Rất tiếc, tôi đang gặp sự cố kết nối. Hãy thử lại sau nhé!',
        },
      ]);
    } finally {
      setIsTyping(false);
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
            <h3 className="font-bold text-sm md:text-base">Assistant AI</h3>
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Trực tuyến
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClearHistory}
          className="px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          Xóa lịch sử
        </button>
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
              className={`max-w-[90%] md:max-w-[80%] p-3 md:p-4 rounded-2xl ${
                msg.role === 'user' ? 'bg-primary text-white ml-8' : 'bg-white/10 text-white/80 mr-8'
              }`}
            >
              <p className="text-xs md:text-sm leading-relaxed">{msg.content}</p>
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

      <form onSubmit={handleSend} className="p-4 md:p-6 bg-white/5 border-t border-white/5 flex gap-3 md:gap-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập câu hỏi..."
          className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs md:text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          className="p-3 bg-primary text-white rounded-xl hover:scale-105 transition-transform glow"
        >
          <SendIcon className="w-4 h-4 md:w-5 md:h-5" />
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
            <label className="text-[10px] text-white/40 font-bold uppercase">API Key (Gemini/OpenAI)</label>
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

const SubTranslatorDemo = () => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Transcribing, 3: Edit & Translate, 4: Done
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [srt, setSrt] = useState('');
  const [translatedSrt, setTranslatedSrt] = useState('');
  const [targetLang, setTargetLang] = useState('vi');
  const [translationProvider, setTranslationProvider] = useState('gemini');
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
    setLoading(true);
    setStep(2);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', 'transcribe');
    if (userApiKey) formData.append('userApiKey', userApiKey);
    if (userBaseUrl) formData.append('userBaseUrl', userBaseUrl);
    try {
      const { data } = await api.post('/ai/generate-sub', formData);
      setSrt(data.srt);
      setStep(3);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.response?.data?.message || 'Lỗi khi nhận diện giọng nói.';
      if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('api key')) {
        setError(msg + ' Gợi ý: Hãy nhập API Key cá nhân của bạn bên dưới.');
      } else {
        setError(msg);
      }
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    setLoading(true);
    setError('');
    const formData = new FormData();
    const srtBlob = new Blob([srt], { type: 'text/plain' });
    formData.append('file', srtBlob, 'input.srt');
    formData.append('mode', 'translate');
    formData.append('targetLang', targetLang);
    formData.append('translationProvider', translationProvider);
    if (userApiKey) formData.append('userApiKey', userApiKey);
    if (userBaseUrl) formData.append('userBaseUrl', userBaseUrl);
    try {
      const { data } = await api.post('/ai/generate-sub', formData);
      // Giả định backend trả về mảng subs, ta cần convert lại thành SRT string hoặc hiển thị
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
      const msg = err.response?.data?.error || 'Lỗi khi dịch thuật phụ đề.';
      if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit')) {
        setError(msg + ' Gợi ý: Thử nhập API Key cá nhân trong phần Cấu hình nâng cao.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-[32px] p-8 md:p-12 flex flex-col items-center justify-center text-center h-full min-h-[600px] relative overflow-hidden">
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
                    <label className="text-xs text-white/60">Công cụ dịch</label>
                    <select value={translationProvider} onChange={(e) => setTranslationProvider(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-secondary">
                      <option value="gemini">Gemini (Khuyên dùng)</option>
                      <option value="openai">OpenAI (Gói trả phí)</option>
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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setStep(2);
    setError('');

    let subs = [];
    if (inputType === 'text') {
      if (!text.trim()) { setError('Vui lòng nhập văn bản.'); setStep(1); setLoading(false); return; }
      subs = [{ index: 1, start: "00:00:00,000", end: "00:00:10,000", content: text }];
    } else {
      if (!file) { setError('Vui lóng chọn file .srt.'); setStep(1); setLoading(false); return; }
      // Đọc file SRT và gửi lên (giả định route handle JSON subs)
      const content = await file.text();
      // Parser đơn giản hoặc gửi text thô cho backend
      subs = content; // Backend handle string or json
    }

    try {
      const { data } = await api.post('/ai/generate-sub', {
        mode: 'render',
        subs: typeof subs === 'string' ? subs : JSON.stringify(subs),
        targetLang,
        ttsProvider,
        voice,
        userApiKey,
        userBaseUrl
      });
      if (data.success) {
        setResultUrl(data.output);
        setStep(3);
      } else throw new Error(data.error);
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
    }
  };

  return (
    <div className="glass rounded-[32px] p-8 md:p-12 flex flex-col items-center justify-center text-center h-full min-h-[600px] relative overflow-hidden">
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
            <div className="flex flex-col gap-4">
              <button onClick={() => window.open(resultUrl, '_blank')} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2">Tải Video/Audio <Download className="w-5 h-5" /></button>
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


