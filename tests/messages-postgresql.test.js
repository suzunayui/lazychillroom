// PostgreSQL + Redis メッセージ機能テスト
const request = require('supertest');
const express = require('express');

// テスト用メッセージアプリ（PostgreSQL + Redis風）
function createMessageTestApp() {
  const app = express();
  app.use(express.json());
  
  // モックデータ
  const mockUsers = {
    1: { id: 1, userid: 'user1', nickname: 'User One', is_admin: false },
    2: { id: 2, userid: 'user2', nickname: 'User Two', is_admin: false },
    3: { id: 3, userid: 'admin', nickname: 'Admin User', is_admin: true }
  };
  
  const mockGuilds = {
    1: { 
      id: 1, 
      name: 'Test Guild', 
      description: 'Test guild for PostgreSQL',
      owner_id: 1,
      icon_url: null,
      created_at: new Date().toISOString()
    }
  };
  
  const mockChannels = {
    1: { 
      id: 1, 
      guild_id: 1,
      name: 'general', 
      description: 'General channel',
      channel_type: 'text',
      position: 0,
      is_default: true,
      created_at: new Date().toISOString()
    },
    2: {
      id: 2,
      guild_id: 1,
      name: 'random',
      description: 'Random discussions',
      channel_type: 'text',
      position: 1,
      is_default: false,
      created_at: new Date().toISOString()
    }
  };
  
  let mockMessages = {
    1: {
      id: 1,
      channel_id: 1,
      user_id: 1,
      content: 'Hello, PostgreSQL world!',
      message_type: 'text',
      is_edited: false,
      is_deleted: false,
      reply_to: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    2: {
      id: 2,
      channel_id: 1,
      user_id: 2,
      content: 'Nice to meet you!',
      message_type: 'text',
      is_edited: false,
      is_deleted: false,
      reply_to: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
  
  const mockReactions = {};
  const mockMessageCache = {}; // Redis キャッシュ
  const mockThreads = {};
  
  // 認証ミドルウェア
  const mockAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '認証が必要です' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 特定のトークンを最初にチェック
    if (token === 'user1-token') req.user = mockUsers[1];
    else if (token === 'user2-token') req.user = mockUsers[2];
    else if (token === 'admin-token') req.user = mockUsers[3];
    else {
      // 動的にユーザーを探す
      const user = Object.values(mockUsers).find(user => {
        const expectedToken = `user${user.id}-token`;
        return token === expectedToken;
      });
      
      if (user) {
        req.user = user;
      } else {
        return res.status(401).json({ success: false, message: '無効なトークン' });
      }
    }
    
    next();
  };
  
  // メッセージ送信
  app.post('/api/messages/:channelId', mockAuth, (req, res) => {
    const channelId = parseInt(req.params.channelId);
    const { content, messageType = 'text', replyTo = null } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'メッセージ内容は必須です'
      });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'メッセージは2000文字以内で入力してください'
      });
    }
    
    const channel = mockChannels[channelId];
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'チャンネルが見つかりません'
      });
    }
    
    // 新しいメッセージID
    const messageId = Object.keys(mockMessages).length + 1;
    const now = new Date().toISOString();
    
    const newMessage = {
      id: messageId,
      channel_id: channelId,
      user_id: req.user.id,
      content: content.trim(),
      message_type: messageType,
      is_edited: false,
      is_deleted: false,
      reply_to: replyTo,
      created_at: now,
      updated_at: now
    };
    
    mockMessages[messageId] = newMessage;
    
    // Redis キャッシュに追加
    const cacheKey = `channel:${channelId}:latest_messages`;
    if (!mockMessageCache[cacheKey]) {
      mockMessageCache[cacheKey] = [];
    }
    mockMessageCache[cacheKey].unshift({
      ...newMessage,
      author: {
        id: req.user.id,
        userid: req.user.userid,
        nickname: req.user.nickname
      }
    });
    
    // 最新50件のみ保持
    if (mockMessageCache[cacheKey].length > 50) {
      mockMessageCache[cacheKey] = mockMessageCache[cacheKey].slice(0, 50);
    }
    
    res.status(201).json({
      success: true,
      message: 'メッセージを送信しました',
      data: {
        ...newMessage,
        author: {
          id: req.user.id,
          userid: req.user.userid,
          nickname: req.user.nickname
        }
      }
    });
  });
  
  // メッセージ取得
  app.get('/api/messages/:channelId', mockAuth, (req, res) => {
    const channelId = parseInt(req.params.channelId);
    const { limit = 50, before = null, after = null } = req.query;
    
    const channel = mockChannels[channelId];
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'チャンネルが見つかりません'
      });
    }
    
    // Redis キャッシュから取得を試行
    const cacheKey = `channel:${channelId}:latest_messages`;
    let messages = [];
    
    if (mockMessageCache[cacheKey] && !before && !after) {
      // キャッシュから取得
      messages = mockMessageCache[cacheKey].slice(0, parseInt(limit));
    } else {
      // PostgreSQLから取得（モック）
      messages = Object.values(mockMessages)
        .filter(msg => msg.channel_id === channelId && !msg.is_deleted)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (before) {
        const beforeDate = new Date(before);
        messages = messages.filter(msg => new Date(msg.created_at) < beforeDate);
      }
      
      if (after) {
        const afterDate = new Date(after);
        messages = messages.filter(msg => new Date(msg.created_at) > afterDate);
      }
      
      messages = messages.slice(0, parseInt(limit));
      
      // 著者情報を追加
      messages = messages.map(msg => ({
        ...msg,
        author: {
          id: mockUsers[msg.user_id].id,
          userid: mockUsers[msg.user_id].userid,
          nickname: mockUsers[msg.user_id].nickname
        }
      }));
    }
    
    res.json({
      success: true,
      messages: messages,
      pagination: {
        has_more: messages.length >= parseInt(limit),
        total_count: Object.values(mockMessages).filter(
          msg => msg.channel_id === channelId && !msg.is_deleted
        ).length
      }
    });
  });
  
  // メッセージ編集
  app.put('/api/messages/:messageId', mockAuth, (req, res) => {
    const messageId = parseInt(req.params.messageId);
    const { content } = req.body;
    
    const message = mockMessages[messageId];
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つかりません'
      });
    }
    
    if (message.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '他のユーザーのメッセージは編集できません'
      });
    }
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'メッセージ内容は必須です'
      });
    }
    
    // メッセージ更新
    message.content = content.trim();
    message.is_edited = true;
    message.updated_at = new Date().toISOString();
    
    // Redis キャッシュ更新
    const cacheKey = `channel:${message.channel_id}:latest_messages`;
    if (mockMessageCache[cacheKey]) {
      const cachedMessage = mockMessageCache[cacheKey].find(m => m.id === messageId);
      if (cachedMessage) {
        cachedMessage.content = message.content;
        cachedMessage.is_edited = true;
        cachedMessage.updated_at = message.updated_at;
      }
    }
    
    res.json({
      success: true,
      message: 'メッセージを編集しました',
      data: {
        ...message,
        author: {
          id: req.user.id,
          userid: req.user.userid,
          nickname: req.user.nickname
        }
      }
    });
  });
  
  // メッセージ削除
  app.delete('/api/messages/:messageId', mockAuth, (req, res) => {
    const messageId = parseInt(req.params.messageId);
    
    const message = mockMessages[messageId];
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つかりません'
      });
    }
    
    if (message.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '他のユーザーのメッセージは削除できません'
      });
    }
    
    // 論理削除
    message.is_deleted = true;
    message.updated_at = new Date().toISOString();
    
    // Redis キャッシュから削除
    const cacheKey = `channel:${message.channel_id}:latest_messages`;
    if (mockMessageCache[cacheKey]) {
      mockMessageCache[cacheKey] = mockMessageCache[cacheKey].filter(m => m.id !== messageId);
    }
    
    res.json({
      success: true,
      message: 'メッセージを削除しました'
    });
  });
  
  // リアクション追加
  app.post('/api/messages/:messageId/reactions', mockAuth, (req, res) => {
    const messageId = parseInt(req.params.messageId);
    const { emoji } = req.body;
    
    const message = mockMessages[messageId];
    if (!message || message.is_deleted) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つかりません'
      });
    }
    
    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: '絵文字は必須です'
      });
    }
    
    // リアクション追加
    const reactionKey = `${messageId}:${emoji}`;
    if (!mockReactions[reactionKey]) {
      mockReactions[reactionKey] = [];
    }
    
    // 既に同じユーザーがリアクションしているかチェック
    const existingReaction = mockReactions[reactionKey].find(r => r.user_id === req.user.id);
    if (existingReaction) {
      return res.status(400).json({
        success: false,
        message: '既にリアクションしています'
      });
    }
    
    mockReactions[reactionKey].push({
      message_id: messageId,
      user_id: req.user.id,
      emoji: emoji,
      created_at: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'リアクションを追加しました',
      reaction: {
        emoji: emoji,
        count: mockReactions[reactionKey].length,
        users: mockReactions[reactionKey].map(r => ({
          id: mockUsers[r.user_id].id,
          userid: mockUsers[r.user_id].userid
        }))
      }
    });
  });
  
  // メッセージ検索
  app.get('/api/search/messages', mockAuth, (req, res) => {
    const { query, channelId, userId, before, after, limit = 25 } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '検索クエリは必須です'
      });
    }
    
    let results = Object.values(mockMessages).filter(msg => !msg.is_deleted);
    
    // テキスト検索
    const searchTerm = query.trim().toLowerCase();
    results = results.filter(msg => 
      msg.content.toLowerCase().includes(searchTerm)
    );
    
    // フィルタ適用
    if (channelId) {
      results = results.filter(msg => msg.channel_id === parseInt(channelId));
    }
    
    if (userId) {
      results = results.filter(msg => msg.user_id === parseInt(userId));
    }
    
    if (before) {
      results = results.filter(msg => new Date(msg.created_at) < new Date(before));
    }
    
    if (after) {
      results = results.filter(msg => new Date(msg.created_at) > new Date(after));
    }
    
    // ソートと制限
    results = results
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, parseInt(limit));
    
    // 著者情報追加
    results = results.map(msg => ({
      ...msg,
      author: {
        id: mockUsers[msg.user_id].id,
        userid: mockUsers[msg.user_id].userid,
        nickname: mockUsers[msg.user_id].nickname
      },
      channel: {
        id: mockChannels[msg.channel_id].id,
        name: mockChannels[msg.channel_id].name,
        guild_id: mockChannels[msg.channel_id].guild_id
      }
    }));
    
    res.json({
      success: true,
      results: results,
      total_count: results.length,
      query: query
    });
  });
  
  return app;
}

