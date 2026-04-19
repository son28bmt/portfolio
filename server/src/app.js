const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const { connectDB, sequelize } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const blogRoutes = require('./routes/blog.routes');
const contactRoutes = require('./routes/contact.routes');
const aiRoutes = require('./routes/ai.routes');
const seoRoutes = require('./routes/seo.routes');
const donateRoutes = require('./routes/donate.routes');
const shopRoutes = require('./routes/shop.routes');
const marketplaceRoutes = require('./routes/marketplace.routes');
const chatRoutes = require('./routes/chat.routes');
const http = require('http');
const { initSocket } = require('./services/socket.service');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || [
  'https://nguyenquangson.id.vn',
  'https://admin.nguyenquangson.id.vn',
  'http://localhost:5173',
  'http://localhost:5174'
].join(','))
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

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

// Connect to Database
connectDB();

// Global Rate Limiter: 200 requests per 15 minutes
// Protects the server against DDoS and excessive auto-polling
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Hệ thống bảo vệ từ chối: IP của bạn đã gửi quá nhiều yêu cầu. Vui lòng quay lại sau 15 phút.' },
  skip: (req) => req.method === 'OPTIONS',
});

app.use(globalLimiter);

// Sync Database (Forcefully for initialization if needed, but usually sequelize.sync() is enough)
// sequelize.sync();

// CORS moved to top
const captureRawBody = (req, res, buf) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString('utf8');
  }
};

app.use(express.json({ limit: '200mb', verify: captureRawBody }));
app.use(express.urlencoded({ limit: '200mb', extended: true, verify: captureRawBody }));
app.use(morgan('dev'));
 
// DEBUG: Log all requests to see which middleware might be blocking
app.use((req, res, next) => {
  if (req.url.includes('/api/chat')) {
    console.log(`[DEBUG] Incoming ${req.method} ${req.url}`);
    console.log(`[DEBUG] Headers:`, JSON.stringify(req.headers));
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

// --- PRIORITY ROUTES (Protect against overlap) ---
app.use('/api/chat', chatRoutes);

// --- OTHER API ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ai', aiRoutes);
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
  res.status(500).json({ message: 'Something went wrong!' });
});

// Setup Server and WebSockets
const server = http.createServer(app);
initSocket(server, corsOptions);

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
