// パフォーマンス最適化とミドルウェア設定
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const { CacheManager } = require('../config/cache');

const cache = new CacheManager();

// 圧縮設定（レスポンス最適化）
const compressionConfig = {
  filter: (req, res) => {
    // 圧縮しないファイルタイプ
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // 画像ファイルは既に圧縮済み
    if (res.getHeader('Content-Type')?.startsWith('image/')) {
      return false;
    }
    
    return compression.filter(req, res);
  },
  level: 6, // バランス重視
  threshold: 1024 // 1KB以上のレスポンスを圧縮
};

// セキュリティヘッダー設定
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      mediaSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false // WebRTC対応
};

// レスポンス時間計測ミドルウェア
const responseTimeMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const responseTime = Number(end - start) / 1000000; // ナノ秒からミリ秒
    
    // 遅いリクエストをログ出力
    if (responseTime > 1000) { // 1秒以上
      console.warn(`Slow request: ${req.method} ${req.path} - ${responseTime.toFixed(2)}ms`);
    }
    
    // レスポンスがまだ送信されていない場合のみヘッダーを設定
    if (!res.headersSent) {
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
    }
  });
  
  next();
};

// キャッシュヘッダー設定ミドルウェア
const cacheControlMiddleware = (req, res, next) => {
  // 静的ファイルのキャッシュ設定
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)$/)) {
    res.set('Cache-Control', 'public, max-age=86400'); // 1日
  }
  
  // APIレスポンスはキャッシュしない
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  
  next();
};

// メモリ使用量監視
const memoryMonitorMiddleware = (req, res, next) => {
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  // メモリ使用量が多い場合は警告
  if (memUsedMB > 512) { // 512MB以上
    console.warn(`High memory usage: ${memUsedMB}MB`);
  }
  
  res.set('X-Memory-Usage', `${memUsedMB}MB`);
  next();
};

// エラーハンドリングミドルウェア
const errorHandlerMiddleware = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Multerファイルサイズエラー
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'ファイルサイズが大きすぎます'
    });
  }
  
  // 一般的なサーバーエラー
  res.status(500).json({
    success: false,
    message: 'サーバーエラーが発生しました',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// ヘルスチェックエンドポイント
const healthCheckRouter = express.Router();

healthCheckRouter.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: await cache.getStats()
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// サーバー統計エンドポイント
healthCheckRouter.get('/stats', async (req, res) => {
  try {
    const stats = {
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      cache: await cache.getStats(),
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = {
  compression: compression(compressionConfig),
  helmet: helmet(helmetConfig),
  monitoring: responseTimeMiddleware,
  compressionConfig,
  helmetConfig,
  responseTimeMiddleware,
  cacheControlMiddleware,
  memoryMonitorMiddleware,
  errorHandlerMiddleware,
  healthCheckRouter
};
