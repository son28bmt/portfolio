const axios = require('axios');
const { DataTypes } = require('sequelize');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const {
  Blog,
  Setting,
  BlogAutomationRule,
  BlogAutomationJob,
} = require('../models');

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TEXT_MODEL = 'gpt-4o';
const DEFAULT_IMAGE_MODEL = 'gpt-image-1';
const MODEL_PROVIDER_KEYS = {
  chatgpt: 'ai_model_chatgpt',
  gemini: 'ai_model_gemini',
  claude: 'ai_model_claude',
  grok: 'ai_model_grok',
  deepseek: 'ai_model_deepseek',
};

let schedulerTimer = null;
let isSchedulerRunning = false;
let schemaEnsured = false;
let schemaEnsuringPromise = null;
let imageRequestChain = Promise.resolve();
let lastImageRequestAt = 0;

const decodePossibleJson = (value) => {
  let current = value;
  for (let i = 0; i < 4; i += 1) {
    if (typeof current !== 'string') break;
    const text = current.trim();
    if (!text) return '';
    if (!['[', '{', '"'].includes(text[0])) break;
    try {
      current = JSON.parse(text);
    } catch {
      break;
    }
  }
  return current;
};

const toStringArray = (value) => {
  const decoded = decodePossibleJson(value);
  if (Array.isArray(decoded)) {
    return decoded
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof decoded === 'string') {
    const text = decoded.trim();
    if (!text) return [];
    if (text.includes(',')) {
      return text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [text];
  }

  return [];
};

const uniqueTrimmed = (items = []) =>
  [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const waitMs = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const IMAGE_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const getImageMinIntervalMs = () =>
  clampInt(process.env.BLOG_AUTOMATION_IMAGE_MIN_INTERVAL_MS, 0, 120000, 3500);

const getImageRetryAttempts = () =>
  clampInt(process.env.BLOG_AUTOMATION_IMAGE_RETRY_ATTEMPTS, 1, 8, 5);

const parseDurationTokenMs = (raw) => {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return 0;

  // Support formats such as: "90", "15s", "2m", "1m30s", "500ms"
  if (/^\d+(\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  }

  const unitRegex = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let match;
  let total = 0;
  while ((match = unitRegex.exec(text)) !== null) {
    const value = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(value)) continue;
    if (unit === 'ms') total += value;
    if (unit === 's') total += value * 1000;
    if (unit === 'm') total += value * 60 * 1000;
    if (unit === 'h') total += value * 60 * 60 * 1000;
  }
  return Math.round(total);
};

const parseRetryAfterMs = (retryAfterHeader) => {
  const raw = Array.isArray(retryAfterHeader)
    ? String(retryAfterHeader[0] || '').trim()
    : String(retryAfterHeader || '').trim();
  if (!raw) return 0;

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.round(asNumber * 1000);
  }

  const asDateMs = Date.parse(raw);
  if (Number.isFinite(asDateMs)) {
    const delta = asDateMs - Date.now();
    if (delta > 0) return delta;
  }

  return 0;
};

const readHeaderValue = (headers = {}, key = '') => {
  if (!headers || !key) return '';
  const direct = headers[key];
  if (direct !== undefined && direct !== null) return String(direct);

  const lowerKey = key.toLowerCase();
  for (const [headerKey, value] of Object.entries(headers)) {
    if (String(headerKey || '').toLowerCase() === lowerKey) {
      return String(value ?? '');
    }
  }
  return '';
};

const parseRateLimitResetMs = (headers = {}) => {
  const candidates = [
    readHeaderValue(headers, 'x-ratelimit-reset-requests'),
    readHeaderValue(headers, 'x-ratelimit-reset-tokens'),
    readHeaderValue(headers, 'x-ratelimit-reset'),
    readHeaderValue(headers, 'ratelimit-reset'),
    readHeaderValue(headers, 'retry-after'),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  if (!candidates.length) return 0;
  const parsed = candidates
    .map((raw) => parseDurationTokenMs(raw) || parseRetryAfterMs(raw))
    .filter((ms) => Number.isFinite(ms) && ms > 0);
  if (!parsed.length) return 0;
  return Math.max(...parsed);
};

const getRetryDelayMs = (error, attemptIndex = 0) => {
  const headers = error?.response?.headers || {};
  const retryAfterMs = parseRetryAfterMs(readHeaderValue(headers, 'retry-after'));
  const rateLimitResetMs = parseRateLimitResetMs(headers);
  const headerDelayMs = Math.max(retryAfterMs, rateLimitResetMs);
  if (headerDelayMs > 0) {
    return clampInt(headerDelayMs, 500, 5 * 60 * 1000, 5000);
  }

  const baseMs = clampInt(process.env.BLOG_AUTOMATION_IMAGE_RETRY_BASE_MS, 500, 30000, 2500);
  const maxMs = clampInt(process.env.BLOG_AUTOMATION_IMAGE_RETRY_MAX_MS, 1000, 10 * 60 * 1000, 120000);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(maxMs, baseMs * 2 ** attemptIndex + jitter);
};

const executeRateLimitedImageRequest = async (requestFn) => {
  const prev = imageRequestChain;
  let releaseQueue = () => {};
  imageRequestChain = new Promise((resolve) => {
    releaseQueue = resolve;
  });

  await prev.catch(() => {});
  try {
    const minInterval = getImageMinIntervalMs();
    const elapsed = Date.now() - lastImageRequestAt;
    const waitFor = Math.max(0, minInterval - elapsed);
    if (waitFor > 0) {
      await waitMs(waitFor);
    }
    lastImageRequestAt = Date.now();
    const result = await requestFn();
    return result;
  } finally {
    releaseQueue();
  }
};

const sanitizeBaseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
};

const sanitizeOptionalBaseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
};

