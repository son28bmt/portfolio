const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const { Project, Blog, Message, Donation, Order, WalletTopup } = require('../models');

const router = express.Router();

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

router.use(protect);
router.use(requireAdmin);

router.get('/summary', async (req, res) => {
  try {
    let hasPaymentMethodColumn = false;

    try {
      const orderTable = await sequelize.getQueryInterface().describeTable('orders');
      hasPaymentMethodColumn = Boolean(orderTable?.payment_method);
    } catch (error) {
      hasPaymentMethodColumn = false;
    }

    const orderWhere = { status: 'paid' };
    if (hasPaymentMethodColumn) {
      orderWhere[Op.or] = [{ paymentMethod: 'qr' }, { paymentMethod: null }];
    }

    const [
      projects,
      blogs,
      messages,
      recentMessages,
      donateReceived,
      walletReceived,
      orderReceived,
      paidDonateCount,
      paidTopupCount,
      paidOrderCount,
    ] = await Promise.all([
      Project.count(),
      Blog.count(),
      Message.count(),
      Message.findAll({
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'name', 'email', 'message', 'status', 'createdAt'],
      }),
      Donation.sum('amount', { where: { status: 'paid' } }),
      WalletTopup.sum('amount', { where: { status: 'paid' } }),
      Order.sum('amount', { where: orderWhere }),
      Donation.count({ where: { status: 'paid' } }),
      WalletTopup.count({ where: { status: 'paid' } }),
      Order.count({ where: orderWhere }),
    ]);

    const finance = {
      donateReceived: toNumber(donateReceived),
      walletReceived: toNumber(walletReceived),
      orderReceived: toNumber(orderReceived),
      paidDonateCount: toNumber(paidDonateCount),
      paidTopupCount: toNumber(paidTopupCount),
      paidOrderCount: toNumber(paidOrderCount),
    };

    return res.json({
      stats: {
        projects: toNumber(projects),
        blogs: toNumber(blogs),
        messages: toNumber(messages),
      },
      finance: {
        ...finance,
        totalReceived:
          finance.donateReceived + finance.walletReceived + finance.orderReceived,
      },
      recentMessages,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'Không thể tải dữ liệu dashboard.',
    });
  }
});

module.exports = router;
