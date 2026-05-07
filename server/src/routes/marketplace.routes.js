const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/marketplace.controller");
const { protectMarketplaceAdmin } = require("../middleware/marketplace-admin.middleware");
const { verifyTurnstile } = require("../middleware/turnstile.middleware");
const { ensureMarketplaceSchema } = require("../services/marketplace-schema.service");

const router = express.Router();

router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[MARKETPLACE] ${req.method} ${req.path} (Original: ${req.originalUrl})`);
  }
  next();
});

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
router.get("/payment-accounts", controller.publicGetPaymentAccounts);
router.get("/section-status", controller.publicGetSectionStatus);
router.get("/products", controller.publicGetProducts);
router.post("/orders", orderLimiter, verifyTurnstile, controller.publicCreateOrder);
router.get("/orders/:payment_ref/status", controller.publicGetOrderStatus);
router.get("/orders/:payment_ref", controller.publicGetOrderSummary);
router.get("/sse/orders/:payment_ref", controller.publicGetOrderSSE);

// Webhook
router.post(["/webhook/sepay", "/order/webhook/sepay", "/orders/webhook/sepay"], controller.webhookSePay);

// Admin login
router.post("/admin/login", adminLoginLimiter, controller.adminLogin);

// Admin Routes (với middleware bảo vệ)
const adminRouter = express.Router();
adminRouter.use(protectMarketplaceAdmin);

// Ghi log để debug
adminRouter.use((req, res, next) => {
  console.log(`[MARKETPLACE ADMIN DEBUG] ${req.method} ${req.path}`);
  next();
});

adminRouter.get("/section-status", controller.adminGetSectionStatus);
adminRouter.put("/section-status", controller.adminUpdateSectionStatus);

adminRouter.get("/products/?", controller.adminGetProducts);
adminRouter.post("/products/?", controller.adminCreateProduct);
adminRouter.put("/products/:id/?", controller.adminUpdateProduct);
adminRouter.delete("/products/:id/?", controller.adminDeleteProduct);

adminRouter.get("/stock_items", controller.adminGetStockItems);
adminRouter.post("/stock_items", controller.adminCreateStockItem);
adminRouter.put("/stock_items/:id", controller.adminUpdateStockItem);
adminRouter.delete("/stock_items/:id", controller.adminDeleteStockItem);

adminRouter.get("/categories/?", controller.adminGetCategories);
adminRouter.post("/categories/?", controller.adminCreateCategory);
adminRouter.put("/categories/:id/?", controller.adminUpdateCategory);
adminRouter.delete("/categories/:id/?", controller.adminDeleteCategory);

adminRouter.get("/orders", controller.adminGetOrders);
adminRouter.get("/orders/:id", controller.adminGetOrderById);
adminRouter.post("/orders", controller.adminCreateOrder);
adminRouter.post("/orders/:id/refresh-fulfillment", controller.adminRefreshSupplierOrder);
adminRouter.put("/orders/:id", controller.adminUpdateOrder);
adminRouter.delete("/orders/:id", controller.adminDeleteOrder);

adminRouter.get("/supplier/smm-panel/services/?", controller.adminGetSmmServices);
adminRouter.get("/supplier/smm-panel/balance/?", controller.adminGetSmmBalance);
adminRouter.post("/supplier/smm-panel/sync-services/?", controller.adminSyncSmmServices);
adminRouter.post("/supplier/smm-panel/refresh-processing/?", controller.adminBatchRefreshSupplierOrders);

adminRouter.get("/supplier/card-partner/products/?", controller.adminGetCardProducts);
adminRouter.delete("/supplier/card-partner/products/?", controller.adminDeleteAllCardProducts);
adminRouter.get("/supplier/card-partner/balance/?", controller.adminGetCardBalance);
adminRouter.post("/supplier/card-partner/sync-products/?", controller.adminSyncCardProducts);
adminRouter.post("/supplier/card-partner/sync-topup/?", controller.adminSyncTopupProducts);
adminRouter.delete("/supplier/card-partner/topup/?", controller.adminDeleteAllTopupProducts);

// Gắn adminRouter vào prefix /admin
router.use("/admin", adminRouter);

module.exports = router;
