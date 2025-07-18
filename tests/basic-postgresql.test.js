// PostgreSQL + Redis 基本テスト
const request = require('supertest');
const express = require('express');

// テスト用PostgreSQL + Redis アプリ（モック）
function createPostgreSQLTestApp() {
  const app = express();
  app.use(express.json());
  
  // モックデータ（PostgreSQLスタイル）
  const mockUsers = {
    1: { 
      id: 1, 
      userid: 'user1', 
      nickname: 'User One', 
      password_hash: '$2b$12$mockhashedpassword',
      is_admin: false,
      status: 'online',
      created_at: new Date().toISOString()
    },
    2: { 
      id: 2, 
      userid: 'user2', 
      nickname: 'User Two', 
      password_hash: '$2b$12$mockhashedpassword',
      is_admin: false,
      status: 'offline',
      created_at: new Date().toISOString()
    }
  };
  
  const mockSessions = {}; // Redis sessions
  const mockPresence = {}; // Redis presence data
  
  // 認証ミドルウェア（モック）
  const mockAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'トークンがありません' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 特定のトークンを最初にチェック
    if (token === 'user1-token') req.user = mockUsers[1];
    else if (token === 'user2-token') req.user = mockUsers[2];
    else {
      // 動的にユーザーを探す
      const user = Object.values(mockUsers).find(user => {
        const expectedToken = `user${user.id}-token`;
        return token === expectedToken;
      });
      
      if (user) {
        req.user = user;
      } else {
        return res.status(401).json({ success: false, message: '無効なトークンです' });
      }
    }
    next();
  };
  
  // PostgreSQL風ユーザー登録
  app.post('/api/auth/register', (req, res) => {
    const { userId, nickname, password } = req.body;
    
    // バリデーション
    if (!userId || !nickname || !password) {
      return res.status(400).json({
        success: false,
        message: '必須フィールドが不足しています'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'パスワードは6文字以上で入力してください'
      });
    }
    
    // 重複チェック
    const existingUser = Object.values(mockUsers).find(u => 
      u.userid === userId
    );
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'このユーザーIDは既に使用されています'
      });
    }
    
    // 新規ユーザー作成
    const newId = Object.keys(mockUsers).length + 1;
    const newUser = {
      id: newId,
      userid: userId,
      nickname,
      password_hash: '$2b$12$mockhashedpassword',
      is_admin: newId === 1, // 最初のユーザーは管理者
      status: 'online',
      created_at: new Date().toISOString()
    };
    
    mockUsers[newId] = newUser;
    
    // Redis セッション（モック）
    mockSessions[`session:user:${newId}`] = JSON.stringify({
      id: newId,
      userid: userId,
      nickname,
      status: 'online'
    });
    
    // Redis プレゼンス（モック）
    mockPresence[`presence:user:${newId}`] = JSON.stringify({
      status: 'online',
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    res.status(201).json({
      success: true,
      message: 'ユーザー登録が完了しました',
      user: {
        id: newUser.id,
        userid: newUser.userid,
        nickname: newUser.nickname,
        is_admin: newUser.is_admin,
        status: newUser.status
      },
      token: `user${newId}-token`
    });
  });
  
  // ログイン
  app.post('/api/auth/login', (req, res) => {
    const { userId, password } = req.body;
    
    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDとパスワードは必須です'
      });
    }
    
    const user = Object.values(mockUsers).find(u => u.userid === userId);
    
    if (!user || password !== 'password123') {
      return res.status(401).json({
        success: false,
        message: 'ユーザーIDまたはパスワードが間違っています'
      });
    }
    
    // セッション更新
    mockSessions[`session:user:${user.id}`] = JSON.stringify({
      id: user.id,
      userid: user.userid,
      nickname: user.nickname,
      status: 'online'
    });
    
    // プレゼンス更新
    mockPresence[`presence:user:${user.id}`] = JSON.stringify({
      status: 'online',
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'ログインしました',
      user: {
        id: user.id,
        userid: user.userid,
        nickname: user.nickname,
        is_admin: user.is_admin,
        status: 'online'
      },
      token: `user${user.id}-token`
    });
  });
  
  // プロフィール取得
  app.get('/api/auth/profile', mockAuth, (req, res) => {
    const user = req.user;
    
    res.json({
      success: true,
      user: {
        id: user.id,
        userid: user.userid,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        status: user.status,
        is_admin: user.is_admin,
        created_at: user.created_at,
        guild_count: 1,
        friend_count: 0
      }
    });
  });
  
  // プロフィール更新
  app.put('/api/auth/profile', mockAuth, (req, res) => {
    const { nickname, status } = req.body;
    const user = mockUsers[req.user.id];
    
    if (nickname) user.nickname = nickname;
    if (email) user.email = email;
    if (status) user.status = status;
    
    // セッション更新
    mockSessions[`session:user:${user.id}`] = JSON.stringify({
      id: user.id,
      userid: user.userid,
      nickname: user.nickname,
      status: user.status
    });
    
    // プレゼンス更新
    if (status) {
      mockPresence[`presence:user:${user.id}`] = JSON.stringify({
        status: status,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'プロフィールを更新しました',
      user: {
        id: user.id,
        userid: user.userid,
        email: user.email,
        nickname: user.nickname,
        status: user.status,
        avatar_url: user.avatar_url
      }
    });
  });
  
  // Redis プレゼンス取得API（テスト用）
  app.get('/api/presence/users', mockAuth, (req, res) => {
    const { userIds } = req.query;
    const ids = userIds ? userIds.split(',').map(id => parseInt(id)) : [];
    
    const presence = {};
    ids.forEach(id => {
      const key = `presence:user:${id}`;
      if (mockPresence[key]) {
        presence[id] = JSON.parse(mockPresence[key]);
      } else {
        presence[id] = null;
      }
    });
    
    res.json({
      success: true,
      presence
    });
  });
  
  // Redis セッション取得API（テスト用）
  app.get('/api/session/user/:id', mockAuth, (req, res) => {
    const userId = req.params.id;
    const key = `session:user:${userId}`;
    
    if (mockSessions[key]) {
      res.json({
        success: true,
        session: JSON.parse(mockSessions[key])
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'セッションが見つかりません'
      });
    }
  });
  
  return app;
}

