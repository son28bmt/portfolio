const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');

// Public
router.get('/products', shopController.getProducts);
router.post('/checkout', shopController.checkout);

// Webhook
router.post('/webhook/sepay', shopController.handleSePayWebhook);

// Admin (protected)
router.post('/products', protect, requireAdmin, shopController.createProduct);
router.put('/products/:id', protect, requireAdmin, shopController.updateProduct);

module.exports = router;
