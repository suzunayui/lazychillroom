// DM機能の基本テスト（データベース接続無し）
const request = require('supertest');
const express = require('express');

// テスト用DM API（モック）
function createDMTestApp() {
  const app = express();
  app.use(express.json());
  
  // モックデータ
  const mockUsers = {
    1: { id: 1, userid: 'user1', nickname: 'User One', email: 'user1@test.com' },
    2: { id: 2, userid: 'user2', nickname: 'User Two', email: 'user2@test.com' },
    3: { id: 3, userid: 'user3', nickname: 'User Three', email: 'user3@test.com' }
  };
  
  const mockFriendships = [
    { id: 1, user1_id: 1, user2_id: 2 }, // user1とuser2はフレンド
    { id: 2, user1_id: 2, user2_id: 3 }  // user2とuser3はフレンド
  ];
  
  const mockDMChannels = [];
  const mockMessages = [];
  
  // 認証ミドルウェア（モック）
  const mockAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'トークンがありません' });
    }
    
    const token = authHeader.split(' ')[1];
    if (token === 'user1-token') {
      req.user = mockUsers[1];
    } else if (token === 'user2-token') {
      req.user = mockUsers[2];
    } else if (token === 'user3-token') {
      req.user = mockUsers[3];
    } else {
      return res.status(401).json({ success: false, message: '無効なトークンです' });
    }
    next();
  };
  
  // フレンドシップ確認ヘルパー
  const areFriends = (userId1, userId2) => {
    return mockFriendships.some(f => 
      (f.user1_id === userId1 && f.user2_id === userId2) ||
      (f.user1_id === userId2 && f.user2_id === userId1)
    );
  };
  
  // DMチャンネル作成
  app.post('/api/dm', mockAuth, (req, res) => {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDは必須です'
      });
    }
    
    const targetUser = mockUsers[user_id];
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // 自分自身とのDMチャンネルは作成できない
    if (user_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '自分自身とのDMチャンネルは作成できません'
      });
    }
    
    // フレンドでない場合はDMチャンネル作成不可
    if (!areFriends(req.user.id, user_id)) {
      return res.status(403).json({
        success: false,
        message: 'フレンドでないユーザーとのDMチャンネルは作成できません'
      });
    }
    
    // 既存のDMチャンネルをチェック
    const existingChannel = mockDMChannels.find(ch => 
      (ch.user1_id === req.user.id && ch.user2_id === user_id) ||
      (ch.user1_id === user_id && ch.user2_id === req.user.id)
    );
    
    if (existingChannel) {
      return res.status(200).json({
        success: true,
        message: '既存のDMチャンネルを返します',
        channel: {
          ...existingChannel,
          participant: targetUser
        }
      });
    }
    
    // 新しいDMチャンネルを作成
    const newChannel = {
      id: mockDMChannels.length + 1,
      user1_id: req.user.id,
      user2_id: user_id,
      type: 'dm',
      created_at: new Date().toISOString()
    };
    mockDMChannels.push(newChannel);
    
    res.status(201).json({
      success: true,
      message: 'DMチャンネルを作成しました',
      channel: {
        ...newChannel,
        participant: targetUser
      }
    });
  });
  
  // DMチャンネル一覧取得
  app.get('/api/dm', mockAuth, (req, res) => {
    const userChannels = mockDMChannels
      .filter(ch => ch.user1_id === req.user.id || ch.user2_id === req.user.id)
      .map(ch => {
        const participantId = ch.user1_id === req.user.id ? ch.user2_id : ch.user1_id;
        const participant = mockUsers[participantId];
        
        // このチャンネルの最新メッセージを取得
        const channelMessages = mockMessages
          .filter(m => m.channel_id === ch.id)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        return {
          ...ch,
          participant,
          last_message: channelMessages[0] || null,
          unread_count: 0 // 簡易実装
        };
      });
    
    res.status(200).json({
      success: true,
      channels: userChannels
    });
  });
  
  // DMチャンネル削除
  app.delete('/api/dm/:id', mockAuth, (req, res) => {
    const channelId = parseInt(req.params.id);
    const channelIndex = mockDMChannels.findIndex(ch => 
      ch.id === channelId && 
      (ch.user1_id === req.user.id || ch.user2_id === req.user.id)
    );
    
    if (channelIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'DMチャンネルが見つかりません'
      });
    }
    
    // チャンネルを削除
    mockDMChannels.splice(channelIndex, 1);
    
    // チャンネルのメッセージも削除
    const messageIndices = [];
    mockMessages.forEach((msg, index) => {
      if (msg.channel_id === channelId) {
        messageIndices.push(index);
      }
    });
    messageIndices.reverse().forEach(index => {
      mockMessages.splice(index, 1);
    });
    
    res.status(200).json({
      success: true,
      message: 'DMチャンネルを削除しました'
    });
  });
  
  // DMメッセージ送信（簡易版）
  app.post('/api/dm/:id/messages', mockAuth, (req, res) => {
    const channelId = parseInt(req.params.id);
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'メッセージ内容は必須です'
      });
    }
    
    const channel = mockDMChannels.find(ch => 
      ch.id === channelId && 
      (ch.user1_id === req.user.id || ch.user2_id === req.user.id)
    );
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'DMチャンネルが見つかりません'
      });
    }
    
    const newMessage = {
      id: mockMessages.length + 1,
      channel_id: channelId,
      user_id: req.user.id,
      content: content.trim(),
      created_at: new Date().toISOString()
    };
    mockMessages.push(newMessage);
    
    res.status(201).json({
      success: true,
      message: 'メッセージを送信しました',
      data: {
        ...newMessage,
        user: req.user
      }
    });
  });
  
  return app;
}