describe('PostgreSQL + Redis 基本テスト', () => {
  let app;

  beforeAll(() => {
    app = createPostgreSQLTestApp();
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

  describe('ユーザー認証 (PostgreSQL)', () => {
    test('正常な新規登録', async () => {
      const userData = {
        userId: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.userid).toBe(userData.userId);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.nickname).toBe(userData.nickname);
      expect(response.body.token).toBeDefined();
    });

    test('重複ユーザー名での登録エラー', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          userId: 'user1',
          email: 'different@example.com',
          nickname: 'Different User',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('既に使用されています');
    });

    test('重複メールアドレスでの登録エラー', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          userId: 'differentuser',
          email: 'user1@test.com',
          nickname: 'Different User',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('既に使用されています');
    });

    test('正常なログイン', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userId: 'user1',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.userid).toBe('user1');
      expect(response.body.user.status).toBe('online');
      expect(response.body.token).toBeDefined();
    });

    test('間違ったパスワードでのログインエラー', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userId: 'user1',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('プロフィール管理', () => {
    test('プロフィール取得', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.userid).toBe('user1');
      expect(response.body.user.guild_count).toBeDefined();
      expect(response.body.user.friend_count).toBeDefined();
    });

    test('プロフィール更新', async () => {
      const updateData = {
        nickname: 'Updated User One',
        status: 'away'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer user1-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.nickname).toBe('Updated User One');
      expect(response.body.user.status).toBe('away');
    });
  });

  describe('Redis セッション管理', () => {
    test('ユーザーセッション取得', async () => {
      const response = await request(app)
        .get('/api/session/user/1')
        .set('Authorization', 'Bearer user1-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.session.id).toBe(1);
      expect(response.body.session.userid).toBe('user1');
    });
  });

  describe('Redis プレゼンス管理', () => {
    test('複数ユーザーのプレゼンス取得', async () => {
      const response = await request(app)
        .get('/api/presence/users')
        .set('Authorization', 'Bearer user1-token')
        .query({ userIds: '1,2' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.presence['1']).toBeDefined();
      expect(response.body.presence['2']).toBeNull(); // user2はオフライン
    });

    test('ステータス変更後のプレゼンス確認', async () => {
      // ステータス変更
      await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer user1-token')
        .send({ status: 'busy' });

      // プレゼンス確認
      const response = await request(app)
        .get('/api/presence/users')
        .set('Authorization', 'Bearer user1-token')
        .query({ userIds: '1' });

      expect(response.status).toBe(200);
      expect(response.body.presence['1'].status).toBe('busy');
    });
  });

  describe('統合シナリオ', () => {
    test('登録 → ログイン → プロフィール更新 → セッション確認', async () => {
      // 1. 新規登録
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          userId: 'integrationuser',
          email: 'integration@test.com',
          nickname: 'Integration User',
          password: 'password123'
        });

      expect(registerResponse.status).toBe(201);
      const token = registerResponse.body.token;
      const userId = registerResponse.body.user.id;

      // 2. プロフィール更新
      const updateResponse = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nickname: 'Updated Integration User',
          status: 'away'
        });

      expect(updateResponse.status).toBe(200);

      // 3. セッション確認
      const sessionResponse = await request(app)
        .get(`/api/session/user/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.session.nickname).toBe('Updated Integration User');
      expect(sessionResponse.body.session.status).toBe('away');

      // 4. プレゼンス確認
      const presenceResponse = await request(app)
        .get('/api/presence/users')
        .set('Authorization', `Bearer ${token}`)
        .query({ userIds: userId.toString() });

      expect(presenceResponse.status).toBe(200);
      expect(presenceResponse.body.presence[userId].status).toBe('away');
    });
  });
});
