// メインキャッシュエクスポート（モジュラー構造）
const CacheManager = require('../services/CacheManager');
const SessionManager = require('../services/SessionManager');
const PresenceManager = require('../services/PresenceManager');
const { cacheConfig } = require('./cacheConfig');
const { redis, connectRedis, disconnectRedis } = require('./redis');

// インスタンス作成
let cacheManager;
let sessionManager;
let presenceManager;

const initializeCacheServices = async () => {
  await connectRedis();
  cacheManager = new CacheManager();
  sessionManager = new SessionManager();
  presenceManager = new PresenceManager();
};

module.exports = {
  connectRedis,
  disconnectRedis,
  initializeCacheServices,
  cacheConfig,
  CacheManager,
  SessionManager,
  PresenceManager,
  get cacheManager() { return cacheManager; },
  get sessionManager() { return sessionManager; },
  get presenceManager() { return presenceManager; },
  get redisClient() { return redis; },
  redis
};
