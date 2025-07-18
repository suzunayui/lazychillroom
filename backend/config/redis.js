// Redis接続設定
const Redis = require('ioredis');

// テスト環境とプロダクション環境で設定を分ける
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  maxRetriesPerRequest: 3
};

// テスト環境では追加設定
if (process.env.NODE_ENV === 'test') {
  redisConfig.enableAutoPipelining = false;
  redisConfig.enableOfflineQueue = false;
  redisConfig.connectTimeout = 1000;
  redisConfig.commandTimeout = 1000;
}

const redis = new Redis(redisConfig);

// Redisエラーハンドリング
redis.on('error', (err) => {
  if (process.env.NODE_ENV === 'test' && err.code === 'ECONNREFUSED') {
    // テスト環境でのRedis接続失敗は警告レベルに
    return;
  }
  console.warn('⚠️  Redis connection error (cache disabled):', err.message);
});

redis.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Redis connected successfully');
  }
});

redis.on('ready', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Redis ready for operations');
  }
});

// 接続関数
const connectRedis = async () => {
  try {
    if (redis.status !== 'ready') {
      await redis.connect();
    }
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Redis connection failed:', error);
    }
    return false;
  }
};

// クリーンアップ関数
const disconnectRedis = async () => {
  try {
    if (redis.status !== 'end') {
      await redis.disconnect();
    }
  } catch (error) {
    console.warn('Redis disconnect error:', error);
  }
};

module.exports = {
  redis,
  connectRedis,
  disconnectRedis
};
