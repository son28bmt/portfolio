const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ override: true });
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const accountRoutes = require('./routes/account.routes');
const walletRoutes = require('./routes/wallet.routes');
const adminWalletRoutes = require('./routes/admin-wallet.routes');
const adminDashboardRoutes = require('./routes/admin-dashboard.routes');
const projectRoutes = require('./routes/project.routes');
const blogRoutes = require('./routes/blog.routes');
const blogAutomationRoutes = require('./routes/blog-automation.routes');
const contactRoutes = require('./routes/contact.routes');
const aiRoutes = require('./routes/ai.routes');
const seoRoutes = require('./routes/seo.routes');
const tempmailRoutes = require('./routes/tempmail.routes');
const donateRoutes = require('./routes/donate.routes');
const shopRoutes = require('./routes/shop.routes');
const marketplaceRoutes = require('./routes/marketplace.routes');
const chatRoutes = require('./routes/chat.routes');
const http = require('http');
const { initSocket } = require('./services/socket.service');
const { startBlogAutomationScheduler } = require('./services/blog-automation.service');
const { startMarketplaceSupplierScheduler } = require('./services/marketplace-supplier-sync.service');

const app = express();
app.set('trust proxy', 1);

// 1. Security Headers (MUST be first)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://challenges.cloudflare.com", "'unsafe-inline'"],
      "frame-src": ["'self'", "https://challenges.cloudflare.com"],
      "connect-src": ["'self'", "https://challenges.cloudflare.com", "wss://api.nguyenquangson.id.vn", "https://api.nguyenquangson.id.vn"],
      "img-src": ["'self'", "data:", "https:"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const PORT = process.env.PORT || 5000;

// 2. CORS & Other Middlewares
const allowedOrigins = (process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : [
      'https://nguyenquangson.id.vn',
      'https://admin.nguyenquangson.id.vn',
      'http://localhost:5173',
      'http://localhost:5174'
    ]
).map((v) => v.trim()).filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-turnstile-token'],
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 3. Database Connection
connectDB();

// Global Rate Limiter: 200 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: { message: 'Hệ thống bảo vệ từ chối: IP của bạn đã gửi quá nhiều yêu cầu. Vui lòng quay lại sau 15 phút.' },
  skip: (req) => req.method === 'OPTIONS',
});

app.use(globalLimiter);

const captureRawBody = (req, res, buf) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString('utf8');
  }
};

app.use(express.json({ limit: '200mb', verify: captureRawBody }));
app.use(express.urlencoded({ limit: '200mb', extended: true, verify: captureRawBody }));
app.use(morgan('dev'));
 
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && req.url.includes('/api/chat')) {
    console.log(`[DEBUG] Incoming ${req.method} ${req.url}`);
  }
  next();
});

const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/', seoRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin/wallet', adminWalletRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/blog-auto', blogAutomationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tempmail', tempmailRoutes);
app.use('/api/donate', donateRoutes);
app.use('/api/shop', shopRoutes);

// Marketplace (Handle both /api and root, but cleanup)
app.use('/api', marketplaceRoutes);
app.use('/', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  marketplaceRoutes(req, res, next);
});

app.get('/api/ping', (req, res) => {
  res.json({ message: 'CORS and API are working!', timestamp: new Date() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Portfolio AI API is running' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = err.message || 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
  
  res.status(status).json({ 
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Setup Server and WebSockets
const server = http.createServer(app);
initSocket(server, corsOptions);
startBlogAutomationScheduler();
startMarketplaceSupplierScheduler();

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
