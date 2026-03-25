const express = require('express');
const router = express.Router();
const multer = require('multer');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth.middleware');
const { uploadImageBufferToR2 } = require('../services/r2.service');

const MAX_IMAGE_SIZE_MB = Number(process.env.PROJECT_IMAGE_MAX_MB || 10);
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error('Định dạng ảnh không hợp lệ. Chỉ hỗ trợ JPG, PNG, WEBP, GIF, AVIF.'));
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
    return decoded
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof decoded === 'string') {
    const text = decoded.trim();
    if (!text) return [];
    if (allowCommaSplit && text.includes(',')) {
      return text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
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

const uploadImagesMiddleware = (req, res, next) => {
  upload.array('files', 12)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: `Ảnh vượt quá ${MAX_IMAGE_SIZE_MB}MB.` });
      }
      return res.status(400).json({ message: err.message });
    }
    return res.status(400).json({ message: err.message || 'Tải ảnh thất bại.' });
  });
};

// Admin: Upload project images to Cloudflare R2 (no local storage)
router.post('/upload-images', protect, uploadImagesMiddleware, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Bạn chưa chọn ảnh để tải lên.' });
    }

    const folder = req.body.folder || 'projects';
    const urls = await Promise.all(
      req.files.map((file) =>
        uploadImageBufferToR2({
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          folder,
        })
      )
    );

    return res.status(201).json({ urls });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Tải ảnh lên Cloudflare R2 thất bại.',
    });
  }
});

// Public: Get all projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.findAll({ order: [['createdAt', 'DESC']] });
    res.json(projects.map(normalizeProjectRecord));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public: Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Create project
router.post('/', protect, async (req, res) => {
  try {
    const payload = normalizeProjectPayload(req.body);
    const project = await Project.create(payload);
    res.status(201).json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Update project
router.put('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const payload = normalizeProjectPayload(req.body);
    await project.update(payload);
    res.json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Delete project
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
