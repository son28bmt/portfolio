const { Product, Order, Category, StockItem } = require('../models');
const { createOrder, processPayment } = require('../services/marketplace.service');
const { sendProductEmail } = require('../services/email.service');
const { verifySepayWebhook, normalizeSepayPayload } = require('../services/donate.service');

// Public: List all products
const getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { quantity: { [require('sequelize').Op.gt]: 0 } },
      include: [{ model: Category, as: 'category' }]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Public: Create Order
const checkout = async (req, res) => {
  const { email, productId } = req.body;
  try {
    const { order, qrUrl } = await createOrder(email, productId);
    res.status(201).json({ order, qrUrl });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Webhook: SePay
const handleSePayWebhook = async (req, res) => {
  // 1. Verify Webhook
  const verification = verifySepayWebhook(req);
  if (!verification.ok) {
    return res.status(401).json({ message: 'Invalid webhook signature' });
  }

  // 2. Normalize Payload
  const payload = normalizeSepayPayload(req.body);
  if (!payload.isSuccess) {
    return res.status(200).json({ message: 'Ignoring non-success event' });
  }

  try {
    // 3. Process Payment
    const result = await processPayment(payload.transferContent, payload.amount);
    
    if (result) {
      const { order, stockItem } = result;
      // 4. Send Email
      await sendProductEmail(order.email, order.product.name, stockItem.data);
      console.log(`[Shop] Order ${order.id} paid and delivered to ${order.email}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`[Shop Webhook Error] ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// Admin: CRUD Product
const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await product.update(req.body);
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  checkout,
  handleSePayWebhook,
  createProduct,
  updateProduct
};
