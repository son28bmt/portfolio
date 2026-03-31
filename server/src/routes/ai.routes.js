const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Setting = require('../models/Setting');
const Product = require('../models/Product');
const Project = require('../models/Project');
const Blog = require('../models/Blog');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retryDelays = [0, 2000, 5000]; 

const MODEL_PROVIDER_KEYS = {
  chatgpt: 'ai_model_chatgpt',
  gemini: 'ai_model_gemini',
  claude: 'ai_model_claude',
  grok: 'ai_model_grok',
  deepseek: 'ai_model_deepseek',
};

const MODEL_PROVIDER_DEFAULTS = {
  chatgpt: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
  claude: 'claude-sonnet-4-5',
  grok: 'grok-3',
  deepseek: 'deepseek-chat',
};

const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  'openai',
  'chatgpt',
  'gemini',
  'claude',
  'grok',
  'deepseek',
]);

const normalizeModelProvider = (raw, fallback = 'chatgpt') => {
  const value = String(raw || '').trim().toLowerCase();
  if (value in MODEL_PROVIDER_KEYS) return value;
  if (value === 'openai' || value === 'gpt') return 'chatgpt';
  return fallback;
};

const resolveModelByProvider = (configData, provider = 'chatgpt') => {
  const normalizedProvider = normalizeModelProvider(provider);
  const providerKey = MODEL_PROVIDER_KEYS[normalizedProvider];
  const providerModel = String(configData?.[providerKey] || '').trim();
  if (providerModel) return providerModel;

  if (normalizedProvider === 'chatgpt') {
    return String(configData?.ai_model || MODEL_PROVIDER_DEFAULTS.chatgpt).trim();
  }

  return '';
};

const getProviderErrorMessage = (error) => {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown upstream error'
  );
};

const sanitizeErrorForLog = (error) => {
  if (!error || typeof error !== 'object') return error;

  const status = error?.response?.status;
  const providerMessage = getProviderErrorMessage(error);
  const method = error?.config?.method;
  const url = error?.config?.url;
  const code = error?.code;

  return { status, code, method, url, providerMessage };
};

// GET AI Config (Admin only)
router.get('/config', protect, async (req, res) => {
  try {
    const settings = await Setting.findAll();
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST AI Config (Admin only)
router.post('/config', protect, async (req, res) => {
  const {
    apiKey,
    baseUrl,
    model,
    modelChatgpt,
    modelGemini,
    modelClaude,
    modelGrok,
    modelDeepseek,
    systemPrompt
  } = req.body;
  console.log('--- [ADMIN] SAVING AI CONFIG ---');
  try {
    const safeChatgptModel = modelChatgpt || model || MODEL_PROVIDER_DEFAULTS.chatgpt;

    const configs = [
      { key: 'ai_apiKey', value: apiKey },
      { key: 'ai_baseUrl', value: baseUrl || 'https://api.openai.com/v1' },
      { key: 'ai_model', value: safeChatgptModel },
      { key: 'ai_model_chatgpt', value: safeChatgptModel },
      { key: 'ai_model_gemini', value: modelGemini || '' },
      { key: 'ai_model_claude', value: modelClaude || '' },
      { key: 'ai_model_grok', value: modelGrok || '' },
      { key: 'ai_model_deepseek', value: modelDeepseek || '' },
      { key: 'ai_systemPrompt', value: systemPrompt }
    ];

    for (const item of configs) {
      const [setting, created] = await Setting.findOrCreate({
        where: { key: item.key },
        defaults: { value: item.value }
      });
      
      if (!created) {
        await setting.update({ value: item.value });
      }
    }
    
    console.log('AI Config saved successfully');
    res.json({ message: 'Cấu hình đã được lưu thành công' });
  } catch (err) {
    console.error('Lỗi lưu cấu hình AI:', err);
    res.status(500).json({ message: 'Lỗi Database: ' + err.message });
  }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 30, 
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      error: 'Hệ thống AI đang quá tải hoặc bạn đã sử dụng quá mức 30 lượt/giờ. Vui lòng đợi một lát rồi quay lại nhé!',
      reply: 'Hệ thống AI đang quá tải hoặc bạn đã sử dụng quá mức 30 lượt/giờ. Vui lòng đợi một lát rồi quay lại nhé!'
    });
  }
});

