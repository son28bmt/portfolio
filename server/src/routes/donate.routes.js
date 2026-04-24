const express = require('express');
const { Op } = require('sequelize');
const Donation = require('../models/Donation');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const {
  DONATION_STATUS,
  sanitizeDonorName,
  getDonateConfig,
  generateOrderCode,
  buildTransferContent,
  buildVietQrUrl,
  verifySepayWebhook,
  normalizeSepayPayload,
  extractOrderCode,
  getExpiresAt,
  isExpired,
  toAmount,
} = require('../services/donate.service');
const { addClient, sendEvent } = require('../services/sse.service');
const { notifyAdmin } = require('../services/socket.service');

const router = express.Router();

const validStatuses = new Set(Object.values(DONATION_STATUS));

const expirePendingDonations = async () => {
  await Donation.update(
    { status: DONATION_STATUS.EXPIRED },
    {
      where: {
        status: DONATION_STATUS.PENDING,
        expiresAt: { [Op.lte]: new Date() },
      },
    },
  );
};

const toPublicDonation = (donation) => ({
  donorName: donation.donorName,
  amount: donation.amount,
  paidAt: donation.paidAt,
});

router.post('/intents', async (req, res) => {
  try {
    const config = getDonateConfig();
    const donorName = sanitizeDonorName(req.body?.donorName);
    const amount = toAmount(req.body?.amount);

    if (!config.bankBin || !config.accountNo || !config.accountName) {
      return res
        .status(500)
        .json({ message: 'Thiếu cấu hình tài khoản nhận donate trên server.' });
    }

    if (donorName.length < 2) {
      return res
        .status(400)
        .json({ message: 'Tên người ủng hộ phải có ít nhất 2 ký tự.' });
    }

    if (!amount || amount < config.minAmount || amount > config.maxAmount) {
      return res.status(400).json({
        message: `Số tiền không hợp lệ. Vui lòng nhập từ ${config.minAmount} đến ${config.maxAmount} VND.`,
      });
    }

    let orderCode = '';
    for (let i = 0; i < 5; i += 1) {
      const candidate = generateOrderCode();
      const existing = await Donation.findOne({ where: { orderCode: candidate } });
      if (!existing) {
        orderCode = candidate;
        break;
      }
    }

    if (!orderCode) {
      return res.status(500).json({ message: 'Không thể tạo mã donate. Vui lòng thử lại.' });
    }

    const transferContent = buildTransferContent(orderCode);
    const expiresAt = getExpiresAt(config.expireMinutes);

    await Donation.create({
      orderCode,
      donorName,
      amount,
      status: DONATION_STATUS.PENDING,
      transferContent,
      provider: 'sepay',
      expiresAt,
      isPublic: true,
    });

    notifyAdmin('admin_donate_refresh');

    const qrImageUrl = buildVietQrUrl({
      bankBin: config.bankBin,
      accountNo: config.accountNo,
      accountName: config.accountName,
      amount,
      transferContent,
    });

    return res.status(201).json({
      orderCode,
      amount,
      status: DONATION_STATUS.PENDING,
      transferContent,
      qrImageUrl,
      expiresAt,
      bankBin: config.bankBin,
      accountNo: config.accountNo,
      accountName: config.accountName,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tạo phiên donate.' });
  }
});

router.get('/intents/:orderCode/status', async (req, res) => {
  try {
    const orderCode = String(req.params.orderCode || '').trim().toUpperCase();
    const donation = await Donation.findOne({ where: { orderCode } });

    if (!donation) {
      return res.status(404).json({ message: 'Không tìm thấy phiên donate.' });
    }

    if (donation.status === DONATION_STATUS.PENDING && isExpired(donation.expiresAt)) {
      await donation.update({ status: DONATION_STATUS.EXPIRED });
    }

    return res.json({
      orderCode: donation.orderCode,
      amount: donation.amount,
      status: donation.status,
      paidAt: donation.paidAt,
      expiresAt: donation.expiresAt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể lấy trạng thái donate.' });
  }
});

router.get('/sse/donates/:orderCode', (req, res) => {
  const orderCode = String(req.params.orderCode || '').trim().toUpperCase();
  if (!orderCode) return res.status(400).json({ message: 'Thiếu mã đơn.' });
  addClient(req, res, 'donate', orderCode);
});

router.get('/public-summary', async (req, res) => {
  try {
    await expirePendingDonations();

    const [totalAmount, totalCount, latestDonations] = await Promise.all([
      Donation.sum('amount', { where: { status: DONATION_STATUS.PAID } }),
      Donation.count({ where: { status: DONATION_STATUS.PAID } }),
      Donation.findAll({
        where: {
          status: DONATION_STATUS.PAID,
          isPublic: true,
        },
        order: [['paidAt', 'DESC']],
        limit: 20,
      }),
    ]);

    return res.json({
      totalAmount: Number(totalAmount || 0),
      totalCount: Number(totalCount || 0),
      latestDonations: latestDonations.map(toPublicDonation),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể lấy dữ liệu donate công khai.' });
  }
});

router.post('/webhook/sepay', async (req, res) => {
  try {
    const verification = verifySepayWebhook(req);
    if (!verification.ok) {
      return res.status(401).json({ message: 'Webhook signature/token không hợp lệ.' });
    }

    const payload = normalizeSepayPayload(req.body);
    if (!payload.isSuccess) {
      return res.status(202).json({
        success: true,
        webhookType: 'donate',
        handledBy: 'donate',
        message: 'Bỏ qua webhook không phải giao dịch thành công.',
      });
    }

    const transferContentStr = String(payload.transferContent || '').toUpperCase();

    if (transferContentStr.match(/ORD[A-Z0-9]{8,40}/)) {
      return res.status(409).json({
        success: false,
        webhookType: 'donate',
        handledBy: 'donate',
        message: 'Webhook donate không xử lý đơn hàng. Vui lòng trỏ webhook order sang /api/order/webhook/sepay.',
      });
    }

    if (transferContentStr.match(/WAL[A-Z0-9]{8,40}/)) {
      return res.status(409).json({
        success: false,
        webhookType: 'donate',
        handledBy: 'donate',
        message: 'Webhook donate không xử lý nạp quỹ. Vui lòng trỏ webhook wallet sang /api/wallet/webhook/sepay.',
      });
    }

    const orderCode = extractOrderCode(payload.transferContent);
    if (!orderCode) {
      return res.status(400).json({
        success: false,
        webhookType: 'donate',
        handledBy: 'donate',
        message: 'Không tìm thấy mã đơn donate trong nội dung chuyển khoản.',
      });
    }

    const donation = await Donation.findOne({ where: { orderCode } });
    if (!donation) {
      return res.status(404).json({
        success: false,
        webhookType: 'donate',
        handledBy: 'donate',
        message: 'Không tìm thấy đơn donate tương ứng.',
      });
    }

    if (!payload.amount || payload.amount !== donation.amount) {
      return res.status(400).json({
        success: false,
        webhookType: 'donate',
        handledBy: 'donate',
        message: 'Số tiền giao dịch không khớp với đơn donate.',
      });
    }

    if (payload.providerTxnId) {
      const existingTxn = await Donation.findOne({ where: { providerTxnId: payload.providerTxnId } });
      if (existingTxn && existingTxn.id !== donation.id) {
        return res.status(200).json({
          success: true,
          webhookType: 'donate',
          handledBy: 'donate',
          message: 'Giao dịch đã được xử lý trước đó.',
        });
      }
    }

    if (donation.status === DONATION_STATUS.PAID) {
      return res.status(200).json({
        success: true,
        webhookType: 'donate',
        handledBy: 'donate',
        message: 'Đơn donate đã thanh toán trước đó.',
      });
    }

    await donation.update({
      status: DONATION_STATUS.PAID,
      providerTxnId: payload.providerTxnId || donation.providerTxnId,
      paidAt: new Date(),
      rawWebhook: JSON.stringify(payload.rawPayload),
    });

    sendEvent('donate', donation.orderCode, { status: DONATION_STATUS.PAID });
    notifyAdmin('admin_donate_refresh');

    return res.status(200).json({
      success: true,
      webhookType: 'donate',
      handledBy: 'donate',
      message: 'OK',
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      webhookType: 'donate',
      handledBy: 'donate',
      message: error.message || 'Lỗi xử lý webhook donate.',
    });
  }
});

router.get('/admin/donations', protect, requireAdmin, async (req, res) => {
  try {
    await expirePendingDonations();

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const status = String(req.query.status || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim();

    const where = {};
    if (status && validStatuses.has(status)) {
      where.status = status;
    }
    if (q) {
      where[Op.or] = [
        { donorName: { [Op.like]: `%${q}%` } },
        { orderCode: { [Op.like]: `%${q.toUpperCase()}%` } },
      ];
    }

    const { rows, count } = await Donation.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      items: rows,
      total: count,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tải danh sách donate.' });
  }
});

router.patch('/admin/donations/:id/visibility', protect, requireAdmin, async (req, res) => {
  try {
    const donation = await Donation.findByPk(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: 'Không tìm thấy giao dịch donate.' });
    }

    if (typeof req.body?.isPublic !== 'boolean') {
      return res.status(400).json({ message: 'Giá trị isPublic phải là boolean.' });
    }

    await donation.update({ isPublic: req.body.isPublic });
    return res.json({ id: donation.id, isPublic: donation.isPublic });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể cập nhật trạng thái hiển thị.' });
  }
});

module.exports = router;
