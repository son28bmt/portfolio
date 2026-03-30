const express = require('express');
const controller = require('../controllers/marketplace.controller');
const { protectMarketplaceAdmin } = require('../middleware/marketplace-admin.middleware');

const router = express.Router();

// Public routes
router.get('/products', controller.publicGetProducts);
router.post('/orders', controller.publicCreateOrder);
router.get('/orders/:payment_ref/status', controller.publicGetOrderStatus);
router.get('/sse/orders/:payment_ref', controller.publicGetOrderSSE);

// Webhook
router.post('/webhook/sepay', controller.webhookSePay);

// Admin login
router.post('/admin/login', controller.adminLogin);

// Admin protected CRUD
router.use('/admin', protectMarketplaceAdmin);

router.get('/admin/products', controller.adminGetProducts);
router.post('/admin/products', controller.adminCreateProduct);
router.put('/admin/products/:id', controller.adminUpdateProduct);
router.delete('/admin/products/:id', controller.adminDeleteProduct);

router.get('/admin/stock_items', controller.adminGetStockItems);
router.post('/admin/stock_items', controller.adminCreateStockItem);
router.put('/admin/stock_items/:id', controller.adminUpdateStockItem);
router.delete('/admin/stock_items/:id', controller.adminDeleteStockItem);

router.get('/admin/categories', controller.adminGetCategories);
router.post('/admin/categories', controller.adminCreateCategory);
router.put('/admin/categories/:id', controller.adminUpdateCategory);
router.delete('/admin/categories/:id', controller.adminDeleteCategory);

router.get('/admin/orders', controller.adminGetOrders);
router.get('/admin/orders/:id', controller.adminGetOrderById);
router.post('/admin/orders', controller.adminCreateOrder);
router.put('/admin/orders/:id', controller.adminUpdateOrder);
router.delete('/admin/orders/:id', controller.adminDeleteOrder);

module.exports = router;