const isHttpProtocol = (value) => /^https?:\/\//i.test(String(value || '').trim());

const normalizeAndValidateBaseUrl = (value) => {
  const normalized = sanitizeBaseUrl(value || DEFAULT_BASE_URL);
  if (!normalized) return DEFAULT_BASE_URL;
  if (!isHttpProtocol(normalized)) {
    throw new Error('Base URL khong hop le. Vui long them day du http:// hoac https://');
  }
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Base URL phai dung giao thuc http hoac https.');
    }
  } catch {
    throw new Error('Base URL khong hop le.');
  }
  return normalized;
};

const isExpectedHttpParseError = (error) => {
  const message = String(error?.message || '');
  return /Parse Error:\s*Expected HTTP\//i.test(message);
};

const getProtocolFallbackCandidates = (baseUrl) => {
  const normalized = normalizeAndValidateBaseUrl(baseUrl);
  const candidates = [normalized];
  if (normalized.startsWith('http://')) {
    candidates.push(`https://${normalized.slice('http://'.length)}`);
  } else if (normalized.startsWith('https://')) {
    candidates.push(`http://${normalized.slice('https://'.length)}`);
  }
  return [...new Set(candidates)];
};

const toLeadingSlashPath = (path = '') => {
  const raw = String(path || '').trim();
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
};

const getRequestUrlCandidates = ({ baseUrl, path }) => {
  const normalizedPath = toLeadingSlashPath(path);
  const protocolCandidates = getProtocolFallbackCandidates(baseUrl);
  const urls = [];

  for (const protocolBase of protocolCandidates) {
    const cleanedBase = sanitizeBaseUrl(protocolBase);
    const lowerBase = cleanedBase.toLowerCase();
    const lowerPath = normalizedPath.toLowerCase();

    // If caller accidentally passes a full endpoint URL as baseUrl.
    if (lowerBase.endsWith(lowerPath)) {
      urls.push(cleanedBase);
      continue;
    }

    urls.push(`${cleanedBase}${normalizedPath}`);

    // Common case for OpenAI-compatible proxies where user enters only domain/path.
    if (!/\/v1(?:$|\/)/i.test(lowerBase) && !lowerPath.startsWith('/v1/')) {
      urls.push(`${cleanedBase}/v1${normalizedPath}`);
    }
  }

  return [...new Set(urls)];
};

const isRetryableNetworkCode = (code) =>
  ['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'EPROTO', 'ETIMEDOUT'].includes(
    String(code || '').toUpperCase(),
  );

const shouldTryNextCandidate = (error) => {
  if (!error) return false;
  if (isExpectedHttpParseError(error)) return true;
  if (isRetryableNetworkCode(error?.code)) return true;

  const status = Number(error?.response?.status);
  if ([404, 405].includes(status)) return true;

  const providerMessage = String(
    error?.response?.data?.error?.message || error?.response?.data?.message || '',
  ).toLowerCase();

  if (
    status === 400 &&
    /(not found|unknown|no route|endpoint|invalid request url|invalid url|unrecognized)/i.test(
      providerMessage,
    )
  ) {
    return true;
  }

  return false;
};

const postWithProtocolFallback = async ({
  baseUrl,
  path,
  payload,
  headers,
  timeout = 120000,
}) => {
  const candidates = getRequestUrlCandidates({ baseUrl, path });
  let lastError = null;

  for (const candidateUrl of candidates) {
    try {
      const response = await axios.post(candidateUrl, payload, {
        headers,
        timeout,
      });
      return { response, resolvedUrl: candidateUrl };
    } catch (error) {
      lastError = error;
      if (shouldTryNextCandidate(error)) {
        continue;
      }
      throw error;
    }
  }

  if (lastError && isExpectedHttpParseError(lastError)) {
    throw new Error(
      'Proxy khong tra ve HTTP hop le. Thu dung baseUrl day du endpoint OpenAI-compatible (vi du: https://domain/v1).',
    );
  }

  if (lastError?.response?.status === 404) {
    throw new Error(
      'Proxy chua map endpoint chat/images. Thu cau hinh baseUrl co /v1 hoac kiem tra route /chat/completions.',
    );
  }

  throw lastError || new Error('Khong the ket noi den Base URL da cau hinh.');
};

const normalizePostingTime = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '08:00';
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? raw : '08:00';
};

const hhmmToMinutes = (value) => {
  const normalized = normalizePostingTime(value);
  const [h, m] = normalized.split(':').map((part) => Number(part));
  return h * 60 + m;
};

const normalizePostingTimes = (value, fallback = '08:00') => {
  const candidates = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,\n;|]/)
        .map((item) => item.trim())
        .filter(Boolean);

  const normalized = [];
  for (const raw of candidates) {
    const time = String(raw || '').trim();
    if (!time) continue;
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) continue;
    normalized.push(time);
  }

  const unique = [...new Set(normalized)].sort((a, b) => hhmmToMinutes(a) - hhmmToMinutes(b));
  if (unique.length > 0) return unique;
  return [normalizePostingTime(fallback)];
};

const normalizePublishMode = (value) =>
  String(value || '').trim().toLowerCase() === 'draft' ? 'draft' : 'publish';

const normalizeTopicKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeModelProvider = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw in MODEL_PROVIDER_KEYS) return raw;
  if (raw === 'openai' || raw === 'gpt') return 'chatgpt';
  return 'chatgpt';
};

