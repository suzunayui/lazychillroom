// テストヘルパー関数
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../backend/config/database');

class TestHelper {
  constructor() {
    this.testUsers = [];
    this.testGuilds = [];
    this.testChannels = [];
  }

  // テスト用ユーザー作成
  async createTestUser(userData = {}) {
    const defaultUser = {
      userid: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      password: 'testpassword123',
      nickname: 'Test User'
    };

    const user = { ...defaultUser, ...userData };
    
    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(user.password, 4);
    
    // データベースに挿入
    const result = await db.query(`
      INSERT INTO users (userid, password_hash, nickname)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [user.userid, hashedPassword, user.nickname]);

    const createdUser = {
      id: result[0].id,
      userid: user.userid,
      nickname: user.nickname,
      password: user.password // 平文パスワードを保持（テスト用）
    };

    this.testUsers.push(createdUser);
    return createdUser;
  }

  // テスト用管理者ユーザー作成
  async createTestAdmin(userData = {}) {
    const adminUser = await this.createTestUser({
      userid: `admin_${Date.now()}`,
      nickname: 'Test Admin',
      ...userData
    });

    // 管理者権限を付与
    await db.query(`UPDATE users SET is_admin = 1 WHERE id = $1`, [adminUser.id]);
    adminUser.is_admin = 1;

    return adminUser;
  }

  // テスト用ギルド作成
  async createTestGuild(ownerId, guildData = {}) {
    const defaultGuild = {
      name: `Test Guild ${Date.now()}`,
      description: 'Test guild description',
      icon_url: null
    };

    const guild = { ...defaultGuild, ...guildData };
    
    const result = await db.query(`
      INSERT INTO guilds (name, description, owner_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [guild.name, guild.description, ownerId]);

    const createdGuild = {
      id: result[0].id,
      name: guild.name,
      description: guild.description,
      owner_id: ownerId
    };

    // ギルドメンバーシップを追加
    await db.query(`
      INSERT INTO guild_members (guild_id, user_id, joined_at)
      VALUES ($1, $2, NOW())
    `, [createdGuild.id, ownerId]);

    this.testGuilds.push(createdGuild);
    return createdGuild;
  }

  // テスト用チャンネル作成
  async createTestChannel(guildId, channelData = {}) {
    const defaultChannel = {
      name: `test-channel-${Date.now()}`,
      type: 'text',
      topic: 'Test channel topic'
    };

    const channel = { ...defaultChannel, ...channelData };
    
    const result = await db.query(`
      INSERT INTO channels (guild_id, name, type, topic)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [guildId, channel.name, channel.type, channel.topic]);

    const createdChannel = {
      id: result[0].id,
      guild_id: guildId,
      name: channel.name,
      type: channel.type,
      topic: channel.topic
    };

    this.testChannels.push(createdChannel);
    return createdChannel;
  }

  // JWT トークン生成
  generateToken(user) {
    return jwt.sign(
      { userId: user.id, userid: user.userid },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
  }

  // テスト用セッション生成
  async generateSession(user) {
    // テスト環境では簡単なセッションIDを生成
    const sessionId = `test_session_${user.id}_${Date.now()}`;
    
    // モックセッションデータをメモリに保存（テスト環境のみ）
    if (!global.testSessions) {
      global.testSessions = new Map();
    }
    
    global.testSessions.set(sessionId, {
      userId: user.id,
      userid: user.userid,
      createdAt: new Date().toISOString()
    });
    
    return sessionId;
  }

  // 認証ヘッダー生成
  getAuthHeader(user) {
    const token = this.generateToken(user);
    return { Authorization: `Bearer ${token}` };
  }

  // API リクエストヘルパー（認証付き）
  authenticatedRequest(app, user) {
    return {
      get: (url) => request(app).get(url).set(this.getAuthHeader(user)),
      post: (url) => request(app).post(url).set(this.getAuthHeader(user)),
      put: (url) => request(app).put(url).set(this.getAuthHeader(user)),
      delete: (url) => request(app).delete(url).set(this.getAuthHeader(user))
    };
  }

  // テストデータクリーンアップ
  async cleanup() {
    try {
      // 作成したテストデータを削除（PostgreSQL用）
      if (this.testChannels.length > 0) {
        const channelIds = this.testChannels.map(c => c.id);
        await db.query(`DELETE FROM messages WHERE channel_id = ANY($1)`, [channelIds]);
        await db.query(`DELETE FROM channels WHERE id = ANY($1)`, [channelIds]);
      }

      if (this.testGuilds.length > 0) {
        const guildIds = this.testGuilds.map(g => g.id);
        await db.query(`DELETE FROM guild_members WHERE guild_id = ANY($1)`, [guildIds]);
        await db.query(`DELETE FROM guilds WHERE id = ANY($1)`, [guildIds]);
      }

      if (this.testUsers.length > 0) {
        const userIds = this.testUsers.map(u => u.id);
        await db.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
      }

      // 配列をクリア
      this.testUsers = [];
      this.testGuilds = [];
      this.testChannels = [];
    } catch (error) {
      console.error('テストデータクリーンアップエラー:', error);
    }
  }

  // 全体的なクリーンアップ（テスト終了時）
  static async globalCleanup() {
    try {
      // 新しいキャッシュシステムのRedis接続をクローズ
      const { disconnectRedis } = require('../../backend/config/cache');
      await disconnectRedis();
      
      // データベース接続（古いconfig/database.js）
      if (db.redis && typeof db.redis.disconnect === 'function') {
        await db.redis.disconnect();
      }
      
      // PostgreSQL接続プールをクローズ
      if (db.pgPool && typeof db.pgPool.end === 'function') {
        await db.pgPool.end();
      }
      
      console.log('✅ All connections closed successfully');
    } catch (error) {
      console.error('グローバルクリーンアップエラー:', error);
    }
  }

  // ランダムな文字列生成
  randomString(length = 8) {
    return Math.random().toString(36).substring(2, length + 2);
  }

  // テスト用メッセージ作成
  async createTestMessage(channelId, userId, content = 'Test message') {
    const result = await db.query(`
      INSERT INTO messages (channel_id, user_id, content, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id
    `, [channelId, userId, content]);

    return {
      id: result[0].id,
      channel_id: channelId,
      user_id: userId,
      content: content
    };
  }

  // データベースレコード数を取得
  async getRecordCount(tableName) {
    const result = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result[0].count);
  }

  // テスト用フレンド関係作成
  async createFriendship(userId1, userId2) {
    await db.query(`
      INSERT INTO friendships (user1_id, user2_id)
      VALUES ($1, $2)
    `, [Math.min(userId1, userId2), Math.max(userId1, userId2)]);
  }
}

module.exports = TestHelper;
