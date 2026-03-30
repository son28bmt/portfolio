const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
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
const http = require('http');
const { initSocket } = require('./services/socket.service');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Sync Database (Forcefully for initialization if needed, but usually sequelize.sync() is enough)
// sequelize.sync();

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
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
const captureRawBody = (req, res, buf) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString('utf8');
  }
};

app.use(express.json({ limit: '50mb', verify: captureRawBody }));
app.use(express.urlencoded({ limit: '50mb', extended: true, verify: captureRawBody }));
app.use(morgan('dev'));

const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/', seoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/donate', donateRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api', marketplaceRoutes);
app.use('/', marketplaceRoutes);

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
