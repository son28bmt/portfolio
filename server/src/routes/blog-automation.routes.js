const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const { BlogAutomationRule, BlogAutomationJob, Blog } = require('../models');
const {
  normalizeAutomationInput,
  normalizePublishMode,
  ensureBlogAutomationSchema,
  createAutomationJob,
  runAutomationJob,
  publishDraftFromJob,
  schedulerTick,
} = require('../services/blog-automation.service');

const clampLimit = (value, fallback = 20) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.round(n)));
};

const normalizePostingTime = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '08:00';
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw) ? raw : null;
};

const normalizePostingTimes = (value, fallback = '08:00') => {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,\n;|]/)
        .map((item) => item.trim())
        .filter(Boolean);

  const valid = rawItems
    .map((item) => normalizePostingTime(item))
    .filter(Boolean);

  const unique = [...new Set(valid)];
  if (unique.length > 0) return unique;
  if (rawItems.length > 0) return [];

  const fb = normalizePostingTime(fallback);
  return fb ? [fb] : ['08:00'];
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const extractUpstreamStatus = (message) => {
  const match = String(message || '').match(/\[Upstream\s+(\d{3})\]/i);
  if (!match) return null;
  const code = Number(match[1]);
  if (!Number.isFinite(code) || code < 400 || code > 599) return null;
  return code;
};

const resolveErrorHttpStatus = (message, fallback = 400) =>
  extractUpstreamStatus(message) || fallback;

router.use(protect);
router.use(requireAdmin);
router.use(async (req, res, next) => {
  try {
    await ensureBlogAutomationSchema();
    return next();
  } catch (error) {
    return res.status(500).json({
      message: `Khong the khoi tao schema blog automation: ${error.message || error}`,
    });
  }
});

