const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const path = require('path');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth.middleware');
const { uploadBufferToR2, getPresignedUploadUrl } = require('../services/r2.service');

const ALLOWED_PROJECT_FILE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'application/vnd.android.package-archive',
  'application/octet-stream', 
  'application/zip',
  'application/x-zip-compressed',
  'application/apk',
  'application/x-itunes-ipa',
  'application/x-ios-app',
]);
const MAX_PROJECT_FILE_SIZE_MB = 200; 

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROJECT_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PROJECT_FILE_TYPES.has(file.mimetype)) {
      return cb(new Error('Định dạng tệp không hợp lệ.'));
    }
    return cb(null, true);
  },
});

const decodePossibleJson = (value) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
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

const toStringArray = (value, { allowCommaSplit = true } = {}) => {
  const decoded = decodePossibleJson(value);
  if (Array.isArray(decoded)) {
    return decoded.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof decoded === 'string') {
    const text = decoded.trim();
    if (!text) return [];
    if (allowCommaSplit && text.includes(',')) {
      return text.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [text];
  }
  return [];
};

const normalizeProjectPayload = (body = {}) => {
  const tech = toStringArray(body.tech, { allowCommaSplit: true });
  const images = toStringArray(body.images, { allowCommaSplit: false });
  const image = typeof body.image === 'string' ? body.image.trim() : '';
  const coverImage = image || images[0] || '';
  const mergedImages = [...new Set([coverImage, ...images].filter(Boolean))];

  return {
    ...body,
    tech,
    image: coverImage,
    images: mergedImages,
    apkUrl: typeof body.apkUrl === 'string' ? body.apkUrl.trim() : null,
    iosUrl: typeof body.iosUrl === 'string' ? body.iosUrl.trim() : null,
  };
};

const normalizeProjectRecord = (project) => {
  const plain = project?.toJSON ? project.toJSON() : project;
  if (!plain) return plain;
  const tech = toStringArray(plain.tech, { allowCommaSplit: true });
  const images = toStringArray(plain.images, { allowCommaSplit: false });
  const image = typeof plain.image === 'string' ? plain.image.trim() : '';
  const coverImage = image || images[0] || '';
  const mergedImages = [...new Set([coverImage, ...images].filter(Boolean))];

  return {
    ...plain,
    tech,
    image: coverImage,
    images: mergedImages,
  };
};

const sanitizeExtension = (ext, fallback = '') => {
  const value = String(ext || '').toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(value)) return value;
  return fallback;
};

const inferFileExtension = (fileUrl, fallbackExt) => {
  const fallback = sanitizeExtension(fallbackExt, '.bin');
  const raw = String(fileUrl || '').trim();
  if (!raw) return fallback;

  try {
    const parsedUrl = new URL(raw, 'http://localhost');
    const ext = sanitizeExtension(path.extname(parsedUrl.pathname));
    return ext || fallback;
  } catch {
    const ext = sanitizeExtension(path.extname(raw.split('?')[0] || ''));
    return ext || fallback;
  }
};

const sanitizeBaseName = (value, fallback = 'download') => {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');

  const safe = (base || fallback).slice(0, 96);
  return safe || fallback;
};

const getDownloadNameFromUrl = (fileUrl) => {
  const raw = String(fileUrl || '').trim();
  if (!raw) return '';
  try {
    const parsedUrl = new URL(raw, 'http://localhost');
    return String(parsedUrl.searchParams.get('downloadName') || '').trim();
  } catch {
    return '';
  }
};

const resolveDownloadUrl = (req, fileUrl) => {
  const raw = String(fileUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `${req.protocol}:${raw}`;
  const origin = `${req.protocol}://${req.get('host')}`;
  return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const buildDownloadFileName = ({ project, type, fileUrl }) => {
  const defaultExt = type === 'apk' ? '.apk' : '.ipa';
  const fromUrl = getDownloadNameFromUrl(fileUrl);

  if (fromUrl) {
    const parsed = path.parse(fromUrl);
    const ext = sanitizeExtension(parsed.ext) || inferFileExtension(fileUrl, defaultExt);
    const base = sanitizeBaseName(parsed.name, type === 'apk' ? 'android-app' : 'ios-app');
    return `${base}${ext}`;
  }

  const ext = inferFileExtension(fileUrl, defaultExt);
  const base = sanitizeBaseName(project?.title, type === 'apk' ? 'android-app' : 'ios-app');
  return `${base}${ext}`;
};

const uploadFilesMiddleware = (req, res, next) => {
  upload.array('files', 12)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: `Tệp vượt quá ${MAX_PROJECT_FILE_SIZE_MB}MB.` });
      }
      return res.status(400).json({ message: err.message });
    }
    return res.status(400).json({ message: err.message || 'Tải tệp thất bại.' });
  });
};

const readSingleQueryValue = (value) => {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string');
    return typeof first === 'string' ? first.trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
};

