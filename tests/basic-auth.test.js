// 認証ルートの基本テスト（データベース接続無し）
const request = require('supertest');
const express = require('express');

// データベースを使わないテスト用認証ルート
function createAuthTestApp() {
  const app = express();
  app.use(express.json());
  
  // テスト用認証ルート
  app.post('/api/auth/register', (req, res) => {
    const { userid, password, nickname } = req.body;
    
    // バリデーションテスト
    if (!userid || !password) {
      return res.status(400).json({
        success: false,
        message: '必須フィールドが不足しています'
      });
    }
    
    if (userid === 'existing_user') {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDが既に使用されています'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'パスワードは6文字以上である必要があります'
      });
    }
    
    // 成功レスポンス
    res.status(201).json({
      success: true,
      message: '登録が完了しました',
      user: {
        id: 1,
        userid,
        email,
        nickname: nickname || userid
      },
      token: 'mock-jwt-token-for-testing'
    });
  });
  
  app.post('/api/auth/login', (req, res) => {
    const { userid, password } = req.body;
    
    // バリデーションテスト
    if (!userid || !password) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名とパスワードは必須です'
      });
    }
    
    // テスト用ユーザー
    if (userid === 'testuser' && password === 'password123') {
      return res.status(200).json({
        success: true,
        message: 'ログインしました',
        user: {
          id: 1,
          userid: 'testuser',
          nickname: 'Test User'
        },
        token: 'mock-jwt-token-for-testing'
      });
    }
    
    // ログイン失敗
    res.status(401).json({
      success: false,
      message: 'ユーザー名またはパスワードが間違っています'
    });
  });
  
  app.get('/api/auth/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'トークンがありません'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (token === 'mock-jwt-token-for-testing') {
      return res.status(200).json({
        success: true,
        user: {
          id: 1,
          userid: 'testuser',
          email: 'test@example.com',
          nickname: 'Test User'
        }
      });
    }
    
    res.status(401).json({
      success: false,
      message: '無効なトークンです'
    });
  });
  
  return app;
}

describe('認証API 基本テスト', () => {
  let app;

  beforeAll(() => {
    app = createAuthTestApp();
  });

  describe('POST /api/auth/register', () => {
    test('正常な登録', async () => {
      const userData = {
        userid: 'newuser',
        password: 'password123',
        nickname: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.userid).toBe(userData.userid);
      expect(response.body.user.nickname).toBe(userData.nickname);
      expect(response.body.token).toBeDefined();
    });

    test('必須フィールド不足', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          userid: 'testuser'
          // password が不足
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('必須フィールド');
    });

    test('重複ユーザー名', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          userid: 'existing_user',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('既に使用');
    });

    test('パスワードが短すぎる', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          userid: 'testuser',
          password: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('6文字以上');
    });
  });

  describe('POST /api/auth/login', () => {
    test('正常なログイン', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userid: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.userid).toBe('testuser');
      expect(response.body.token).toBeDefined();
    });

    test('間違ったパスワード', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userid: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('存在しないユーザー', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userid: 'nonexistentuser',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('必須フィールド不足', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userid: 'testuser'
          // password が不足
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/verify', () => {
    test('有効なトークン', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer mock-jwt-token-for-testing');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
    });

    test('無効なトークン', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('トークンなし', async () => {
      const response = await request(app)
        .get('/api/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
