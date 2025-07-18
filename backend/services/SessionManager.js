// セッション管理（Redis）
const { redis } = require('../config/redis');

class SessionManager {
  constructor() {
    this.redis = redis;
    this.sessionTTL = 604800; // 7日
  }

  async createSession(userId, sessionData) {
    try {
      const sessionId = `session:${userId}:${Date.now()}`;
      await this.redis.setex(sessionId, this.sessionTTL, JSON.stringify({
        userId,
        ...sessionData,
        createdAt: new Date().toISOString()
      }));
      return sessionId;
    } catch (error) {
      console.warn('セッション作成失敗:', error.message);
      return null;
    }
  }

  async getSession(sessionId) {
    try {
      const data = await this.redis.get(sessionId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('セッション取得失敗:', error.message);
      return null;
    }
  }

  async updateSession(sessionId, updates) {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        const updated = { ...session, ...updates, updatedAt: new Date().toISOString() };
        await this.redis.setex(sessionId, this.sessionTTL, JSON.stringify(updated));
        return true;
      }
      return false;
    } catch (error) {
      console.warn('セッション更新失敗:', error.message);
      return false;
    }
  }

  async deleteSession(sessionId) {
    try {
      await this.redis.del(sessionId);
      return true;
    } catch (error) {
      console.warn('セッション削除失敗:', error.message);
      return false;
    }
  }

  async getUserSessions(userId) {
    try {
      const pattern = `session:${userId}:*`;
      const keys = await this.redis.keys(pattern);
      const sessions = [];
      
      for (const key of keys) {
        const session = await this.getSession(key);
        if (session) sessions.push({ sessionId: key, ...session });
      }
      
      return sessions;
    } catch (error) {
      console.warn('ユーザーセッション取得失敗:', error.message);
      return [];
    }
  }
}

module.exports = SessionManager;