const looksLikeApiKey = (value) =>
  /^sk-[A-Za-z0-9_\-]{20,}$/i.test(String(value || '').trim());

const resolveModelByProvider = (config, provider) => {
  const normalizedProvider = normalizeModelProvider(provider);
  const providerKey = MODEL_PROVIDER_KEYS[normalizedProvider];
  const byProvider = String(config?.[providerKey] || '').trim();
  if (byProvider) return byProvider;
  return String(config?.ai_model_chatgpt || config?.ai_model || DEFAULT_TEXT_MODEL).trim();
};

const ensureTableExists = async (model, tableName) => {
  try {
    await sequelize.getQueryInterface().describeTable(tableName);
  } catch {
    await model.sync();
  }
};

const ensureMissingColumns = async (tableName, columns) => {
  const queryInterface = sequelize.getQueryInterface();
  const desc = await queryInterface.describeTable(tableName);

  for (const col of columns) {
    if (desc[col.name]) continue;
    await queryInterface.addColumn(tableName, col.name, col.definition);
  }
};

const ensureTextColumn = async (tableName, columnName) => {
  const queryInterface = sequelize.getQueryInterface();
  const desc = await queryInterface.describeTable(tableName);
  const col = desc[columnName];
  if (!col) return;

  const type = String(col.type || '').toLowerCase();
  if (type.includes('text')) return;

  if (type.includes('char')) {
    await queryInterface.changeColumn(tableName, columnName, {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
};

const ensureBlogAutomationSchema = async () => {
  if (schemaEnsured) return;
  if (schemaEnsuringPromise) {
    await schemaEnsuringPromise;
    return;
  }

  schemaEnsuringPromise = (async () => {
    await ensureTableExists(BlogAutomationRule, 'blog_automation_rules');
    await ensureTableExists(BlogAutomationJob, 'blog_automation_jobs');

    await ensureMissingColumns('blog_automation_rules', [
      {
        name: 'publishMode',
        definition: {
          type: DataTypes.ENUM('publish', 'draft'),
          allowNull: false,
          defaultValue: 'publish',
        },
      },
      {
        name: 'modelProvider',
        definition: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'chatgpt',
        },
      },
      {
        name: 'modelName',
        definition: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        name: 'baseUrl',
        definition: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        name: 'postingTimes',
        definition: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
    ]);

    await ensureMissingColumns('blog_automation_jobs', [
      {
        name: 'publishMode',
        definition: {
          type: DataTypes.ENUM('publish', 'draft'),
          allowNull: false,
          defaultValue: 'publish',
        },
      },
      {
        name: 'modelProvider',
        definition: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'chatgpt',
        },
      },
      {
        name: 'modelName',
        definition: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        name: 'baseUrl',
        definition: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
    ]);

    await ensureTextColumn('blog_automation_rules', 'targetAudience');
    await ensureTextColumn('blog_automation_jobs', 'targetAudience');

    schemaEnsured = true;
    console.log('[BlogAutomation] Schema checked and upgraded.');
  })();

  try {
    await schemaEnsuringPromise;
  } finally {
    schemaEnsuringPromise = null;
  }
};

const stripHtml = (html = '') => String(html || '').replace(/<[^>]+>/g, ' ');

const estimateReadTime = (contentHtml = '') => {
  const words = stripHtml(contentHtml)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
  const mins = Math.max(3, Math.round(words / 220));
  return `${mins} min`;
};

const getDateLabel = (date = new Date()) =>
  date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const getTimezoneParts = (timezone = 'Asia/Ho_Chi_Minh', at = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const map = {};
  formatter.formatToParts(at).forEach((part) => {
    if (part.type !== 'literal') map[part.type] = part.value;
  });

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
};

const safeJsonFromText = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Continue extracting object fallback.
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sliced);
    } catch {
      return null;
    }
  }

  return null;
};

const normalizeAiContentText = (content) => {
  if (Array.isArray(content)) {
    const merged = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('\n')
      .trim();
    return merged;
  }
  return String(content || '').trim();
};

