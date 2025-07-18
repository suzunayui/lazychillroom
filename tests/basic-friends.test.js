// フレンド機能の基本テスト（データベース接続無し）
const request = require('supertest');
const express = require('express');

// テスト用フレンドAPI（モック）
function createFriendsTestApp() {
  const app = express();
  app.use(express.json());
  
  // モックデータ
  const mockUsers = {
    1: { id: 1, userid: 'user1', nickname: 'User One', email: 'user1@test.com' },
    2: { id: 2, userid: 'user2', nickname: 'User Two', email: 'user2@test.com' },
    3: { id: 3, userid: 'user3', nickname: 'User Three', email: 'user3@test.com' }
  };
  
  const mockFriendRequests = [];
  const mockFriendships = [];
  
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
  
  // フレンド申請送信
  app.post('/api/friends/request', mockAuth, (req, res) => {
    const { userid } = req.body;
    
    if (!userid) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名は必須です'
      });
    }
    
    // 対象ユーザーを検索
    const targetUser = Object.values(mockUsers).find(u => u.userid === userid);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // 自分自身に申請することを防ぐ
    if (targetUser.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '自分自身にフレンド申請はできません'
      });
    }
    
    // 既存の申請をチェック
    const existingRequest = mockFriendRequests.find(fr => 
      (fr.sender_id === req.user.id && fr.receiver_id === targetUser.id) ||
      (fr.sender_id === targetUser.id && fr.receiver_id === req.user.id)
    );
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: '既にフレンド申請が存在します'
      });
    }
    
    // 既にフレンドかチェック
    const existingFriendship = mockFriendships.find(f => 
      (f.user1_id === req.user.id && f.user2_id === targetUser.id) ||
      (f.user1_id === targetUser.id && f.user2_id === req.user.id)
    );
    
    if (existingFriendship) {
      return res.status(400).json({
        success: false,
        message: '既にフレンドです'
      });
    }
    
    // 申請を作成
    const newRequest = {
      id: mockFriendRequests.length + 1,
      sender_id: req.user.id,
      receiver_id: targetUser.id,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    mockFriendRequests.push(newRequest);
    
    res.status(201).json({
      success: true,
      message: 'フレンド申請を送信しました',
      request: newRequest
    });
  });
  
  // フレンド申請一覧取得
  app.get('/api/friends/requests', mockAuth, (req, res) => {
    const incoming = mockFriendRequests
      .filter(fr => fr.receiver_id === req.user.id && fr.status === 'pending')
      .map(fr => ({
        ...fr,
        sender: mockUsers[fr.sender_id]
      }));
      
    const outgoing = mockFriendRequests
      .filter(fr => fr.sender_id === req.user.id && fr.status === 'pending')
      .map(fr => ({
        ...fr,
        receiver: mockUsers[fr.receiver_id]
      }));
    
    res.status(200).json({
      success: true,
      requests: {
        incoming,
        outgoing
      }
    });
  });
  
  // フレンド申請承認
  app.post('/api/friends/request/:id/accept', mockAuth, (req, res) => {
    const requestId = parseInt(req.params.id);
    const friendRequest = mockFriendRequests.find(fr => 
      fr.id === requestId && fr.receiver_id === req.user.id && fr.status === 'pending'
    );
    
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'フレンド申請が見つかりません'
      });
    }
    
    // 申請を承認済みに変更
    friendRequest.status = 'accepted';
    
    // フレンドシップを作成
    const newFriendship = {
      id: mockFriendships.length + 1,
      user1_id: friendRequest.sender_id,
      user2_id: friendRequest.receiver_id,
      created_at: new Date().toISOString()
    };
    mockFriendships.push(newFriendship);
    
    res.status(200).json({
      success: true,
      message: 'フレンド申請を承認しました',
      friendship: newFriendship
    });
  });
  
  // フレンド申請拒否
  app.post('/api/friends/request/:id/reject', mockAuth, (req, res) => {
    const requestId = parseInt(req.params.id);
    const friendRequest = mockFriendRequests.find(fr => 
      fr.id === requestId && fr.receiver_id === req.user.id && fr.status === 'pending'
    );
    
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'フレンド申請が見つかりません'
      });
    }
    
    friendRequest.status = 'rejected';
    
    res.status(200).json({
      success: true,
      message: 'フレンド申請を拒否しました'
    });
  });
  
  // フレンド一覧取得
  app.get('/api/friends', mockAuth, (req, res) => {
    const friends = mockFriendships
      .filter(f => f.user1_id === req.user.id || f.user2_id === req.user.id)
      .map(f => {
        const friendId = f.user1_id === req.user.id ? f.user2_id : f.user1_id;
        return {
          ...f,
          friend: mockUsers[friendId]
        };
      });
    
    res.status(200).json({
      success: true,
      friends: friends.map(f => f.friend)
    });
  });
  
  return app;
}

