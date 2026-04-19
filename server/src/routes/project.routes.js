const express = require("express");
const router = express.Router();
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const Project = require("../models/Project");
const { protect } = require("../middleware/auth.middleware");
const { uploadBufferToR2 } = require("../services/r2.service");

const ALLOWED_PROJECT_FILE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/vnd.android.package-archive",
  "application/octet-stream", // often used for .ipa
]);
const MAX_PROJECT_FILE_SIZE_MB = 100; // Increased for APK/IPA

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROJECT_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PROJECT_FILE_TYPES.has(file.mimetype)) {
      return cb(new Error("Định dạng tệp không hợp lệ."));
    }
    return cb(null, true);
  },
});

const decodePossibleJson = (value) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    if (typeof current !== "string") break;
    const text = current.trim();
    if (!text) return "";
    if (!["[", "{", '"'].includes(text[0])) break;
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
    return decoded.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof decoded === "string") {
    const text = decoded.trim();
    if (!text) return [];
    if (allowCommaSplit && text.includes(",")) {
      return text
        .split(",")
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
  const image = typeof body.image === "string" ? body.image.trim() : "";
  const coverImage = image || images[0] || "";
  const mergedImages = [...new Set([coverImage, ...images].filter(Boolean))];

  return {
    ...body,
    tech,
    image: coverImage,
    images: mergedImages,
    apkUrl: typeof body.apkUrl === "string" ? body.apkUrl.trim() : null,
    iosUrl: typeof body.iosUrl === "string" ? body.iosUrl.trim() : null,
  };
};

const normalizeProjectRecord = (project) => {
  const plain = project?.toJSON ? project.toJSON() : project;
  if (!plain) return plain;

  const tech = toStringArray(plain.tech, { allowCommaSplit: true });
  const images = toStringArray(plain.images, { allowCommaSplit: false });
  const image = typeof plain.image === "string" ? plain.image.trim() : "";
  const coverImage = image || images[0] || "";
  const mergedImages = [...new Set([coverImage, ...images].filter(Boolean))];

  return {
    ...plain,
    tech,
    image: coverImage,
    images: mergedImages,
  };
};

const uploadFilesMiddleware = (req, res, next) => {
  upload.array("files", 12)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: `Tệp vượt quá ${MAX_PROJECT_FILE_SIZE_MB}MB.` });
      }
      return res.status(400).json({ message: err.message });
    }
    return res
      .status(400)
      .json({ message: err.message || "Tải tệp thất bại." });
  });
};

// Admin: Upload project files to Cloudflare R2 (images, apk, ipa)
router.post(
  "/upload-images",
  protect,
  uploadFilesMiddleware,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ message: "Bạn chưa chọn tệp để tải lên." });
      }

      const folder = req.body.folder || "projects";
      const urls = await Promise.all(
        req.files.map((file) =>
          uploadBufferToR2({
            buffer: file.buffer,
            originalName: file.originalname,
            mimeType: file.mimetype,
            folder,
          }),
        ),
      );

      return res.status(201).json({ urls });
    } catch (error) {
      return res.status(500).json({
        message: error.message || "Tải tệp lên Cloudflare R2 thất bại.",
      });
    }
  },
);

// Rate limiter for downloads (prevent spam - 1 download per 30s per project/IP/UA)
const downloadLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 2, // max 2 requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const ua = req.headers["user-agent"] || "unknown";
    const projectId = req.params.id || "unknown";
    return `${ip}-${ua}-${projectId}`;
  },
  message: { message: "Vui lòng đợi 30 giây trước khi tải lại tệp này." },
  skip: (req) => {
    // Skip limiting for bots - we don't count them anyway, so just let them redirect
    const ua = req.headers["user-agent"] || "";
    return /bot|crawl|spider/i.test(ua);
  },
  validate: { xForwardedForHeader: false },
});

/**
 * Public: Track download count and redirect to file
 * GET /api/projects/:id/download/:type (type: apk | ios)
 */
router.get("/:id/download/:type", downloadLimiter, async (req, res) => {
  try {
    const { id, type } = req.params;
    const ua = req.headers["user-agent"] || "";

    if (!["apk", "ios"].includes(type)) {
      return res
        .status(400)
        .json({ message: "Loại tệp không hợp lệ. Chọn apk hoặc ios." });
    }

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ message: "Dự án không tồn tại." });
    }

    const fileUrl = type === "apk" ? project.apkUrl : project.iosUrl;
    if (!fileUrl) {
      return res
        .status(404)
        .json({ message: "Tệp tải xuống chưa khả dụng cho dự án này." });
    }

    // Bot detection - don't increment for bots
    const isBot = /bot|crawl|spider/i.test(ua);

    if (!isBot) {
      // Atomic increment at DB level
      await Project.increment(
        type === "apk" ? "apkDownloadCount" : "iosDownloadCount",
        { by: 1, where: { id } },
      );
    }

    // Redirect to the actual file URL (often on Cloudflare R2)
    // Add ?dl=1 for potentially tracking at CDN layer later
    const redirectUrl = fileUrl.includes("?")
      ? `${fileUrl}&dl=1`
      : `${fileUrl}?dl=1`;
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ Download Track Error:", error);
    // In case of error, still try to redirect to file if URL is known, or return error
    res.status(500).json({ message: "Lỗi xử lý lượt tải." });
  }
});

// Public: Get all projects (With Pagination)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;

    const { count, rows } = await Project.findAndCountAll({
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.json({
      items: rows.map(normalizeProjectRecord),
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public: Get single project
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Create project
router.post("/", protect, async (req, res) => {
  try {
    const payload = normalizeProjectPayload(req.body);
    const project = await Project.create(payload);
    res.status(201).json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Update project
router.put("/:id", protect, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const payload = normalizeProjectPayload(req.body);
    await project.update(payload);
    res.json(normalizeProjectRecord(project));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Delete project
router.delete("/:id", protect, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    await project.destroy();
    res.json({ message: "Project removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