const escapeHtml = (value = '') =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const plainTextToSimpleHtml = (text = '') => {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const html = lines
    .map((line, idx) => {
      const cleaned = escapeHtml(line.replace(/^#{1,6}\s+/, '').replace(/^[*-]\s+/, '').trim());
      if (!cleaned) return '';
      if (idx === 0) return `<h2>${cleaned}</h2>`;
      return `<p>${cleaned}</p>`;
    })
    .filter(Boolean)
    .join('');

  return html;
};

const fallbackArticleFromText = ({ text, topic, keywords = [] }) => {
  const cleaned = String(text || '').trim();
  const titleCandidate = cleaned.split('\n').find((line) => String(line || '').trim()) || topic;
  const title = String(titleCandidate || topic)
    .replace(/^#{1,6}\s+/, '')
    .trim()
    .slice(0, 180) || topic;
  const excerpt = cleaned.replace(/\s+/g, ' ').trim().slice(0, 280);
  const contentHtml = plainTextToSimpleHtml(cleaned);

  return sanitizeArticlePayload(
    {
      title,
      excerpt,
      readTime: '',
      tags: uniqueTrimmed(keywords).slice(0, 8),
      coverImagePrompt: `Anh cover hien dai cho bai viet cong nghe: ${title}`,
      contentHtml,
    },
    topic,
  );
};

const hasRecentTopicCollision = async ({ topic, withinHours = 24 }) => {
  const topicKey = normalizeTopicKey(topic);
  if (!topicKey) return false;

  const windowHours = clampInt(withinHours, 1, 24 * 30, 24);
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const recentJobs = await BlogAutomationJob.findAll({
    where: {
      createdAt: { [Op.gte]: since },
      status: { [Op.ne]: 'failed' },
    },
    attributes: ['topic'],
    limit: 200,
    order: [['createdAt', 'DESC']],
  });
  const hasJobCollision = recentJobs.some(
    (item) => normalizeTopicKey(item.topic) === topicKey,
  );
  if (hasJobCollision) return true;

  const recentBlogs = await Blog.findAll({
    where: { createdAt: { [Op.gte]: since } },
    attributes: ['title'],
    limit: 200,
    order: [['createdAt', 'DESC']],
  });
  return recentBlogs.some(
    (item) => normalizeTopicKey(item.title) === topicKey,
  );
};

const getAiConfig = async () => {
  const settings = await Setting.findAll({
    where: {
      key: [
        'ai_apiKey',
        'ai_baseUrl',
        'ai_image_baseUrl',
        'ai_model',
        'ai_model_chatgpt',
        'ai_model_gemini',
        'ai_model_claude',
        'ai_model_grok',
        'ai_model_deepseek',
        'ai_image_model',
      ],
    },
  });

  const map = {};
  settings.forEach((item) => {
    map[item.key] = item.value;
  });

  const apiKey = String(map.ai_apiKey || '').trim();
  const baseUrl = sanitizeOptionalBaseUrl(map.ai_baseUrl || '');
  const imageBaseUrl = sanitizeOptionalBaseUrl(map.ai_image_baseUrl || '');
  const textModel = String(map.ai_model_chatgpt || map.ai_model || DEFAULT_TEXT_MODEL).trim();
  const imageModel = String(map.ai_image_model || DEFAULT_IMAGE_MODEL).trim();

  return { ...map, apiKey, baseUrl, imageBaseUrl, textModel, imageModel };
};

const sanitizeArticlePayload = (raw = {}, fallbackTopic = 'Bai viet moi') => {
  const title = String(raw.title || fallbackTopic).trim().slice(0, 180) || 'Bai viet moi';
  const excerpt = String(raw.excerpt || '').trim().slice(0, 500);
  const contentHtml = String(raw.contentHtml || raw.content || '').trim();
  const tags = uniqueTrimmed(toStringArray(raw.tags)).slice(0, 8);
  const coverImagePrompt = String(raw.coverImagePrompt || '').trim().slice(0, 900);
  const readTime = String(raw.readTime || '').trim();

  if (!contentHtml || contentHtml.length < 400) {
    throw new Error('Noi dung AI qua ngan hoac khong hop le.');
  }

  return {
    title,
    excerpt,
    contentHtml,
    tags,
    coverImagePrompt,
    readTime: readTime || estimateReadTime(contentHtml),
  };
};

const requestArticleFromAi = async ({
  apiKey,
  baseUrl,
  model,
  topic,
  objective,
  tone,
  targetAudience,
  keywords,
  wordCount,
}) => {
  const userPrompt = [
    `Chu de: ${topic}`,
    objective ? `Muc tieu: ${objective}` : null,
    tone ? `Tone: ${tone}` : null,
    targetAudience ? `Doc gia muc tieu: ${targetAudience}` : null,
    keywords?.length ? `Tu khoa SEO: ${keywords.join(', ')}` : null,
    `Do dai muc tieu: khoang ${wordCount} tu`,
    'Ngon ngu: Tieng Viet.',
    'Chi tra ve JSON hop le, khong kem giai thich.',
    'Schema JSON bat buoc:',
    '{"title":"...","excerpt":"...","readTime":"7 min","tags":["..."],"coverImagePrompt":"...","contentHtml":"<h2>...</h2><p>...</p>"}',
    'contentHtml phai dung HTML sach voi h2/h3/p/ul/li/strong, khong script, khong markdown.',
  ]
    .filter(Boolean)
    .join('\n');

  const payload = {
    model,
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content:
          'Ban la content strategist va SEO editor cao cap. Viet bai chat luong cao, thong tin ro rang, co cau truc logic, de doc, khong khoa tu spam.',
      },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  };

  let response;
  try {
    const sent = await postWithProtocolFallback({
      baseUrl,
      path: '/chat/completions',
      payload,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    });
    response = sent.response;
  } catch (error) {
    // Fallback for providers that do not support response_format.
    const fallbackPayload = { ...payload };
    delete fallbackPayload.response_format;
    const sent = await postWithProtocolFallback({
      baseUrl,
      path: '/chat/completions',
      payload: fallbackPayload,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    });
    response = sent.response;
  }

  const content = normalizeAiContentText(response?.data?.choices?.[0]?.message?.content);
  const parsed = safeJsonFromText(content);
  if (!parsed) {
    if (String(content || '').trim().length >= 400) {
      return fallbackArticleFromText({ text: content, topic, keywords });
    }
    throw new Error('AI khong tra ve JSON hop le cho bai viet.');
  }

  return sanitizeArticlePayload(parsed, topic);
};

const shortenForPrompt = (value, max = 240) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, max);
};

