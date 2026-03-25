import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Settings, Sparkles, Save, ShieldCheck, Globe } from 'lucide-react';

const AISettings = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    systemPrompt: 'Bạn là một trợ lý AI hữu ích, đại diện cho Nguyễn Quang Sơn - một Fullstack Developer.'
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await api.get('/ai/config');
        if (data.ai_apiKey || data.ai_baseUrl || data.ai_model || data.ai_systemPrompt) {
          setFormData({
            apiKey: data.ai_apiKey || '',
            baseUrl: data.ai_baseUrl || 'https://api.openai.com/v1',
            model: data.ai_model || 'gpt-4o',
            systemPrompt: data.ai_systemPrompt || '',
          });
        }
      } catch (err) {
        console.error('Không thể tải cấu hình AI:', err);
      }
    };
    fetchConfig();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/ai/config', formData);
      alert('Cấu hình đã được lưu thành công trên Server!');
    } catch (err) {
      alert('Lỗi lưu cấu hình: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Settings className="text-primary" /> Cấu hình AI
        </h1>
        <p className="text-white/40">Quản lý API Key và các tham số cho trợ lý ảo.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass p-8 rounded-[32px] space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase ml-1">API Key</label>
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input 
                type="password" 
                name="apiKey"
                value={formData.apiKey}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-all"
                placeholder="sk-..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase ml-1">Base URL (API Endpoint)</label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input 
                type="text" 
                name="baseUrl"
                value={formData.baseUrl}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-all"
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>

          {/* Model Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/60">MODEL NAME</label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="e.g. gpt-4, claude-3"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/60">HƯỚNG DẪN (SYSTEM PROMPT)</label>
            <textarea
              name="systemPrompt"
              value={formData.systemPrompt}
              onChange={handleChange}
              rows={8}
              placeholder="Nhập hướng dẫn cho chatbot (Ví dụ: Bạn là trợ lý của Sơn...)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
            />
            <p className="text-[10px] text-white/30 italic">
              Dùng để định nghĩa tính cách, vai trò và các quy tắc trả lời của AI.
            </p>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="px-10 py-4 bg-primary text-white rounded-2xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all glow disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </form>

      <div className="p-6 bg-primary/5 border border-primary/10 rounded-[24px] flex gap-4 items-start">
         <Sparkles className="w-6 h-6 text-primary shrink-0 mt-1" />
         <div>
           <h4 className="font-bold text-sm mb-1">Mẹo nhỏ</h4>
           <p className="text-xs text-white/50 leading-relaxed">
             Bạn có thể sử dụng các nhà cung cấp như OpenAI, Groq, hoặc thậm chì là Local LLM thông qua LM Studio/Ollama bằng cách thay đổi Base URL.
           </p>
         </div>
      </div>
    </div>
  );
};

export default AISettings;
