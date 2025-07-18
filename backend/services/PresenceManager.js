// プレゼンス管理（Redis）
const { redis } = require('../config/redis');

class PresenceManager {
  constructor() {
    this.redis = redis;
    this.presenceTTL = 1800; // 30分
  }

  async updatePresence(userId, status, additionalData = {}) {
    try {
      const key = `presence:${userId}`;
      const data = {
        userId,
        status,
        lastSeen: new Date().toISOString(),
        ...additionalData
      };
      
      await this.redis.setex(key, this.presenceTTL, JSON.stringify(data));
      
      // チャンネル通知
      await this.redis.publish('presence_update', JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn('プレゼンス更新失敗:', error.message);
      return false;
    }
  }

  async getPresence(userIds) {
    try {
      const pipeline = this.redis.pipeline();
      userIds.forEach(userId => {
        pipeline.get(`presence:${userId}`);
      });
      
      const results = await pipeline.exec();
      const presence = {};
      
      userIds.forEach((userId, index) => {
        const data = results[index][1];
        presence[userId] = data ? JSON.parse(data) : null;
      });
      
      return presence;
    } catch (error) {
      console.warn('プレゼンス取得失敗:', error.message);
      return {};
    }
  }

  async getOnlineUsers() {
    try {
      const keys = await this.redis.keys('presence:*');
      const onlineUsers = [];
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const presence = JSON.parse(data);
          if (presence.status === 'online') {
            onlineUsers.push(presence);
          }
        }
      }
      
      return onlineUsers;
    } catch (error) {
      console.warn('オンラインユーザー取得失敗:', error.message);
      return [];
    }
  }

  async setOffline(userId) {
    try {
      await this.updatePresence(userId, 'offline', {
        disconnectedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.warn('オフライン設定失敗:', error.message);
      return false;
    }
  }
}

module.exports = PresenceManager;
