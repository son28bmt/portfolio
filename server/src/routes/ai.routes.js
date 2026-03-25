const express = require('express');
const axios = require('axios');
const router = express.Router();
const Setting = require('../models/Setting');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
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
  const { apiKey, baseUrl, model, systemPrompt } = req.body;
  console.log('--- [ADMIN] SAVING AI CONFIG ---');
  try {
    const configs = [
      { key: 'ai_apiKey', value: apiKey },
      { key: 'ai_baseUrl', value: baseUrl || 'https://api.openai.com/v1' },
      { key: 'ai_model', value: model || 'gpt-4o' },
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
    
    console.log('✅ AI Config saved successfully');
    res.json({ message: 'Cấu hình đã được lưu thành công' });
  } catch (err) {
    console.error('❌ Lỗi lưu cấu hình AI:', err);
    res.status(500).json({ message: 'Lỗi Database: ' + err.message });
  }
});

// Real Chat logic
router.post('/chat', async (req, res) => {
  const { message, userApiKey, userBaseUrl } = req.body;
  
  try {
    const apiKeySetting = await Setting.findOne({ where: { key: 'ai_apiKey' } });
    const baseUrlSetting = await Setting.findOne({ where: { key: 'ai_baseUrl' } });
    const modelSetting = await Setting.findOne({ where: { key: 'ai_model' } });
    const systemPromptSetting = await Setting.findOne({ where: { key: 'ai_systemPrompt' } });

    const apiKey = userApiKey || apiKeySetting?.value;
    let baseUrl = userBaseUrl || baseUrlSetting?.value || 'https://api.openai.com/v1';
    const model = modelSetting?.value || 'gpt-3.5-turbo';
    const systemPrompt = systemPromptSetting?.value || 'Bạn là một trợ lý AI hữu ích.';

    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    if (!apiKey) {
      return res.json({ reply: 'Admin chưa cấu hình API Key cho Chatbot.' });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
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

router.post('/generate-sub', upload.single('file'), async (req, res) => {
  const { 
    mode = 'transcribe', 
    targetLang = 'vi', 
    ttsProvider = 'gtts', 
    voice = '',
    userApiKey = '',
    userBaseUrl = '',
    translationProvider = 'gemini',
    transcribeModel = ''
  } = req.body;
  const file = req.file;

  if (!file && mode === 'transcribe') {
    return res.status(400).json({ message: 'Vui lòng upload file video/audio' });
  }

  const filePath = file ? file.path : null;
  const workDir = filePath ? path.dirname(filePath) : path.join(__dirname, '../../uploads');

  try {
    const settings = await Setting.findAll({
      where: { key: ['ai_apiKey', 'ai_baseUrl', 'ai_model', 'ai_transcribeModel'] }
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
            provider: normalizedTranslationProvider,
            source_lang: 'auto',
            target_lang: targetLang,
            gemini_keys: apiKey ? [apiKey] : [],
            gemini_base_url: baseUrl,
            openai_key: apiKey,
            openai_base_url: baseUrl,
            openai_model: configData.ai_model || 'gpt-4o',
          }
        }
      };

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
        result.output = `/uploads/${result.output.replace(/\\/g, '/').split('uploads/')[1]}`;
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