describe('フレンド機能 基本テスト', () => {
  let app;

  beforeAll(() => {
    app = createFriendsTestApp();
  });

  describe('POST /api/friends/request - フレンド申請送信', () => {
    test('正常なフレンド申請', async () => {
      const response = await request(app)
        .post('/api/friends/request')
        .set('Authorization', 'Bearer user1-token')
        .send({ userid: 'user2' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('フレンド申請を送信');
      expect(response.body.request).toBeDefined();
    });

    test('存在しないユーザーへの申請', async () => {
      const response = await request(app)
        .post('/api/friends/request')
        .set('Authorization', 'Bearer user1-token')
        .send({ userid: 'nonexistentuser' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ユーザーが見つかりません');
    });

    test('自分自身への申請（エラー）', async () => {
      const response = await request(app)
        .post('/api/friends/request')
        .set('Authorization', 'Bearer user1-token')
        .send({ userid: 'user1' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('自分自身に');
    });

    test('ユーザー名未指定', async () => {
      const response = await request(app)
        .post('/api/friends/request')
        .set('Authorization', 'Bearer user1-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ユーザー名は必須');
    });

    test('認証なしでの申請', async () => {
      const response = await request(app)
        .post('/api/friends/request')
        .send({ userid: 'user2' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/friends/requests - フレンド申請一覧', () => {
    test('申請一覧の取得', async () => {
      // まずuser3からuser2への申請を作成
      await request(app)
        .post('/api/friends/request')
        .set('Authorization', 'Bearer user3-token')
        .send({ userid: 'user2' });

      // user2が申請一覧を取得
      const response = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', 'Bearer user2-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.requests).toBeDefined();
      expect(response.body.requests.incoming).toHaveLength(2); // user1とuser3からの申請
      expect(response.body.requests.outgoing).toHaveLength(0);
    });

    test('認証なしでの申請一覧取得', async () => {
      const response = await request(app)
        .get('/api/friends/requests');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/friends/request/:id/accept - フレンド申請承認', () => {
    test('申請の承認', async () => {
      const response = await request(app)
        .post('/api/friends/request/1/accept')
        .set('Authorization', 'Bearer user2-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('承認しました');
      expect(response.body.friendship).toBeDefined();
    });

    test('存在しない申請の承認', async () => {
      const response = await request(app)
        .post('/api/friends/request/999/accept')
        .set('Authorization', 'Bearer user2-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/friends/request/:id/reject - フレンド申請拒否', () => {
    test('申請の拒否', async () => {
      const response = await request(app)
        .post('/api/friends/request/2/reject')
        .set('Authorization', 'Bearer user2-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('拒否しました');
    });
  });

  describe('GET /api/friends - フレンド一覧', () => {
    test('フレンド一覧の取得', async () => {
      const response = await request(app)
        .get('/api/friends')
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.friends).toBeDefined();
      expect(response.body.friends).toHaveLength(1); // user2とフレンド
      expect(response.body.friends[0].userid).toBe('user2');
    });

    test('認証なしでのフレンド一覧取得', async () => {
      const response = await request(app)
        .get('/api/friends');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