describe('PostgreSQL + Redis メッセージ機能テスト', () => {
  let app;

  beforeAll(() => {
    app = createMessageTestApp();
  });

  afterAll(async () => {
    // 非同期処理のクリーンアップ
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // テスト後のクリーンアップ
    if (app && app.close) {
      await app.close();
    }
  });

  describe('メッセージ送信', () => {
    test('正常なメッセージ送信', async () => {
      const response = await request(app)
        .post('/api/messages/1')
        .set('Authorization', 'Bearer user1-token')
        .send({
          content: 'Test message with PostgreSQL'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Test message with PostgreSQL');
      expect(response.body.data.author.userid).toBe('user1');
    });

    test('リプライメッセージ送信', async () => {
      const response = await request(app)
        .post('/api/messages/1')
        .set('Authorization', 'Bearer user2-token')
        .send({
          content: 'This is a reply',
          replyTo: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reply_to).toBe(1);
    });

    test('空のメッセージ送信エラー', async () => {
      const response = await request(app)
        .post('/api/messages/1')
        .set('Authorization', 'Bearer user1-token')
        .send({
          content: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('長すぎるメッセージ送信エラー', async () => {
      const longMessage = 'a'.repeat(2001);
      
      const response = await request(app)
        .post('/api/messages/1')
        .set('Authorization', 'Bearer user1-token')
        .send({
          content: longMessage
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('2000文字以内');
    });
  });

  describe('メッセージ取得 (Redis キャッシュ)', () => {
    test('チャンネルのメッセージ取得', async () => {
      const response = await request(app)
        .get('/api/messages/1')
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.messages)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test('制限付きメッセージ取得', async () => {
      const response = await request(app)
        .get('/api/messages/1')
        .set('Authorization', 'Bearer user1-token')
        .query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.messages.length).toBeLessThanOrEqual(10);
    });

    test('存在しないチャンネルのメッセージ取得エラー', async () => {
      const response = await request(app)
        .get('/api/messages/999')
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('メッセージ編集', () => {
    test('自分のメッセージ編集', async () => {
      const response = await request(app)
        .put('/api/messages/1')
        .set('Authorization', 'Bearer user1-token')
        .send({
          content: 'Edited message content'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Edited message content');
      expect(response.body.data.is_edited).toBe(true);
    });

    test('管理者による他ユーザーのメッセージ編集', async () => {
      const response = await request(app)
        .put('/api/messages/2')
        .set('Authorization', 'Bearer admin-token')
        .send({
          content: 'Admin edited this message'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Admin edited this message');
    });

    test('他ユーザーのメッセージ編集エラー', async () => {
      const response = await request(app)
        .put('/api/messages/1')
        .set('Authorization', 'Bearer user2-token')
        .send({
          content: 'Trying to edit others message'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('メッセージ削除', () => {
    test('自分のメッセージ削除', async () => {
      // 先にメッセージを送信
      const createResponse = await request(app)
        .post('/api/messages/1')
        .set('Authorization', 'Bearer user1-token')
        .send({
          content: 'Message to be deleted'
        });

      const messageId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('管理者による他ユーザーのメッセージ削除', async () => {
      const response = await request(app)
        .delete('/api/messages/2')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('リアクション機能', () => {
    test('メッセージにリアクション追加', async () => {
      const response = await request(app)
        .post('/api/messages/1/reactions')
        .set('Authorization', 'Bearer user1-token')
        .send({
          emoji: '👍'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reaction.emoji).toBe('👍');
      expect(response.body.reaction.count).toBe(1);
    });

    test('重複リアクションエラー', async () => {
      const response = await request(app)
        .post('/api/messages/1/reactions')
        .set('Authorization', 'Bearer user1-token')
        .send({
          emoji: '👍'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('既にリアクション');
    });
  });

  describe('メッセージ検索', () => {
    test('基本的なメッセージ検索', async () => {
      const response = await request(app)
        .get('/api/search/messages')
        .set('Authorization', 'Bearer user1-token')
        .query({
          query: 'Hello'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.query).toBe('Hello');
    });

    test('チャンネル指定での検索', async () => {
      const response = await request(app)
        .get('/api/search/messages')
        .set('Authorization', 'Bearer user1-token')
        .query({
          query: 'PostgreSQL',
          channelId: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // チャンネルIDが1のメッセージのみ
      response.body.results.forEach(result => {
        expect(result.channel_id).toBe(1);
      });
    });

    test('ユーザー指定での検索', async () => {
      const response = await request(app)
        .get('/api/search/messages')
        .set('Authorization', 'Bearer user1-token')
        .query({
          query: 'Hello',
          userId: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ユーザーID1のメッセージのみ
      response.body.results.forEach(result => {
        expect(result.user_id).toBe(1);
      });
    });

    test('空の検索クエリエラー', async () => {
      const response = await request(app)
        .get('/api/search/messages')
        .set('Authorization', 'Bearer user1-token')
        .query({
          query: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('統合シナリオ', () => {
    test('メッセージ送信 → 編集 → リアクション → 検索', async () => {
      // 1. メッセージ送信
      const createResponse = await request(app)
        .post('/api/messages/1')
        .set('Authorization', 'Bearer user1-token')
        .send({
          content: 'Integration test message'
        });

      expect(createResponse.status).toBe(201);
      const messageId = createResponse.body.data.id;

      // 2. メッセージ編集
      const editResponse = await request(app)
        .put(`/api/messages/${messageId}`)
        .set('Authorization', 'Bearer user1-token')
        .send({
          content: 'Edited integration test message'
        });

      expect(editResponse.status).toBe(200);
      expect(editResponse.body.data.is_edited).toBe(true);

      // 3. リアクション追加
      const reactionResponse = await request(app)
        .post(`/api/messages/${messageId}/reactions`)
        .set('Authorization', 'Bearer user2-token')
        .send({
          emoji: '🎉'
        });

      expect(reactionResponse.status).toBe(200);

      // 4. メッセージ検索
      const searchResponse = await request(app)
        .get('/api/search/messages')
        .set('Authorization', 'Bearer user1-token')
        .query({
          query: 'integration'
        });

      expect(searchResponse.status).toBe(200);
      const foundMessage = searchResponse.body.results.find(r => r.id === messageId);
      expect(foundMessage).toBeDefined();
      expect(foundMessage.content).toBe('Edited integration test message');
    });
  });
});
