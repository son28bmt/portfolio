import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getModelsByProvider } from '../../constants/aiModelCatalog';
import {
  Bot,
  Sparkles,
  CalendarClock,
  PlayCircle,
  RefreshCw,
  Trash2,
  Power,
} from 'lucide-react';

const initialGenerateForm = {
  topic: '',
  objective: '',
  tone: 'Thân thiện, thực chiến',
  targetAudience: '',
  keywords: '',
  wordCount: 1200,
  scheduledFor: '',
  publishMode: 'publish',
  allowDuplicate: false,
  modelProvider: 'chatgpt',
  modelName: '',
  baseUrl: '',
};

const initialRuleForm = {
  name: '',
  topic: '',
  objective: '',
  tone: 'Chuyên nghiệp, dễ hiểu',
  targetAudience: '',
  keywords: '',
  wordCount: 1000,
  postingTime: '08:00',
  timezone: 'Asia/Ho_Chi_Minh',
  publishMode: 'publish',
  modelProvider: 'chatgpt',
  modelName: '',
  baseUrl: '',
  isActive: true,
};

const MODEL_OPTIONS = [
  { value: 'chatgpt', label: 'ChatGPT/OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'grok', label: 'Grok' },
  { value: 'deepseek', label: 'DeepSeek' },
];

const toKeywords = (raw) =>
  String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const fmtDateTime = (value) => {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('vi-VN');
};

const statusColor = (status) => {
  switch (status) {
    case 'succeeded':
      return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'failed':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'running':
      return 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20';
    default:
      return 'text-white/70 bg-white/5 border-white/10';
  }
};

const AutomationBlog = () => {
  const [generateForm, setGenerateForm] = useState(initialGenerateForm);
  const [ruleForm, setRuleForm] = useState(initialRuleForm);
  const [rules, setRules] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const keywordPreview = useMemo(
    () => toKeywords(generateForm.keywords).slice(0, 10),
    [generateForm.keywords],
  );
  const generateModelSuggestions = useMemo(
    () => getModelsByProvider(generateForm.modelProvider),
    [generateForm.modelProvider],
  );
  const ruleModelSuggestions = useMemo(
    () => getModelsByProvider(ruleForm.modelProvider),
    [ruleForm.modelProvider],
  );

  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const { data } = await api.get('/blog-auto/rules');
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      alert('Không tải được rules: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingRules(false);
    }
  };

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const { data } = await api.get('/blog-auto/jobs', { params: { limit: 20 } });
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      alert('Không tải được jobs: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchJobs();
  }, []);

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (/^sk-[A-Za-z0-9_-]{20,}$/i.test(String(generateForm.modelName || '').trim())) {
      alert('Bạn đang nhập API key vào ô Model cụ thể. Hãy để trống ô này hoặc nhập tên model.');
      return;
    }
    setIsGenerating(true);
    try {
      const payload = {
        ...generateForm,
        keywords: toKeywords(generateForm.keywords),
      };
      const { data } = await api.post('/blog-auto/generate', payload);
      alert(data?.message || 'Đã tạo job AI.');
      setGenerateForm(initialGenerateForm);
      fetchJobs();
    } catch (error) {
      alert('Tạo bài AI thất bại: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateRule = async (event) => {
    event.preventDefault();
    if (/^sk-[A-Za-z0-9_-]{20,}$/i.test(String(ruleForm.modelName || '').trim())) {
      alert('Bạn đang nhập API key vào ô Model cụ thể của rule. Hãy để trống hoặc nhập tên model.');
      return;
    }
    setIsCreatingRule(true);
    try {
      await api.post('/blog-auto/rules', {
        ...ruleForm,
        keywords: toKeywords(ruleForm.keywords),
      });
      alert('Đã tạo rule hằng ngày.');
      setRuleForm(initialRuleForm);
      fetchRules();
    } catch (error) {
      alert('Tạo rule thất bại: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsCreatingRule(false);
    }
  };

  const toggleRule = async (rule) => {
    try {
      await api.put(`/blog-auto/rules/${rule.id}`, { isActive: !rule.isActive });
      fetchRules();
    } catch (error) {
      alert('Không thể cập nhật rule: ' + (error.response?.data?.message || error.message));
    }
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`Xóa rule "${rule.name}"?`)) return;
    try {
      await api.delete(`/blog-auto/rules/${rule.id}`);
      fetchRules();
    } catch (error) {
      alert('Không thể xóa rule: ' + (error.response?.data?.message || error.message));
    }
  };

  const runJob = async (job) => {
    try {
      await api.post(`/blog-auto/jobs/${job.id}/run`);
      fetchJobs();
    } catch (error) {
      alert('Chạy job thất bại: ' + (error.response?.data?.message || error.message));
    }
  };

  const publishDraft = async (job) => {
    try {
      await api.post(`/blog-auto/jobs/${job.id}/publish-draft`);
      fetchJobs();
      alert('Đã publish draft thành công.');
    } catch (error) {
      alert('Publish draft thất bại: ' + (error.response?.data?.message || error.message));
    }
  };

  const runTickNow = async () => {
    try {
      await api.post('/blog-auto/tick');
      fetchJobs();
      fetchRules();
      alert('Đã kích hoạt scheduler tick.');
    } catch (error) {
      alert('Không trigger được tick: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bot className="text-primary" /> Blog Tự Động AI
          </h1>
          <p className="text-white/40 mt-2">
            Nhập chủ đề, AI sẽ viết bài, tạo ảnh cover và đăng theo lịch.
          </p>
        </div>
        <button
          type="button"
          onClick={runTickNow}
          className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Chạy Tick Scheduler
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={handleGenerate} className="glass p-6 rounded-[28px] space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-secondary" /> Tạo bài AI (thủ công/lên lịch)
          </h3>
          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Chủ đề bài viết"
            value={generateForm.topic}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, topic: e.target.value }))}
            required
          />
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm min-h-[90px]"
            placeholder="Mục tiêu bài viết"
            value={generateForm.objective}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, objective: e.target.value }))}
          />
          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Tone (ví dụ: thân thiện, chuyên nghiệp)"
            value={generateForm.tone}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, tone: e.target.value }))}
          />
          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Độc giả mục tiêu"
            value={generateForm.targetAudience}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, targetAudience: e.target.value }))}
          />
          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Từ khóa SEO, cách nhau bởi dấu phẩy"
            value={generateForm.keywords}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, keywords: e.target.value }))}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className="admin-select"
              value={generateForm.modelProvider}
              onChange={(e) => setGenerateForm((prev) => ({ ...prev, modelProvider: e.target.value }))}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
              placeholder="Tên model (ví dụ: gpt-4o-mini, để trống = lấy từ AI Settings)"
              list="generate-model-suggestions"
              autoComplete="off"
              spellCheck={false}
              value={generateForm.modelName}
              onChange={(e) => setGenerateForm((prev) => ({ ...prev, modelName: e.target.value }))}
            />
            <datalist id="generate-model-suggestions">
              {generateModelSuggestions.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>

          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Base URL tùy chọn (để trống = lấy từ AI Settings/proxy)"
            value={generateForm.baseUrl}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="number"
              min={300}
              max={5000}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
              value={generateForm.wordCount}
              onChange={(e) => setGenerateForm((prev) => ({ ...prev, wordCount: e.target.value }))}
            />
            <input
              type="datetime-local"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
              value={generateForm.scheduledFor}
              onChange={(e) => setGenerateForm((prev) => ({ ...prev, scheduledFor: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className="admin-select"
              value={generateForm.publishMode}
              onChange={(e) => setGenerateForm((prev) => ({ ...prev, publishMode: e.target.value }))}
            >
              <option value="publish">Publish ngay</option>
              <option value="draft">Tạo draft để duyệt</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-white/70 px-2">
              <input
                type="checkbox"
                checked={generateForm.allowDuplicate}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, allowDuplicate: e.target.checked }))}
              />
              Cho phép trùng chủ đề
            </label>
          </div>

          {keywordPreview.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {keywordPreview.map((k) => (
                <span
                  key={k}
                  className="text-[11px] px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20"
                >
                  #{k}
                </span>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="px-6 py-3 rounded-2xl bg-primary text-white font-bold hover:scale-[1.01] transition-all disabled:opacity-50"
          >
            {isGenerating ? 'Đang xử lý...' : 'Tạo bài tự động'}
          </button>
        </form>

        <form onSubmit={handleCreateRule} className="glass p-6 rounded-[28px] space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-secondary" /> Rule Tự Động Hằng Ngày
          </h3>
          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Tên rule"
            value={ruleForm.name}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm min-h-[80px]"
            placeholder="Chủ đề hằng ngày"
            value={ruleForm.topic}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, topic: e.target.value }))}
            required
          />
          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Mục tiêu"
            value={ruleForm.objective}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, objective: e.target.value }))}
          />
          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Từ khóa SEO"
            value={ruleForm.keywords}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, keywords: e.target.value }))}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className="admin-select"
              value={ruleForm.modelProvider}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, modelProvider: e.target.value }))}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
              placeholder="Tên model của rule (ví dụ: gemini-2.5-pro)"
              list="rule-model-suggestions"
              autoComplete="off"
              spellCheck={false}
              value={ruleForm.modelName}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, modelName: e.target.value }))}
            />
            <datalist id="rule-model-suggestions">
              {ruleModelSuggestions.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>

          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm"
            placeholder="Base URL tùy chọn cho rule"
            value={ruleForm.baseUrl}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
          />

          <div className="grid grid-cols-3 gap-3">
            <input
              type="number"
              min={300}
              max={5000}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-sm"
              value={ruleForm.wordCount}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, wordCount: e.target.value }))}
            />
            <input
              type="time"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-sm"
              value={ruleForm.postingTime}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, postingTime: e.target.value }))}
            />
            <input
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-sm"
              value={ruleForm.timezone}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, timezone: e.target.value }))}
            />
          </div>

          <select
            className="admin-select"
            value={ruleForm.publishMode}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, publishMode: e.target.value }))}
          >
            <option value="publish">Rule đăng publish ngay</option>
            <option value="draft">Rule tạo draft trước</option>
          </select>

          <button
            type="submit"
            disabled={isCreatingRule}
            className="px-6 py-3 rounded-2xl bg-secondary text-white font-bold hover:scale-[1.01] transition-all disabled:opacity-50"
          >
            {isCreatingRule ? 'Đang lưu...' : 'Thêm rule hằng ngày'}
          </button>
        </form>
      </div>

      <div className="glass rounded-[28px] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Rule hiện tại</h3>
          <button
            type="button"
            onClick={fetchRules}
            className="text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
          >
            {loadingRules ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
        <div className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-sm text-white/40">Chưa có rule tự động nào.</p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="border border-white/10 rounded-2xl p-4 bg-white/[0.02]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{rule.name}</p>
                    <p className="text-xs text-white/50 mt-1">
                      {rule.postingTime} ({rule.timezone}) | {rule.wordCount} từ | mode:{' '}
                      {rule.publishMode || 'publish'} | provider: {rule.modelProvider || 'chatgpt'} | chạy gần nhất:{' '}
                      {rule.lastRunDate || '--'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule(rule)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1 ${
                        rule.isActive
                          ? 'text-green-300 border-green-500/30 bg-green-500/10'
                          : 'text-white/70 border-white/20 bg-white/5'
                      }`}
                    >
                      <Power className="w-3 h-3" /> {rule.isActive ? 'Đang bật' : 'Đang tắt'}
                    </button>
                    <button
                      onClick={() => deleteRule(rule)}
                      className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa
                    </button>
                  </div>
                </div>
                <p className="text-sm text-white/70 mt-3 line-clamp-2">{rule.topic}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="glass rounded-[28px] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Automation Jobs</h3>
          <button
            type="button"
            onClick={fetchJobs}
            className="text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
          >
            {loadingJobs ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>

        <div className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-white/40">Chưa có job nào.</p>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="border border-white/10 rounded-2xl p-4 bg-white/[0.02]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold">{job.topic}</p>
                    <p className="text-xs text-white/50">
                      source: {job.sourceType} | mode: {job.publishMode || 'publish'} | provider:{' '}
                      {job.modelProvider || 'chatgpt'} | schedule: {fmtDateTime(job.scheduledFor)}
                    </p>
                    <p className="text-xs text-white/40">
                      start: {fmtDateTime(job.startedAt)} | finish: {fmtDateTime(job.finishedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${statusColor(job.status)}`}>
                      {job.status}
                    </span>
                    {(job.status === 'failed' || job.status === 'pending') && (
                      <button
                        type="button"
                        onClick={() => runJob(job)}
                        className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1"
                      >
                        <PlayCircle className="w-3 h-3" /> Run
                      </button>
                    )}
                    {job.status === 'succeeded' && !job.blogId && job.meta?.draftReady && (
                      <button
                        type="button"
                        onClick={() => publishDraft(job)}
                        className="px-3 py-2 rounded-xl border border-green-500/30 bg-green-500/10 text-green-300 text-xs font-semibold"
                      >
                        Publish Draft
                      </button>
                    )}
                  </div>
                </div>
                {job.errorMessage && (
                  <p className="text-xs text-red-300 mt-3 whitespace-pre-wrap break-words">{job.errorMessage}</p>
                )}
                {job.blogId && (
                  <div className="mt-2">
                    <Link
                      to={`/blog/edit/${job.blogId}`}
                      className="text-xs text-green-300 hover:text-green-200 underline underline-offset-2"
                    >
                      Mở bài vừa tạo: {job.blog?.title || job.blogId}
                    </Link>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AutomationBlog;