const verifyTurnstile = async (req, res, next) => {
  const { turnstileToken } = req.body;
  if (!process.env.TURNSTILE_SECRET_KEY) {
    return next();
  }
  
  if (!turnstileToken) {
    console.warn('[VerifyTurnstile] Thiếu token từ IP:', req.ip, 'Body keys:', Object.keys(req.body));
    return res.status(403).json({ 
      error: 'Bảo mật: Thiếu mã xác thực an ninh Cloudflare (Turnstile Token).',
      reply: 'Bảo mật: Thiếu mã xác thực an ninh Cloudflare (Turnstile Token).' 
    });
  }
  
  try {
    const form = new URLSearchParams();
    form.append('secret', process.env.TURNSTILE_SECRET_KEY);
    form.append('response', turnstileToken);
    form.append('remoteip', req.ip);
    
    const verifyRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', form);
    if (!verifyRes.data.success) {
      console.error('[VerifyTurnstile] Cloudflare từ chối. Error codes:', verifyRes.data['error-codes']);
      return res.status(403).json({ 
        error: 'Bảo mật: Xác thực Cloudflare Turnstile thất bại (Nghi vấn Bot/Auto Tool).',
        reply: 'Bảo mật: Xác thực Cloudflare Turnstile thất bại (Nghi vấn Bot/Auto Tool).' 
      });
    }
    next();
  } catch (err) {
    console.error('[VerifyTurnstile] Lỗi hệ thống khi xác thực:', err.message);
    return res.status(500).json({ 
      error: 'Bảo mật tạm thời tắt: Lỗi máy chủ khi xác thực rào chắn Cloudflare.',
      reply: 'Bảo mật tạm thời tắt: Lỗi máy chủ khi xác thực rào chắn Cloudflare.' 
    });
  }
};