const buildCoverImagePrompt = ({
  topic,
  title,
  excerpt,
  objective,
  tags = [],
  aiHint = '',
}) => {
  const safeTags = uniqueTrimmed(toStringArray(tags)).slice(0, 8);
  const focus = [shortenForPrompt(topic, 180), shortenForPrompt(title, 180)]
    .filter(Boolean)
    .join(' | ');

  // Nâng cấp Prompt để ép AI tạo ảnh bìa tech chuyên nghiệp
// Nâng cấp Prompt để ép AI tạo ảnh bìa tech CỰC KỲ TRỰC QUAN, ĐẲNG CẤP SẢN PHẨM, KHÔNG CHỮ
  const hint = shortenForPrompt(aiHint, 180);
  const lines = [
    'Create a premium editorial cover image for a technology article.',
    focus ? `Core topic: ${focus}.` : '',
    objective ? `Article goal: ${shortenForPrompt(objective, 180)}.` : '',
    excerpt ? `Context: ${shortenForPrompt(excerpt, 220)}.` : '',
    safeTags.length ? `Keywords: ${safeTags.join(', ')}.` : '',
    hint ? `Visual hint: ${hint}.` : '',
    'Style: modern technology, cinematic lighting, high detail, professional composition.',
    'Strictly no text, no letters, no logos, no watermark, no UI screenshot.',
    'Avoid unrelated subjects such as flowers, random nature, animals, or cartoons.',
  ];

  return lines.filter(Boolean).join('\n');
};

const buildCompactCoverPrompt = ({ topic, title, tags = [] }) => {
  const safeTags = uniqueTrimmed(toStringArray(tags)).slice(0, 6);
  const subject = shortenForPrompt(topic || title, 120) || 'technology article';
  const tagText = safeTags.length ? `Keywords: ${safeTags.join(', ')}.` : '';
  return [
    `Create a clean, realistic tech cover image about: ${subject}.`,
    tagText,
    'No text or watermark.',
  ]
    .filter(Boolean)
    .join(' ');
};

