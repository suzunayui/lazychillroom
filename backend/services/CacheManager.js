// キャッシュマネージャー
const { redis } = require('../config/redis');
const { cacheConfig } = require('../config/cacheConfig');

class CacheManager {
  constructor() {
    this.redis = redis;
  }

  // メッセージキャッシュ
  async cacheMessages(channelId, messages) {
    try {
      const key = `${cacheConfig.messages.keyPrefix}channel:${channelId}`;
      const pipeline = this.redis.pipeline();
      
      pipeline.del(key);
      pipeline.lpush(key, ...messages.map(msg => JSON.stringify(msg)));
      pipeline.ltrim(key, 0, cacheConfig.messages.maxItems - 1);
      pipeline.expire(key, cacheConfig.messages.ttl);
      
      await pipeline.exec();
    } catch (error) {
      console.warn('メッセージキャッシュ失敗:', error.message);
    }
  }

  async getCachedMessages(channelId, limit = 50) {
    try {
      const key = `${cacheConfig.messages.keyPrefix}channel:${channelId}`;
      const cached = await this.redis.lrange(key, 0, limit - 1);
      return cached.map(msg => JSON.parse(msg));
    } catch (error) {
      console.warn('メッセージキャッシュ取得失敗:', error.message);
      return [];
    }
  }

  // ユーザー情報キャッシュ
  async cacheUser(userId, userData) {
    try {
      const key = `${cacheConfig.users.keyPrefix}${userId}`;
      await this.redis.setex(key, cacheConfig.users.ttl, JSON.stringify(userData));
    } catch (error) {
      console.warn('ユーザーキャッシュ失敗:', error.message);
    }
  }

  async getCachedUser(userId) {
    try {
      const key = `${cacheConfig.users.keyPrefix}${userId}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('ユーザーキャッシュ取得失敗:', error.message);
      return null;
    }
  }

  // 画像メタデータキャッシュ
  async cacheImage(imageId, metadata) {
    try {
      const key = `${cacheConfig.images.keyPrefix}${imageId}`;
      await this.redis.setex(key, cacheConfig.images.ttl, JSON.stringify(metadata));
    } catch (error) {
      console.warn('画像キャッシュ失敗:', error.message);
    }
  }

  async getCachedImage(imageId) {
    try {
      const key = `${cacheConfig.images.keyPrefix}${imageId}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('画像キャッシュ取得失敗:', error.message);
      return null;
    }
  }

  // 複数キーの削除（キャッシュ無効化）
  async invalidatePattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.warn('キャッシュ無効化失敗:', error.message);
    }
  }

  // 統計情報取得
  async getStats() {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      return {
        memoryUsed: this.parseMemoryInfo(info),
        keyCount,
        isConnected: this.redis.status === 'ready'
      };
    } catch (error) {
      return {
        memoryUsed: { used: '0MB', peak: '0MB' },
        keyCount: 0,
        isConnected: false
      };
    }
  }

  parseMemoryInfo(info) {
    const lines = info.split('\r\n');
    const memory = {};
    
    lines.forEach(line => {
      if (line.startsWith('used_memory_human:')) {
        memory.used = line.split(':')[1];
      } else if (line.startsWith('used_memory_peak_human:')) {
        memory.peak = line.split(':')[1];
      }
    });
    
    return memory;
  }
}

module.exports = CacheManager;
