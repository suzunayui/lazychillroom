const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// 最適化されたルートとミドルウェア
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages'); // 新しいモジュラー構造
const guildRoutes = require('./routes/guilds');
const channelRoutes = require('./routes/channels');
const fileRoutes = require('./routes/files'); // 新しいモジュラー構造
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const typingRoutes = require('./routes/typing');
const dmRoutes = require('./routes/dm');
const reactionRoutes = require('./routes/reactions');
const pinRoutes = require('./routes/pins');
const presenceRoutes = require('./routes/presence');

// 新しいソケットハンドラーとミドルウェア
const OptimizedSocketHandler = require('./socket/socketHandler'); // 新しいモジュラー構造
const performanceMiddleware = require('./middleware/performance');
const { authenticateToken } = require('./middleware/auth');
const { initializeCacheServices } = require('./config/cache');
const cache = require('./config/cache');

const app = express();
const server = http.createServer(app);

// Socket.ioサーバー設定（最適化）
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // 最適化設定
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  maxHttpBufferSize: 1e8 // 100MB for image uploads
});

// パフォーマンスミドルウェアを適用（レート制限以外）
app.use(performanceMiddleware.compression);
app.use(performanceMiddleware.helmet);
app.use(performanceMiddleware.monitoring);

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Body parsing middleware（最適化）
app.use(express.json({ 
  limit: '100mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '100mb' 
}));

// 静的ファイルの前にMIMEタイプを設定
app.use((req, res, next) => {
  if (req.url.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  } else if (req.url.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css');
  }
  next();
});

// Static files with optimization
const expressStatic = express.static(path.join(__dirname, '../frontend'), {
  maxAge: '1d', // 1日キャッシュ
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    // キャッシュ制御
    if (path.includes('/css/') || path.includes('/js/')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1日
    }
  }
});

app.use(expressStatic);
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'), {
  maxAge: '7d', // アップロードファイルは7日キャッシュ
  etag: true
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);
app.use('/api/guilds', authenticateToken, guildRoutes);
app.use('/api/channels', authenticateToken, channelRoutes);
app.use('/api/files', fileRoutes); // 認証なしでファイル配信可能
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/friends', authenticateToken, friendRoutes);
app.use('/api/typing', authenticateToken, typingRoutes);
app.use('/api/dm', authenticateToken, dmRoutes);
app.use('/api/reactions', authenticateToken, reactionRoutes);
app.use('/api/pins', authenticateToken, pinRoutes);
app.use('/api/presence', authenticateToken, presenceRoutes);

// Socket.io connection handling（最適化版）
const socketHandler = OptimizedSocketHandler(io);

// Simple health check for load balancers
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Health check with stats
app.get('/api/health', async (req, res) => {
  try {
    // システム統計を取得
    const memUsage = process.memoryUsage();
    const stats = socketHandler ? socketHandler.getStats() : {};
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
      },
      connections: stats,
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// Store io instance and handlers for routes to access
app.set('io', io);
app.set('socketHandler', socketHandler);
app.set('cache', cache.cacheManager);

// Serve frontend for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  
  // 新しいキャッシュシステム初期化
  try {
    await initializeCacheServices();
    console.log('✅ Cache services initialized successfully');
  } catch (error) {
    console.warn('⚠️  Cache initialization failed - running without cache:', error.message);
  }
});