router.post('/upload-images', protect, uploadFilesMiddleware, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'Bạn chưa chọn tệp để tải lên.' });
    const folder = req.body.folder || 'projects';
    const isAppUpload = /^projects\/apps\//i.test(String(folder));
    const urls = await Promise.all(
      req.files.map(async (file) => {
        const uploadedUrl = await uploadBufferToR2({
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          folder,
        });

        if (!isAppUpload) return uploadedUrl;

        try {
          const urlObj = new URL(uploadedUrl);
          urlObj.searchParams.set('downloadName', String(file.originalname || '').trim());
          return urlObj.toString();
        } catch {
          return uploadedUrl;
        }
      })
    );
    return res.status(201).json({ urls });
  } catch (error) {
    return res.status(501).json({ message: error.message || 'Tải tệp lên Cloudflare R2 thất bại.' });
  }
});

router.get('/get-upload-url', protect, async (req, res) => {
  try {
    const fileName = readSingleQueryValue(req.query.fileName);
    const mimeType = readSingleQueryValue(req.query.mimeType).toLowerCase();
    const folder = readSingleQueryValue(req.query.folder) || 'projects';
    if (!fileName || !mimeType) return res.status(400).json({ message: 'Thiếu thông tin fileName hoặc mimeType.' });
    if (!ALLOWED_PROJECT_FILE_TYPES.has(mimeType)) return res.status(400).json({ message: 'Dinh dang tep khong hop le.' });
    const { uploadUrl, publicUrl, fileKey } = await getPresignedUploadUrl({ fileName, mimeType, folder });
    return res.json({ uploadUrl, publicUrl, fileKey });
  } catch (error) {
    console.error('❌ Presigned URL Error:', error);
    return res.status(500).json({ message: 'Lỗi tạo đường dẫn tải lên.' });
  }
});

const downloadLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: { message: 'Vui lòng đợi 30 giây trước khi tải lại tệp này.' },
  skip: (req) => /bot|crawl|spider/i.test(req.headers['user-agent'] || ''),
});

router.get('/:id/download/:type', downloadLimiter, async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!['apk', 'ios'].includes(type)) return res.status(400).json({ message: 'Loại tệp không hợp lệ. Chọn apk hoặc ios.' });
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ message: 'Dự án không tồn tại.' });
    const fileUrl = type === 'apk' ? project.apkUrl : project.iosUrl;
    if (!fileUrl) return res.status(404).json({ message: 'Tệp tải xuống chưa khả dụng cho dự án này.' });
    if (!/bot|crawl|spider/i.test(req.headers['user-agent'] || '')) {
      await Project.increment(type === 'apk' ? 'apkDownloadCount' : 'iosDownloadCount', { by: 1, where: { id } });
    }
    const targetUrl = resolveDownloadUrl(req, fileUrl);
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({ message: 'Link tải xuống không hợp lệ.' });
    }

    const downloadFileName = buildDownloadFileName({ project, type, fileUrl });
    const encodedFileName = encodeURIComponent(downloadFileName)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A');

    const upstream = await axios.get(targetUrl, {
      responseType: 'stream',
      timeout: 5 * 60 * 1000,
      maxRedirects: 5,
    });

    const contentType = String(upstream.headers['content-type'] || '').trim() || 'application/octet-stream';
    const contentLength = String(upstream.headers['content-length'] || '').trim();

    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadFileName}"; filename*=UTF-8''${encodedFileName}`
    );
    res.setHeader('Cache-Control', 'no-store');

    upstream.data.on('error', (streamError) => {
      console.error('❌ Download stream error:', streamError?.message || streamError);
      if (!res.headersSent) {
        return res.status(502).json({ message: 'Lỗi truy xuất file tải xuống.' });
      }
      res.destroy(streamError);
    });

    req.on('close', () => {
      if (!req.complete) {
        upstream.data.destroy();
      }
    });

    return upstream.data.pipe(res);
  } catch (error) {
    console.error('❌ Download Track Error:', error);
    res.status(500).json({ message: 'Lỗi xử lý lượt tải.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;
    const { count, rows } = await Project.findAndCountAll({ order: [['createdAt', 'DESC']], limit, offset });
    res.json({
      items: await Promise.all(rows.map(async (project) => {
        if (!project.slug && project.title) {
          try {
            project.slug = project.title.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
            await project.save();
          } catch (e) {
            console.error('Lazy slug failed:', e.message);
          }
        }
        return normalizeProjectRecord(project);
      })),
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('❌ CRITICAL ERROR FETCHING PROJECTS:', error);
    res.status(500).json({ message: error.message || 'Lỗi hệ thống khi tải danh sách dự án.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const project = isUUID ? await Project.findByPk(id) : await Project.findOne({ where: { slug: id } });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const project = await Project.create(normalizeProjectPayload(req.body));
    res.status(201).json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    await project.update(normalizeProjectPayload(req.body));
    res.json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    await project.destroy();
    res.json({ message: 'Project removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
