import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Settings, Sparkles, Save, ShieldCheck, Globe } from 'lucide-react';
import { AI_MODEL_CATALOG } from '../../constants/aiModelCatalog';

const AISettings = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o',
    modelChatgpt: 'gpt-4o',
    modelGemini: '',
    modelClaude: '',
    modelGrok: '',
    modelDeepseek: '',
    imageModel: 'gpt-image-1',
    systemPrompt:
      'Bạn là một trợ lý AI hữu ích, đại diện cho Nguyễn Quang Sơn - một Fullstack Developer.',
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await api.get('/ai/config');
        const hasAnyConfig =
          data.ai_apiKey ||
          data.ai_baseUrl ||
          data.ai_model ||
          data.ai_model_chatgpt ||
          data.ai_model_gemini ||
          data.ai_model_claude ||
          data.ai_model_grok ||
          data.ai_model_deepseek ||
          data.ai_image_model ||
          data.ai_systemPrompt;

        if (!hasAnyConfig) return;

        const chatgptModel = data.ai_model_chatgpt || data.ai_model || 'gpt-4o';
        setFormData({
          apiKey: data.ai_apiKey || '',
          baseUrl: data.ai_baseUrl || '',
          model: chatgptModel,
          modelChatgpt: chatgptModel,
          modelGemini: data.ai_model_gemini || '',
          modelClaude: data.ai_model_claude || '',
          modelGrok: data.ai_model_grok || '',
          modelDeepseek: data.ai_model_deepseek || '',
          imageModel: data.ai_image_model || 'gpt-image-1',
          systemPrompt: data.ai_systemPrompt || '',
        });
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
      alert('Đã lưu cấu hình AI thành công!');
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
        <p className="text-white/40">Quản lý API key, model và system prompt cho toàn bộ hệ thống AI.</p>
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
            <label className="text-xs font-bold text-white/40 uppercase ml-1">Base URL (Proxy/API Gateway)</label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                name="baseUrl"
                value={formData.baseUrl}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-all"
                placeholder="Ví dụ: https://proxy.của-bạn/v1 (để trống = fallback mặc định)"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-white/60">Model theo nhóm AI</label>
            <p className="text-xs text-white/40">
              Điền model cho từng nhóm. Nếu không dùng nhóm nào, để trống ở đó.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                name="modelChatgpt"
                value={formData.modelChatgpt}
                onChange={handleChange}
                placeholder="ChatGPT (vd: gpt-4o)"
                list="chatgpt-model-options"
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="text"
                name="modelGemini"
                value={formData.modelGemini}
                onChange={handleChange}
                placeholder="Gemini (vd: gemini-2.5-flash)"
                list="gemini-model-options"
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="text"
                name="modelClaude"
                value={formData.modelClaude}
                onChange={handleChange}
                placeholder="Claude (vd: claude-sonnet-4-6)"
                list="claude-model-options"
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="text"
                name="modelGrok"
                value={formData.modelGrok}
                onChange={handleChange}
                placeholder="Grok (vd: grok-3)"
                list="grok-model-options"
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="text"
                name="modelDeepseek"
                value={formData.modelDeepseek}
                onChange={handleChange}
                placeholder="DeepSeek (vd: deepseek-chat)"
                list="deepseek-model-options"
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors md:col-span-2"
              />
              <input
                type="text"
                name="imageModel"
                value={formData.imageModel}
                onChange={handleChange}
                placeholder="Image model (vd: gpt-image-1)"
                list="image-model-options"
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors md:col-span-2"
              />
            </div>
            <datalist id="chatgpt-model-options">
              {AI_MODEL_CATALOG.chatgpt.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <datalist id="gemini-model-options">
              {AI_MODEL_CATALOG.gemini.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <datalist id="claude-model-options">
              {AI_MODEL_CATALOG.claude.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <datalist id="grok-model-options">
              {AI_MODEL_CATALOG.grok.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <datalist id="deepseek-model-options">
              {AI_MODEL_CATALOG.deepseek.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <datalist id="image-model-options">
              {AI_MODEL_CATALOG.image.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/60">Hướng dẫn (System Prompt)</label>
            <textarea
              name="systemPrompt"
              value={formData.systemPrompt}
              onChange={handleChange}
              rows={8}
              placeholder="Nhập hướng dẫn cho AI..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
            />
            <p className="text-[10px] text-white/30 italic">
              Dùng để định nghĩa vai trò, tính cách và quy tắc trả lời của AI.
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
            Trường base URL hỗ trợ proxy riêng của bạn, không bị khóa cứng vào endpoint cố định.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AISettings;
