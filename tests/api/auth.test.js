// 認証API テスト
const request = require('supertest');
const express = require('express');
const TestHelper = require('../helpers/TestHelper');

// テスト用アプリを作成
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../../backend/routes/auth'));
  return app;
}

describe('認証API テスト', () => {
  let app;
  let testHelper;

  beforeAll(async () => {
    app = createTestApp();
    testHelper = new TestHelper();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('POST /api/auth/register', () => {
    test('正常なユーザー登録', async () => {
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
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.userid).toBe(userData.userid);
    });

    test('無効なデータでの登録失敗', async () => {
      const invalidData = {
        userid: 'ab', // 短すぎる
        password: '123' // 短すぎる
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('重複ユーザーIDでの登録失敗', async () => {
      // 最初のユーザーを作成
      const firstUser = await testHelper.createTestUser({
        userid: 'existinguser'
      });

      // 同じユーザーIDで登録を試行
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          userid: 'existinguser',
          password: 'password123',
          nickname: 'Different User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('既に存在');
    });
  });

  describe('POST /api/auth/login', () => {
    test('正常なログイン', async () => {
      const user = await testHelper.createTestUser();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userid: user.userid,
          password: user.password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.userid).toBe(user.userid);
    });

    test('間違ったパスワードでのログイン失敗', async () => {
      const user = await testHelper.createTestUser();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userid: user.userid,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('存在しないユーザーでのログイン失敗', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userid: 'nonexistentuser',
          password: 'anypassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/verify', () => {
    test('有効なトークンでの検証成功', async () => {
      const user = await testHelper.createTestUser();
      const token = testHelper.generateToken(user);

      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe(user.id);
    });

    test('無効なトークンでの検証失敗', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('トークンなしでの検証失敗', async () => {
      const response = await request(app)
        .get('/api/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