const toSvgSafeText = (value, max = 120) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/[<>&"]/g, '');

const buildFallbackCoverDataUrl = (seedText = 'Tech Blog Cover') => {
  const label = toSvgSafeText(seedText, 90) || 'Tech Blog Cover';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0b1020"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#a78bfa" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <circle cx="1320" cy="170" r="180" fill="#06b6d4" opacity="0.12"/>
  <circle cx="260" cy="760" r="230" fill="#8b5cf6" opacity="0.12"/>
  <rect x="120" y="120" rx="28" ry="28" width="1360" height="660" fill="#0b1220" opacity="0.55" stroke="#334155" stroke-opacity="0.5"/>
  <rect x="180" y="690" width="520" height="10" rx="5" fill="url(#line)"/>
  <text x="180" y="360" fill="#e2e8f0" font-size="64" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${label}</text>
  <text x="180" y="430" fill="#94a3b8" font-size="30" font-family="Segoe UI, Arial, sans-serif">AI-generated cover placeholder</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const requestCoverImage = async ({
  apiKey,
  baseUrl,
  imageModel,
  prompt,
  promptVariants = [],
  fallbackSeed = 'portfolio-blog',
}) => {
  const allPrompts = uniqueTrimmed([
    String(prompt || '').trim(),
    ...(Array.isArray(promptVariants) ? promptVariants : []),
  ]);
  if (allPrompts.length === 0) {
    return buildFallbackCoverDataUrl(fallbackSeed);
  }

  const modelCandidates = uniqueTrimmed([imageModel, DEFAULT_IMAGE_MODEL]);
  const payloadVariants = [
    { size: '1536x1024', response_format: 'url', n: 1 },
    { size: '1536x1024', response_format: 'b64_json', n: 1 },
    { size: '1024x1024', response_format: 'url', n: 1 },
    { size: '1024x1024', response_format: 'b64_json', n: 1 },
    { size: '1024x1024', n: 1 },
    { size: '512x512', n: 1 },
  ];

  const extractImageFromResponse = (response) => {
    const responseData = response?.data;
    const contentType = String(response?.headers?.['content-type'] || '').toLowerCase();

    if (typeof responseData === 'string') {
      const text = responseData.trim();
      if (/^https?:\/\//i.test(text) || /^data:image\//i.test(text)) return text;
    }

    if (Buffer.isBuffer(responseData) && contentType.startsWith('image/')) {
      return `data:${contentType};base64,${responseData.toString('base64')}`;
    }

    const list = Array.isArray(responseData?.data) ? responseData.data : [];
    for (const item of list) {
      if (typeof item === 'string') {
        if (/^https?:\/\//i.test(item) || /^data:image\//i.test(item)) return item;
        continue;
      }
      if (item?.url) return item.url;
      if (item?.image_url) return item.image_url;
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.base64) return `data:image/png;base64,${item.base64}`;
    }

    if (responseData?.url) return responseData.url;
    if (responseData?.image_url) return responseData.image_url;
    if (responseData?.b64_json) return `data:image/png;base64,${responseData.b64_json}`;
    if (responseData?.base64) return `data:image/png;base64,${responseData.base64}`;
    return '';
  };

  let lastError = null;
  const maxRetries = getImageRetryAttempts();
  for (const modelName of modelCandidates) {
    for (const promptText of allPrompts) {
      for (const variant of payloadVariants) {
        for (let retryAttempt = 0; retryAttempt < maxRetries; retryAttempt += 1) {
          const payload = {
            model: modelName,
            prompt: promptText,
            size: variant.size,
            n: variant.n || 1,
          };
          if (variant.response_format) payload.response_format = variant.response_format;

          try {
            const sent = await executeRateLimitedImageRequest(() =>
              postWithProtocolFallback({
                baseUrl,
                path: '/images/generations',
                payload,
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 120000,
              }),
            );
            const image = extractImageFromResponse(sent.response);
            if (image) return image;
            throw new Error('Image response does not contain url or base64 data.');
          } catch (error) {
            lastError = error;
            const statusCode = Number(error?.response?.status || 0);
            const responseHeaders = error?.response?.headers || {};
            const retryAfterHeader = readHeaderValue(responseHeaders, 'retry-after');
            const resetRequestsHeader = readHeaderValue(
              responseHeaders,
              'x-ratelimit-reset-requests',
            );
            const resetTokensHeader = readHeaderValue(
              responseHeaders,
              'x-ratelimit-reset-tokens',
            );
            const providerMessage = String(
              error?.response?.data?.error?.message ||
                error?.response?.data?.message ||
                error?.message ||
                '',
            )
              .replace(/\s+/g, ' ')
              .trim();
            const attemptLabel = `${retryAttempt + 1}/${maxRetries}`;
            console.warn(
              '[BlogAutomation] image generation attempt failed:',
              modelName,
              variant.size,
              variant.response_format || 'plain',
              statusCode || error?.code || 'unknown',
              providerMessage || 'no provider message',
              `attempt=${attemptLabel}`,
            );
            if (statusCode === 429) {
              console.warn(
                '[BlogAutomation] image rate-limit headers:',
                `retry-after=${retryAfterHeader || '-'}`,
                `x-ratelimit-reset-requests=${resetRequestsHeader || '-'}`,
                `x-ratelimit-reset-tokens=${resetTokensHeader || '-'}`,
              );
            }

            const canRetry =
              IMAGE_RETRYABLE_STATUSES.has(statusCode) && retryAttempt < maxRetries - 1;
            if (canRetry) {
              const retryDelayMs = getRetryDelayMs(error, retryAttempt);
              console.warn(
                '[BlogAutomation] image generation retry wait:',
                `${retryDelayMs}ms`,
                `status=${statusCode}`,
              );
              await waitMs(retryDelayMs);
              continue;
            }
            break;
          }
        }
      }
    }
  }

  if (lastError) {
    console.warn('[BlogAutomation] image generation fallback:', lastError?.message || lastError);
  }
  return buildFallbackCoverDataUrl(fallbackSeed);
};

const sanitizeImageForStorage = (imageUrl, fallbackSeed) => {
  const raw = String(imageUrl || '').trim();
  if (!raw) {
    return buildFallbackCoverDataUrl(fallbackSeed);
  }
  // Keep data URLs unless they are excessively large for DB payloads.
  if (raw.startsWith('data:') && raw.length > 4_500_000) {
    return buildFallbackCoverDataUrl(fallbackSeed);
  }
  return raw;
};

const normalizeAutomationInput = (payload = {}) => {
  const topic = String(payload.topic || '').trim();
  if (!topic) {
    throw new Error('Topic la bat buoc.');
  }

  return {
    topic,
    objective: String(payload.objective || '').trim() || null,
    tone: String(payload.tone || '').trim() || 'chuyen nghiep, than thien',
    targetAudience: String(payload.targetAudience || '').trim().slice(0, 5000) || null,
    keywords: uniqueTrimmed(toStringArray(payload.keywords)).slice(0, 12),
    wordCount: clampInt(payload.wordCount, 300, 5000, 1200),
    modelProvider: normalizeModelProvider(payload.modelProvider),
    modelName: (() => {
      const rawModelName = String(payload.modelName || '').trim();
      if (!rawModelName) return null;
      if (looksLikeApiKey(rawModelName)) {
        throw new Error(
          'Ban dang nhap API key vao o "Model cu the". Hay de trong o nay hoac nhap ten model (vi du: gpt-4o-mini).',
        );
      }
      return rawModelName;
    })(),
    baseUrl: String(payload.baseUrl || '').trim() || null,
  };
};

const createAutomationJob = async ({
  sourceType = 'manual',
  publishMode = 'publish',
  ruleId = null,
  scheduledFor = null,
  payload = {},
  meta = {},
  checkDuplicate = sourceType === 'manual',
  duplicateWindowHours = Number(process.env.BLOG_AUTOMATION_DEDUP_HOURS || 24),
}) => {
  await ensureBlogAutomationSchema();

  const normalized = normalizeAutomationInput(payload);
  const scheduleDate = scheduledFor ? new Date(scheduledFor) : new Date();
  const finalScheduledFor =
    Number.isNaN(scheduleDate.getTime()) ? new Date() : scheduleDate;

  if (checkDuplicate) {
    const collided = await hasRecentTopicCollision({
      topic: normalized.topic,
      withinHours: duplicateWindowHours,
    });
    if (collided) {
      throw new Error(
        `Chu de nay da xuat hien gan day (${duplicateWindowHours}h). Neu muon tao lai, bat tuy chon allowDuplicate.`,
      );
    }
  }

  return BlogAutomationJob.create({
    sourceType,
    publishMode: normalizePublishMode(publishMode),
    modelProvider: normalized.modelProvider,
    modelName: normalized.modelName,
    baseUrl: normalized.baseUrl,
    ruleId,
    topic: normalized.topic,
    objective: normalized.objective,
    tone: normalized.tone,
    targetAudience: normalized.targetAudience,
    keywords: normalized.keywords,
    wordCount: normalized.wordCount,
    scheduledFor: finalScheduledFor,
    status: 'pending',
    meta: {
      ...(meta || {}),
      duplicateWindowHours: clampInt(duplicateWindowHours, 1, 24 * 30, 24),
    },
  });
};

const generateDraftForJob = async (job) => {
  const config = await getAiConfig();
  if (!config.apiKey) {
    throw new Error('Chua cau hinh ai_apiKey trong AI Settings.');
  }
  const modelProvider = normalizeModelProvider(job.modelProvider);
  const unsafeJobModel = String(job.modelName || '').trim();
  const effectiveJobModel = looksLikeApiKey(unsafeJobModel) ? '' : unsafeJobModel;
  const textModel = String(
    effectiveJobModel || resolveModelByProvider(config, modelProvider),
  ).trim();
  const baseUrl = normalizeAndValidateBaseUrl(
    job.baseUrl || config.baseUrl || DEFAULT_BASE_URL,
  );
  const imageBaseUrl = normalizeAndValidateBaseUrl(
    config.imageBaseUrl || job.baseUrl || config.baseUrl || DEFAULT_BASE_URL,
  );
  if (!textModel) {
    throw new Error(`Chua cau hinh model cho nhom '${modelProvider}'.`);
  }

  const article = await requestArticleFromAi({
    apiKey: config.apiKey,
    baseUrl,
    model: textModel,
    topic: job.topic,
    objective: job.objective,
    tone: job.tone,
    targetAudience: job.targetAudience,
    keywords: toStringArray(job.keywords),
    wordCount: clampInt(job.wordCount, 300, 5000, 1200),
  });

  const mergedTags = uniqueTrimmed([
    ...toStringArray(job.keywords),
    ...toStringArray(article.tags),
  ]).slice(0, 10);

  const coverPrompt = buildCoverImagePrompt({
    topic: job.topic,
    title: article.title,
    excerpt: article.excerpt,
    objective: job.objective,
    tags: mergedTags,
    aiHint: article.coverImagePrompt,
  });
  const compactCoverPrompt = buildCompactCoverPrompt({
    topic: job.topic,
    title: article.title,
    tags: mergedTags,
  });

  const imageUrl = await requestCoverImage({
    apiKey: config.apiKey,
    baseUrl: imageBaseUrl,
    imageModel: config.imageModel || DEFAULT_IMAGE_MODEL,
    prompt: coverPrompt,
    promptVariants: [compactCoverPrompt],
    fallbackSeed: article.title || job.topic,
  });

  const safeImageUrl = sanitizeImageForStorage(imageUrl, article.title || job.topic);
  const draftPayload = {
    title: article.title,
    excerpt: article.excerpt,
    content: article.contentHtml,
    date: getDateLabel(new Date()),
    readTime: article.readTime || estimateReadTime(article.contentHtml),
    tags: mergedTags,
    image: safeImageUrl,
  };

  return {
    draftPayload,
    article,
    imageUrl: safeImageUrl,
    config,
    textModel,
    modelProvider,
    baseUrl,
    imageBaseUrl,
  };
};

const publishBlogFromDraft = async (draftPayload = {}) => {
  if (!draftPayload?.title || !draftPayload?.content) {
    throw new Error('Draft payload khong hop le de publish.');
  }

  const blog = await Blog.create({
    title: draftPayload.title,
    excerpt: draftPayload.excerpt || '',
    content: draftPayload.content,
    date: draftPayload.date || getDateLabel(new Date()),
    readTime: draftPayload.readTime || estimateReadTime(draftPayload.content),
    tags: toStringArray(draftPayload.tags),
    image: String(draftPayload.image || '').trim() || null,
  });

  return blog;
};

const runAutomationJob = async (jobId, { throwOnError = false } = {}) => {
  await ensureBlogAutomationSchema();

  const job = await BlogAutomationJob.findByPk(jobId);
  if (!job) throw new Error('Khong tim thay automation job.');

  if (job.status === 'running') {
    throw new Error('Job dang duoc xu ly.');
  }

  await job.update({
    status: 'running',
    startedAt: new Date(),
    finishedAt: null,
    errorMessage: null,
  });

  try {
    const {
      draftPayload,
      article,
      imageUrl,
      config,
      textModel,
      modelProvider,
      baseUrl,
      imageBaseUrl,
    } =
      await generateDraftForJob(job);
    const publishMode = normalizePublishMode(job.publishMode);
    let blog = null;
    if (publishMode === 'publish') {
      blog = await publishBlogFromDraft(draftPayload);
    }

    await job.update({
      status: 'succeeded',
      blogId: blog?.id || null,
      finishedAt: new Date(),
      meta: {
        ...(job.meta || {}),
        title: blog?.title || draftPayload.title,
        modelProvider,
        textModel,
        baseUrl,
        imageBaseUrl,
        imageModel: config.imageModel,
        publishMode,
        draftReady: publishMode === 'draft',
        draft: publishMode === 'draft' ? draftPayload : null,
        imageUrlType: imageUrl.startsWith('data:') ? 'data-url' : 'url',
        aiTitle: article.title,
      },
    });

    if (job.sourceType === 'rule' && job.ruleId) {
      const timezone = String(job.meta?.timezone || 'Asia/Ho_Chi_Minh');
      const doneDate = getTimezoneParts(timezone, new Date()).date;
      await BlogAutomationRule.update(
        { lastRunDate: doneDate },
        { where: { id: job.ruleId } },
      );
    }

    return BlogAutomationJob.findByPk(job.id);
  } catch (error) {
    const providerStatus = Number(error?.response?.status || 0);
    const providerMessage = String(
      error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Unknown automation error',
    ).trim();
    const errMsg = providerStatus
      ? `[Upstream ${providerStatus}] ${providerMessage}`
      : providerMessage;
    await job.update({
      status: 'failed',
      finishedAt: new Date(),
      errorMessage: errMsg.slice(0, 5000),
    });

    if (throwOnError) throw error;
    return BlogAutomationJob.findByPk(job.id);
  }
};

const publishDraftFromJob = async (jobId) => {
  await ensureBlogAutomationSchema();

  const job = await BlogAutomationJob.findByPk(jobId);
  if (!job) throw new Error('Khong tim thay automation job.');
  if (job.status !== 'succeeded') {
    throw new Error('Chi publish duoc draft khi job da succeeded.');
  }
  if (job.blogId) {
    return Blog.findByPk(job.blogId);
  }

  const draftPayload = job.meta?.draft;
  if (!draftPayload) {
    throw new Error('Job nay khong co draft de publish.');
  }

  const blog = await publishBlogFromDraft(draftPayload);
  await job.update({
    blogId: blog.id,
    meta: {
      ...(job.meta || {}),
      draftReady: false,
      draftPublishedAt: new Date().toISOString(),
    },
  });
  return blog;
};

const processDueJobs = async (limit = 3) => {
  await ensureBlogAutomationSchema();

  const jobs = await BlogAutomationJob.findAll({
    where: {
      status: 'pending',
      scheduledFor: { [Op.lte]: new Date() },
    },
    order: [['scheduledFor', 'ASC']],
    limit,
  });

  for (const job of jobs) {
    try {
      await runAutomationJob(job.id, { throwOnError: false });
    } catch (error) {
      console.error('[BlogAutomation] run job error:', error?.message || error);
    }
  }

  return jobs.length;
};

const enqueueJobsFromRules = async () => {
  await ensureBlogAutomationSchema();

  const rules = await BlogAutomationRule.findAll({
    where: { isActive: true },
    order: [['createdAt', 'ASC']],
  });

  let created = 0;
  const now = new Date();

  for (const rule of rules) {
    const { date, time } = getTimezoneParts(rule.timezone || 'Asia/Ho_Chi_Minh', now);
    const timeSlots = normalizePostingTimes(rule.postingTimes, rule.postingTime);
    const existingJobs = await BlogAutomationJob.findAll({
      where: { ruleId: rule.id, sourceType: 'rule' },
      attributes: ['id', 'status', 'createdAt', 'updatedAt', 'finishedAt', 'meta'],
      order: [['createdAt', 'DESC']],
      limit: 400,
    });

    for (const slot of timeSlots) {
      if (hhmmToMinutes(time) < hhmmToMinutes(slot)) continue;

      const sameSlotJob = existingJobs.find(
        (job) =>
          String(job.meta?.ruleRunDate || '') === date &&
          String(job.meta?.scheduledSlot || '') === slot,
      );

      if (sameSlotJob?.status === 'pending' || sameSlotJob?.status === 'running' || sameSlotJob?.status === 'succeeded') {
        continue;
      }

      if (sameSlotJob?.status === 'failed') {
        const cooldownMinutes = clampInt(
          process.env.BLOG_AUTOMATION_RULE_RETRY_MINUTES,
          5,
          24 * 60,
          30,
        );
        const lastAttemptAt = new Date(
          sameSlotJob.finishedAt || sameSlotJob.updatedAt || sameSlotJob.createdAt,
        );
        if (
          !Number.isNaN(lastAttemptAt.getTime()) &&
          Date.now() - lastAttemptAt.getTime() < cooldownMinutes * 60 * 1000
        ) {
          continue;
        }
      }

      await createAutomationJob({
        sourceType: 'rule',
        publishMode: normalizePublishMode(rule.publishMode),
        ruleId: rule.id,
        scheduledFor: now,
        payload: {
          topic: rule.topic,
          objective: rule.objective,
          tone: rule.tone,
          targetAudience: rule.targetAudience,
          keywords: rule.keywords,
          wordCount: rule.wordCount,
          modelProvider: rule.modelProvider,
          modelName: rule.modelName,
          baseUrl: rule.baseUrl,
        },
        meta: {
          ruleName: rule.name,
          timezone: rule.timezone || 'Asia/Ho_Chi_Minh',
          ruleRunDate: date,
          scheduledSlot: slot,
        },
        checkDuplicate: false,
      });
      created += 1;
    }
  }

  return created;
};

const schedulerTick = async () => {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  try {
    await processDueJobs(3);
    await enqueueJobsFromRules();
    await processDueJobs(3);
  } catch (error) {
    console.error('[BlogAutomation] scheduler tick error:', error?.message || error);
  } finally {
    isSchedulerRunning = false;
  }
};

const startBlogAutomationScheduler = () => {
  const enabled = String(process.env.BLOG_AUTOMATION_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    console.log('[BlogAutomation] Scheduler disabled by env BLOG_AUTOMATION_ENABLED=false');
    return;
  }
  if (schedulerTimer) return;

  const intervalMs = clampInt(process.env.BLOG_AUTOMATION_INTERVAL_MS, 10000, 300000, 30000);
  schedulerTimer = setInterval(() => {
    schedulerTick();
  }, intervalMs);
  schedulerTimer.unref?.();

  setTimeout(() => {
    schedulerTick();
  }, 5000).unref?.();

  console.log(`[BlogAutomation] Scheduler started, interval=${intervalMs}ms`);
};

const stopBlogAutomationScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};

module.exports = {
  normalizeAutomationInput,
  normalizePublishMode,
  ensureBlogAutomationSchema,
  createAutomationJob,
  runAutomationJob,
  publishDraftFromJob,
  processDueJobs,
  enqueueJobsFromRules,
  schedulerTick,
  startBlogAutomationScheduler,
  stopBlogAutomationScheduler,
};