// Real Chat logic
router.post('/chat', aiLimiter, verifyTurnstile, async (req, res) => {
  const { message, imageBase64, userApiKey, userBaseUrl, modelProvider = 'chatgpt', userModel = '' } = req.body;

  try {
    const settings = await Setting.findAll({
      where: {
        key: [
          'ai_apiKey',
          'ai_baseUrl',
          'ai_model',
          'ai_model_chatgpt',
          'ai_model_gemini',
          'ai_model_claude',
          'ai_model_grok',
          'ai_model_deepseek',
          'ai_systemPrompt',
        ]
      }
    });
    const configData = {};
    settings.forEach((s) => {
      configData[s.key] = s.value;
    });

    const apiKey = userApiKey || configData.ai_apiKey;
    let baseUrl = userBaseUrl || configData.ai_baseUrl || 'https://api.openai.com/v1';
    const normalizedModelProvider = normalizeModelProvider(modelProvider, 'chatgpt');
    const model = String(userModel || resolveModelByProvider(configData, normalizedModelProvider)).trim();
    let systemPrompt = configData.ai_systemPrompt || 'Bạn là một trợ lý AI hữu ích. Bạn đang làm việc trên website nguyenquangson.id.vn. Nhiệm vụ của bạn là tư vấn nhiệt tình, thân thiện, trả lời ngắn gọn súc tích.';

    // --- RAG (RAG CƠ BẢN TỔNG HỢP CONTEXT) ---
    // Tiêm thông tin Marketplace, Projects, Blogs, Playground vào AI
    try {
      const [products, projects, blogs] = await Promise.all([
        Product.findAll({ where: { quantity: { [require('sequelize').Op.gt]: 0 } }, attributes: ['name', 'price', 'description'], raw: true }),
        Project.findAll({ attributes: ['title', 'description', 'tech', 'demo'], limit: 15, raw: true }),
        Blog.findAll({ attributes: ['title', 'slug', 'excerpt'], limit: 15, raw: true })
      ]);

      let ragContext = '\n\n--- DỮ LIỆU TỪ HỆ THỐNG NGUYENQUANGSON.ID.VN ---\nBạn hãy dùng dữ liệu dưới đây để tư vấn hoặc điều hướng người dùng một cách thân thiện. Nếu họ hỏi tool/source code, hãy kiểm tra xem nó có trong Cửa Hàng, Dự Án, Bài Viết, hay Playground không và tư vấn họ cài đặt/dùng/mua nhé:\n\n';

      if (products.length > 0) {
        ragContext += `* KHO HÀNG ĐANG BÁN:\n` + products.map((p, i) => `  ${i + 1}. ${p.name} - Giá: ${Number(p.price).toLocaleString()} VNĐ. Hỗ trợ: ${p.description}`).join('\n') + '\n\n';
      }

      if (projects.length > 0) {
        ragContext += `* CÁC DỰ ÁN TRONG PORTFOLIO CỦA SƠN (Mục Dự Án):\n` + projects.map((p, i) => `  ${i + 1}. Tên project: ${p.title} | Stack: ${typeof p.tech === 'string' ? p.tech : JSON.stringify(p.tech)} | Mô tả: ${p.description}`).join('\n') + '\n\n';
      }

      if (blogs.length > 0) {
        ragContext += `* CÁC BÀI VIẾT NỔI BẬT (Mục Blog):\n` + blogs.map((b, i) => `  ${i + 1}. Bài viết: "${b.title}" - Tóm tắt: ${b.excerpt} - Link bài: /blog/${b.slug}`).join('\n') + '\n\n';
      }

      ragContext += `* PLAYGROUND (CÔNG CỤ ONLINE TRÊN WEB):\n  1. AI Chatbot (như hiện tại)\n  2. Dịch Phụ đề & Video tự động (Subtitle Translator)\n  3. TTS - Lồng tiếng văn bản tự động.\n\n-> LƯU Ý CHO AI: Khi khách hỏi "Có tool này tool kia không", hãy phân tích xem nó hợp với dự án nào hay món hàng nào để chèn vào câu trả lời, đừng bao giờ bê nguyên danh sách ra đọc. Trả lời cực kỳ ngắn gọn, trò chuyện như con người.`;

      systemPrompt += ragContext;
    } catch (err) {
      console.error('Lỗi lấy dữ liệu RAG AI:', err.message);
    }
    // ------------------------

    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    if (!apiKey) {
      return res.json({ reply: 'Admin chưa cấu hình API Key cho Chatbot.' });
    }
    if (!model) {
      return res.status(400).json({
        reply: `Chưa cấu hình model cho nhóm AI '${normalizedModelProvider}'. Vui lòng vào Admin > Cấu hình AI để điền model.`,
      });
    }

    let userContent = message;
    if (imageBase64) {
      userContent = [
        { type: 'text', text: message || "Xin hãy mô tả hoặc phân tích hình ảnh này." },
        { type: 'image_url', image_url: { url: imageBase64 } }
      ];
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    const response = await axios.post(`${baseUrl}/chat/completions`, {
      model: model,
      messages: messages,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.choices && response.data.choices[0]) {
      res.json({ 
        reply: response.data.choices[0].message.content 
      });
    } else {
      res.status(500).json({ 
        reply: 'API trả về kết quả không đúng định dạng. Vui lòng kiểm tra lại Base URL và Model.'
      });
    }
  } catch (err) {
    console.error('Lỗi AI Chat:', err.response?.data || err.message);
    const errorMsg = err.response?.data?.error?.message || err.message;
    res.status(500).json({ 
      reply: `Lỗi kết nối AI: ${errorMsg}`
    });
  }
});

const { runPythonScript } = require('../utils/pythonBridge');
const RUNNER_PATH = path.join(__dirname, '..', 'utils', 'sub_tool_runner.py');

// --- AI Routes ---

router.post('/generate-sub', aiLimiter, upload.single('file'), verifyTurnstile, async (req, res) => {
  const { 
    mode = 'transcribe', 
    targetLang = 'vi', 
    ttsProvider = 'gtts', 
    voice = '',
    userApiKey = '',
    userBaseUrl = '',
    translationProvider = 'gemini',
    translationModelProvider = '',
    translationModel = '',
    transcribeModel = ''
  } = req.body;
  const file = req.file;

  if (!file && mode === 'transcribe') {
    return res.status(400).json({ message: 'Vui lòng upload file video/audio' });
  }

  const filePath = file ? file.path : null;
  const workDir = filePath ? path.dirname(filePath) : UPLOAD_DIR;

  try {
    const settings = await Setting.findAll({
      where: {
        key: [
          'ai_apiKey',
          'ai_baseUrl',
          'ai_model',
          'ai_model_chatgpt',
          'ai_model_gemini',
          'ai_model_claude',
          'ai_model_grok',
          'ai_model_deepseek',
          'ai_transcribeModel'
        ]
      }
    });
    const configData = {};
    settings.forEach(s => configData[s.key] = s.value);

    let apiKey = userApiKey || configData.ai_apiKey;
    let baseUrl = userBaseUrl || configData.ai_baseUrl;

    if (baseUrl && baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    const normalizedTranslationProvider = String(translationProvider || 'gemini').trim().toLowerCase();

    // 1. CHẾ ĐỘ PHÁT HIỆN / TRANSCRIBE
    if (mode === 'transcribe') {
      if (!apiKey) {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.json({ 
          srt: "1\n00:00:01,000 --> 00:00:04,000\n[MO PHONG] Chao mung! Day la phu de mau vi chua cau hinh API Key.",
          message: 'Admin chưa cấu hình API Key cho transcribe.'
        });
      }

      let transBaseUrl = baseUrl || 'https://api.openai.com/v1';
      if (transBaseUrl.endsWith('/')) transBaseUrl = transBaseUrl.slice(0, -1);
      
      let apiUrl = transBaseUrl;
      if (!apiUrl.toLowerCase().includes('audio/transcriptions') && !apiUrl.toLowerCase().includes('/transcriptions')) {
        apiUrl = `${apiUrl}/audio/transcriptions`;
      }

      const isV98Proxy = /v98store\.com/i.test(transBaseUrl);
      const manualTranscribeModel = String(transcribeModel || configData.ai_transcribeModel || '').trim();
      const preferredTranscribeModel = manualTranscribeModel || (
        isV98Proxy
          ? 'whisper-1'
          : String(configData.ai_model || 'gpt-4o-mini-transcribe').trim()
      );

      const transcribeModelCandidates = Array.from(new Set([
        preferredTranscribeModel,
        'gpt-4o-mini-transcribe',
        'gpt-4o-transcribe',
        'gpt-4o',
      ].filter(Boolean)))
      .filter(m => m !== 'whisper-1' || !baseUrl.includes('v98store')); 

      if (transcribeModelCandidates.length === 0) {
        transcribeModelCandidates.push('gpt-4o-mini-transcribe');
      }

      let response = null;
      let lastError = null;

      for (const modelName of transcribeModelCandidates) {
        for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
          if (retryDelays[attempt] > 0) {
            await sleep(retryDelays[attempt]);
          }

          const formData = new FormData();
          formData.append('file', fs.createReadStream(filePath));
          formData.append('model', modelName);
          formData.append('response_format', 'srt');

          try {
            console.log(`Transcribe model attempt: ${modelName} (${attempt + 1}/${retryDelays.length})`);
            response = await axios.post(apiUrl, formData, {
              headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiKey}`,
              },
              timeout: 60000,
            });
            lastError = null;
            break;
          } catch (err) {
            lastError = err;
            const status = err?.response?.status;
            const providerMsg = String(getProviderErrorMessage(err) || '').toLowerCase();
            const retryable = status === 429 || status >= 500;
            const modelUnsupported =
              (status === 400 || status === 404) &&
              /(model|unsupported|not found|invalid)/i.test(providerMsg);

            if (modelUnsupported) break;
            if (status === 429) throw err;
            if (!retryable || attempt === retryDelays.length - 1) break;
          }
        }
        if (response) break;
      }

      if (!response && lastError) throw lastError;

      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.json({ srt: response.data, status: 'success' });
    }

    // 2. CHẾ ĐỘ DỊCH THUẬT
    if (mode === 'translate') {
      if (!filePath || !filePath.toLowerCase().endsWith('.srt')) {
        return res.status(400).json({ message: 'Vui lòng upload file .srt để dịch' });
      }

      const pythonInput = {
        command: 'translate',
        srt_path: filePath,
        work_dir: workDir,
        config: {
          translation: {
            provider:
              normalizedTranslationProvider === 'google'
                ? 'google'
                : OPENAI_COMPATIBLE_PROVIDERS.has(normalizedTranslationProvider)
                  ? 'openai'
                  : normalizedTranslationProvider,
            source_lang: 'auto',
            target_lang: targetLang,
            gemini_keys: apiKey ? [apiKey] : [],
            gemini_base_url: baseUrl,
            openai_key: apiKey,
            openai_base_url: baseUrl,
            openai_model: String(
              translationModel ||
              resolveModelByProvider(
                configData,
                normalizeModelProvider(translationModelProvider || normalizedTranslationProvider, 'chatgpt')
              )
            ).trim(),
          }
        }
      };

      if (
        pythonInput.config.translation.provider !== 'google' &&
        !pythonInput.config.translation.openai_model
      ) {
        return res.status(400).json({
          message: `Chưa cấu hình model cho nhóm AI '${normalizeModelProvider(translationModelProvider || normalizedTranslationProvider, 'chatgpt')}'.`,
        });
      }

      const result = await runPythonScript(RUNNER_PATH, pythonInput);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (result.error) throw new Error(result.error);

      const parseTranslatedFromString = (raw) => {
        if (typeof raw !== 'string' || !raw.trim()) return null;
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].startsWith('[') && lines[i].endsWith(']')) {
            try { return JSON.parse(lines[i]); } catch (e) {}
          }
        }
        return null;
      };

      const translatedSubs = Array.isArray(result) ? result : parseTranslatedFromString(result);
      if (!translatedSubs) throw new Error('Python tool trả về dữ liệu dịch không hợp lệ');

      return res.json({ translatedSubs, status: 'success' });
    }

    // 3. CHẾ ĐỘ TTS & RENDER
    if (mode === 'render') {
      const { subs, videoPath } = req.body; 
      if (!subs) return res.status(400).json({ message: 'Thiếu dữ liệu phụ đề' });

      const pythonInput = {
        command: 'tts_and_render',
        subs: typeof subs === 'string' ? JSON.parse(subs) : subs,
        video_path: videoPath || null,
        output_path: path.join(workDir, `rendered_${Date.now()}.${videoPath ? 'mp4' : 'mp3'}`),
        config: {
          tts: {
            provider: ttsProvider,
            language: targetLang,
            gemini_key: apiKey,
            openai_key: apiKey,
            openai_base_url: baseUrl,
            voice: voice,
            gemini_voice: voice,
            openai_voice: voice
          },
          output: { keep_original_audio: false }
        }
      };

      const result = await runPythonScript(RUNNER_PATH, pythonInput);
      if (result.error) throw new Error(result.error);
      if (result.output) {
        const normalizedOutput = result.output.replace(/\\/g, '/');
        const outputFileName = normalizedOutput.includes('/uploads/')
          ? normalizedOutput.split('/uploads/')[1]
          : path.basename(normalizedOutput);
        result.output = `/uploads/${outputFileName}`;
      }
      return res.json(result);
    }

    res.status(400).json({ message: 'Chế độ không hợp lệ' });

  } catch (error) {
    console.error('Lỗi AI Route:', sanitizeErrorForLog(error));
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const providerStatus = error?.response?.status;
    const providerMessage = getProviderErrorMessage(error);

    if (providerStatus === 429) {
      return res.status(429).json({ message: 'API hết quota hoặc bị giới hạn.', error: providerMessage });
    }
    if (providerStatus) {
      return res.status(providerStatus).json({ message: 'Lỗi từ nhà cung cấp AI.', error: providerMessage });
    }
    return res.status(500).json({ message: 'Lỗi xử lý hệ thống', error: error.message });
  }
});

module.exports = router;