describe('DM機能 基本テスト', () => {
  let app;

  beforeAll(() => {
    app = createDMTestApp();
  });

  describe('POST /api/dm - DMチャンネル作成', () => {
    test('正常なDMチャンネル作成', async () => {
      const response = await request(app)
        .post('/api/dm')
        .set('Authorization', 'Bearer user1-token')
        .send({ user_id: 2 }); // user1とuser2はフレンド

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('DMチャンネルを作成');
      expect(response.body.channel).toBeDefined();
      expect(response.body.channel.participant.userid).toBe('user2');
    });

    test('既存DMチャンネルの取得', async () => {
      const response = await request(app)
        .post('/api/dm')
        .set('Authorization', 'Bearer user2-token')
        .send({ user_id: 1 }); // 既にuser1-user2間のチャンネルが存在

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('既存のDMチャンネル');
    });

    test('フレンドでないユーザーとのDM作成（エラー）', async () => {
      const response = await request(app)
        .post('/api/dm')
        .set('Authorization', 'Bearer user1-token')
        .send({ user_id: 3 }); // user1とuser3はフレンドでない

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('フレンドでない');
    });

    test('自分自身とのDM作成（エラー）', async () => {
      const response = await request(app)
        .post('/api/dm')
        .set('Authorization', 'Bearer user1-token')
        .send({ user_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('自分自身との');
    });

    test('存在しないユーザーとのDM作成', async () => {
      const response = await request(app)
        .post('/api/dm')
        .set('Authorization', 'Bearer user1-token')
        .send({ user_id: 999 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ユーザーが見つかりません');
    });

    test('user_id未指定', async () => {
      const response = await request(app)
        .post('/api/dm')
        .set('Authorization', 'Bearer user1-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ユーザーIDは必須');
    });
  });

  describe('GET /api/dm - DMチャンネル一覧', () => {
    test('DMチャンネル一覧の取得', async () => {
      const response = await request(app)
        .get('/api/dm')
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.channels).toBeDefined();
      expect(response.body.channels).toHaveLength(1);
      expect(response.body.channels[0].participant.userid).toBe('user2');
    });

    test('認証なしでのDMチャンネル一覧取得', async () => {
      const response = await request(app)
        .get('/api/dm');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/dm/:id/messages - DMメッセージ送信', () => {
    test('正常なメッセージ送信', async () => {
      const response = await request(app)
        .post('/api/dm/1/messages')
        .set('Authorization', 'Bearer user1-token')
        .send({ content: 'Hello, this is a DM message!' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('メッセージを送信');
      expect(response.body.data.content).toBe('Hello, this is a DM message!');
      expect(response.body.data.user.userid).toBe('user1');
    });

    test('空のメッセージ送信（エラー）', async () => {
      const response = await request(app)
        .post('/api/dm/1/messages')
        .set('Authorization', 'Bearer user1-token')
        .send({ content: '   ' }); // 空白のみ

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('メッセージ内容は必須');
    });

    test('存在しないDMチャンネルへのメッセージ送信', async () => {
      const response = await request(app)
        .post('/api/dm/999/messages')
        .set('Authorization', 'Bearer user1-token')
        .send({ content: 'Test message' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('DMチャンネルが見つかりません');
    });
  });

  describe('DELETE /api/dm/:id - DMチャンネル削除', () => {
    test('DMチャンネルの削除', async () => {
      const response = await request(app)
        .delete('/api/dm/1')
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('DMチャンネルを削除');
    });

    test('存在しないDMチャンネルの削除', async () => {
      const response = await request(app)
        .delete('/api/dm/999')
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('統合シナリオ', () => {
    test('DM作成 → メッセージ送信 → チャンネル一覧確認 → 削除', async () => {
      // 1. user2とuser3のDMチャンネルを作成
      const createResponse = await request(app)
        .post('/api/dm')
        .set('Authorization', 'Bearer user2-token')
        .send({ user_id: 3 });

      expect(createResponse.status).toBe(201);
      const channelId = createResponse.body.channel.id;

      // 2. メッセージを送信
      const messageResponse = await request(app)
        .post(`/api/dm/${channelId}/messages`)
        .set('Authorization', 'Bearer user2-token')
        .send({ content: 'Integration test message' });

      expect(messageResponse.status).toBe(201);

      // 3. user3がDMチャンネル一覧を確認
      const listResponse = await request(app)
        .get('/api/dm')
        .set('Authorization', 'Bearer user3-token');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.channels).toHaveLength(1);
      expect(listResponse.body.channels[0].participant.userid).toBe('user2');

      // 4. チャンネルを削除
      const deleteResponse = await request(app)
        .delete(`/api/dm/${channelId}`)
        .set('Authorization', 'Bearer user2-token');

      expect(deleteResponse.status).toBe(200);

      // 5. 削除後の一覧確認
      const finalListResponse = await request(app)
        .get('/api/dm')
        .set('Authorization', 'Bearer user3-token');

      expect(finalListResponse.status).toBe(200);
      expect(finalListResponse.body.channels).toHaveLength(0);
    });
  });
});
