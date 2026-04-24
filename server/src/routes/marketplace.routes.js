const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/marketplace.controller");
const { protectMarketplaceAdmin } = require("../middleware/marketplace-admin.middleware");
const { verifyTurnstile } = require("../middleware/turnstile.middleware");
const { ensureMarketplaceSchema } = require("../services/marketplace-schema.service");

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ensureMarketplaceSchema();
    return next();
  } catch (error) {
    return res.status(500).json({
      message: `Khong the khoi tao schema marketplace: ${error.message || error}`,
    });
  }
});

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: {
    message: "Bạn đã tạo quá nhiều đơn hàng (limit 10/h). Vui lòng thử lại sau!",
  },
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: {
    message:
      "Bạn đã thử đăng nhập admin quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  },
});

// Public routes
router.get("/products", controller.publicGetProducts);
router.post("/orders", orderLimiter, verifyTurnstile, controller.publicCreateOrder);
router.get("/orders/:payment_ref/status", controller.publicGetOrderStatus);
router.get("/orders/:payment_ref", controller.publicGetOrderSummary);
router.get("/sse/orders/:payment_ref", controller.publicGetOrderSSE);

// Webhook
router.post(["/webhook/sepay", "/order/webhook/sepay", "/orders/webhook/sepay"], controller.webhookSePay);

// Admin login
router.post("/admin/login", adminLoginLimiter, controller.adminLogin);

// Admin protected CRUD
router.use("/admin", protectMarketplaceAdmin);

router.get("/admin/products", controller.adminGetProducts);
router.post("/admin/products", controller.adminCreateProduct);
router.put("/admin/products/:id", controller.adminUpdateProduct);
router.delete("/admin/products/:id", controller.adminDeleteProduct);

router.get("/admin/stock_items", controller.adminGetStockItems);
router.post("/admin/stock_items", controller.adminCreateStockItem);
router.put("/admin/stock_items/:id", controller.adminUpdateStockItem);
router.delete("/admin/stock_items/:id", controller.adminDeleteStockItem);

router.get("/admin/categories", controller.adminGetCategories);
router.post("/admin/categories", controller.adminCreateCategory);
router.put("/admin/categories/:id", controller.adminUpdateCategory);
router.delete("/admin/categories/:id", controller.adminDeleteCategory);

router.get("/admin/orders", controller.adminGetOrders);
router.get("/admin/orders/:id", controller.adminGetOrderById);
router.post("/admin/orders", controller.adminCreateOrder);
router.post("/admin/orders/:id/refresh-fulfillment", controller.adminRefreshSupplierOrder);
router.put("/admin/orders/:id", controller.adminUpdateOrder);
router.delete("/admin/orders/:id", controller.adminDeleteOrder);

router.get("/admin/supplier/smm-panel/services", controller.adminGetSmmServices);
router.get("/admin/supplier/smm-panel/balance", controller.adminGetSmmBalance);
router.post("/admin/supplier/smm-panel/sync-services", controller.adminSyncSmmServices);
router.post("/admin/supplier/smm-panel/refresh-processing", controller.adminBatchRefreshSupplierOrders);

module.exports = router;