router.post('/generate', async (req, res) => {
  let createdJob = null;
  try {
    const normalized = normalizeAutomationInput(req.body || {});
    const publishMode = normalizePublishMode(req.body?.publishMode);
    const allowDuplicate =
      req.body?.allowDuplicate === true ||
      String(req.body?.allowDuplicate || '').toLowerCase() === 'true';
    const scheduledFor = toDateOrNull(req.body?.scheduledFor);
    if (req.body?.scheduledFor && !scheduledFor) {
      return res.status(400).json({ message: 'scheduledFor khong hop le.' });
    }

    const job = await createAutomationJob({
      sourceType: 'manual',
      publishMode,
      scheduledFor: scheduledFor || new Date(),
      payload: normalized,
      meta: { createdBy: req.user?.username || 'admin' },
      checkDuplicate: !allowDuplicate,
    });
    createdJob = job;

    const shouldRunNow = !scheduledFor || scheduledFor.getTime() <= Date.now();
    if (!shouldRunNow) {
      return res.status(202).json({
        message: 'Da tao lich dang bai tu dong.',
        job,
      });
    }

    const finishedJob = await runAutomationJob(job.id, { throwOnError: true });
    const blog = finishedJob?.blogId ? await Blog.findByPk(finishedJob.blogId) : null;
    return res.status(201).json({
      message:
        publishMode === 'draft'
          ? 'Da tao draft bang AI thanh cong.'
          : 'Da tao bai viet bang AI thanh cong.',
      job: finishedJob,
      blog,
    });
  } catch (error) {
    const rawMessage = String(error?.message || '').trim();
    const isValidationError =
      rawMessage.includes('bat buoc') ||
      rawMessage.includes('allowDuplicate') ||
      rawMessage.includes('khong hop le');

    console.error('[BlogAutomation] generate failed:', {
      status: error?.response?.status,
      message: rawMessage || error?.response?.data?.error?.message || null,
      providerError: error?.response?.data || null,
      requestMeta: {
        publishMode: req.body?.publishMode,
        modelProvider: req.body?.modelProvider,
        hasModelName: Boolean(String(req.body?.modelName || '').trim()),
        hasBaseUrl: Boolean(String(req.body?.baseUrl || '').trim()),
      },
    });

    if (createdJob?.id) {
      try {
        const failedJob = await BlogAutomationJob.findByPk(createdJob.id, {
          attributes: ['id', 'status', 'errorMessage'],
        });
        if (failedJob?.status === 'failed' && failedJob?.errorMessage) {
          return res.status(resolveErrorHttpStatus(failedJob.errorMessage, 400)).json({
            message: failedJob.errorMessage,
            jobId: failedJob.id,
          });
        }
      } catch (lookupError) {
        console.error('[BlogAutomation] failed job lookup error:', lookupError?.message || lookupError);
      }
    }

    if (rawMessage) {
      return res
        .status(resolveErrorHttpStatus(rawMessage, isValidationError ? 400 : 500))
        .json({ message: rawMessage });
    }

    return res.status(500).json({
      message: 'Khong the tao bai viet AI.',
    });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 20);
    const rows = await BlogAutomationJob.findAll({
      include: [
        {
          model: Blog,
          as: 'blog',
          attributes: ['id', 'slug', 'title', 'createdAt'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/jobs/:id/run', async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await BlogAutomationJob.findByPk(jobId);
    if (!job) return res.status(404).json({ message: 'Khong tim thay job.' });
    if (job.status === 'running') {
      return res.status(202).json({ message: 'Job dang duoc xu ly.', job });
    }

    await job.update({
      status: 'pending',
      scheduledFor: new Date(),
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
    });

    const done = await runAutomationJob(job.id, { throwOnError: true });
    const blog = done?.blogId ? await Blog.findByPk(done.blogId) : null;
    return res.json({ message: 'Da chay lai job.', job: done, blog });
  } catch (error) {
    const rawMessage = String(error?.message || '').trim();

    try {
      const latestJob = await BlogAutomationJob.findByPk(jobId, {
        attributes: ['id', 'status', 'errorMessage', 'topic', 'blogId', 'finishedAt', 'updatedAt'],
      });

      if (latestJob?.status === 'running') {
        return res.status(202).json({ message: 'Job dang duoc xu ly.', job: latestJob });
      }

      if (latestJob?.status === 'failed' && latestJob?.errorMessage) {
        return res.status(resolveErrorHttpStatus(latestJob.errorMessage, 400)).json({
          message: latestJob.errorMessage,
          job: latestJob,
        });
      }
    } catch (lookupError) {
      console.error('[BlogAutomation] run job lookup error:', lookupError?.message || lookupError);
    }

    if (rawMessage) {
      return res.status(resolveErrorHttpStatus(rawMessage, 400)).json({ message: rawMessage });
    }
    return res.status(500).json({ message: 'Khong the chay job.' });
  }
});

router.post('/jobs/:id/publish-draft', async (req, res) => {
  try {
    const blog = await publishDraftFromJob(req.params.id);
    return res.json({
      message: 'Da publish draft thanh bai viet.',
      blog,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong publish duoc draft.' });
  }
});

router.post('/tick', async (req, res) => {
  try {
    await schedulerTick();
    return res.json({ message: 'Scheduler tick da duoc kich hoat.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/rules', async (req, res) => {
  try {
    const rows = await BlogAutomationRule.findAll({
      order: [['createdAt', 'DESC']],
    });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/rules', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Ten rule la bat buoc.' });

    const normalized = normalizeAutomationInput(req.body || {});
    const postingTimes = normalizePostingTimes(
      req.body?.postingTimes !== undefined ? req.body.postingTimes : req.body?.postingTime,
      req.body?.postingTime || '08:00',
    );
    if (!postingTimes.length) return res.status(400).json({ message: 'postingTime phai dang HH:mm.' });

    const timezone = String(req.body?.timezone || 'Asia/Ho_Chi_Minh').trim() || 'Asia/Ho_Chi_Minh';
    const isActive = req.body?.isActive !== false;
    const publishMode = normalizePublishMode(req.body?.publishMode);

    const rule = await BlogAutomationRule.create({
      name,
      publishMode,
      modelProvider: normalized.modelProvider,
      modelName: normalized.modelName,
      baseUrl: normalized.baseUrl,
      topic: normalized.topic,
      objective: normalized.objective,
      tone: normalized.tone,
      targetAudience: normalized.targetAudience,
      keywords: normalized.keywords,
      wordCount: normalized.wordCount,
      postingTime: postingTimes[0],
      postingTimes,
      timezone,
      isActive,
    });

    return res.status(201).json(rule);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong tao duoc rule.' });
  }
});

router.put('/rules/:id', async (req, res) => {
  try {
    const rule = await BlogAutomationRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Khong tim thay rule.' });

    const updates = {};

    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ message: 'Ten rule khong duoc de trong.' });
      updates.name = name;
    }

    if (
      req.body?.topic !== undefined ||
      req.body?.objective !== undefined ||
      req.body?.tone !== undefined ||
      req.body?.targetAudience !== undefined ||
      req.body?.keywords !== undefined ||
      req.body?.wordCount !== undefined ||
      req.body?.modelProvider !== undefined ||
      req.body?.modelName !== undefined ||
      req.body?.baseUrl !== undefined
    ) {
      const normalized = normalizeAutomationInput({
        topic: req.body?.topic !== undefined ? req.body.topic : rule.topic,
        objective: req.body?.objective !== undefined ? req.body.objective : rule.objective,
        tone: req.body?.tone !== undefined ? req.body.tone : rule.tone,
        targetAudience:
          req.body?.targetAudience !== undefined ? req.body.targetAudience : rule.targetAudience,
        keywords: req.body?.keywords !== undefined ? req.body.keywords : rule.keywords,
        wordCount: req.body?.wordCount !== undefined ? req.body.wordCount : rule.wordCount,
        modelProvider:
          req.body?.modelProvider !== undefined ? req.body.modelProvider : rule.modelProvider,
        modelName: req.body?.modelName !== undefined ? req.body.modelName : rule.modelName,
        baseUrl: req.body?.baseUrl !== undefined ? req.body.baseUrl : rule.baseUrl,
      });
      Object.assign(updates, normalized);
    }

    if (req.body?.postingTime !== undefined || req.body?.postingTimes !== undefined) {
      const postingTimes = normalizePostingTimes(
        req.body?.postingTimes !== undefined ? req.body.postingTimes : req.body.postingTime,
        req.body?.postingTime || rule.postingTime || '08:00',
      );
      if (!postingTimes.length) return res.status(400).json({ message: 'postingTime phai dang HH:mm.' });
      updates.postingTimes = postingTimes;
      updates.postingTime = postingTimes[0];
    }

    if (req.body?.timezone !== undefined) {
      updates.timezone = String(req.body.timezone || '').trim() || 'Asia/Ho_Chi_Minh';
    }

    if (req.body?.isActive !== undefined) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (req.body?.publishMode !== undefined) {
      updates.publishMode = normalizePublishMode(req.body.publishMode);
    }

    await rule.update(updates);
    return res.json(rule);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong cap nhat duoc rule.' });
  }
});

router.delete('/rules/:id', async (req, res) => {
  try {
    const rule = await BlogAutomationRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Khong tim thay rule.' });

    await rule.destroy();
    return res.json({ message: 'Da xoa rule.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
