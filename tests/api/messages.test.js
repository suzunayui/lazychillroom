// メッセージAPI テスト
const request = require('supertest');
const express = require('express');
const TestHelper = require('../helpers/TestHelper');

// テスト用アプリを作成
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // 認証ミドルウェアを追加
  app.use('/api/messages', require('../../backend/middleware/auth').authenticateToken);
  app.use('/api/messages', require('../../backend/routes/messages'));
  
  return app;
}

describe('メッセージAPI テスト', () => {
  let app;
  let testHelper;
  let testUser;
  let testGuild;
  let testChannel;

  beforeAll(async () => {
    app = createTestApp();
    testHelper = new TestHelper();
  });

  beforeEach(async () => {
    // テストデータをセットアップ
    testUser = await testHelper.createTestUser();
    testGuild = await testHelper.createTestGuild(testUser.id);
    testChannel = await testHelper.createTestChannel(testGuild.id);
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('GET /api/messages', () => {
    test('チャンネルのメッセージ取得', async () => {
      // テストメッセージを作成
      await testHelper.createTestMessage(testChannel.id, testUser.id, 'Hello World!');
      await testHelper.createTestMessage(testChannel.id, testUser.id, 'Second message');

      const authRequest = testHelper.authenticatedRequest(app, testUser);
      const response = await authRequest
        .get('/api/messages')
        .query({ channel_id: testChannel.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0].content).toBe('Hello World!');
    });

    test('存在しないチャンネルのメッセージ取得', async () => {
      const authRequest = testHelper.authenticatedRequest(app, testUser);
      const response = await authRequest
        .get('/api/messages')
        .query({ channel_id: 99999 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('認証なしでのメッセージ取得失敗', async () => {
      const response = await request(app)
        .get('/api/messages')
        .query({ channel_id: testChannel.id });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/messages', () => {
    test('メッセージ送信成功', async () => {
      const messageData = {
        channel_id: testChannel.id,
        content: 'New test message'
      };

      const authRequest = testHelper.authenticatedRequest(app, testUser);
      const response = await authRequest
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message.content).toBe(messageData.content);
      expect(response.body.message.user_id).toBe(testUser.id);
    });

    test('空のメッセージ送信失敗', async () => {
      const messageData = {
        channel_id: testChannel.id,
        content: ''
      };

      const authRequest = testHelper.authenticatedRequest(app, testUser);
      const response = await authRequest
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('長すぎるメッセージ送信失敗', async () => {
      const messageData = {
        channel_id: testChannel.id,
        content: 'a'.repeat(2001) // 制限を超える長さ
      };

      const authRequest = testHelper.authenticatedRequest(app, testUser);
      const response = await authRequest
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/messages/:id', () => {
    test('自分のメッセージ削除成功', async () => {
      const message = await testHelper.createTestMessage(
        testChannel.id, 
        testUser.id, 
        'Message to delete'
      );

      const authRequest = testHelper.authenticatedRequest(app, testUser);
      const response = await authRequest
        .delete(`/api/messages/${message.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('他人のメッセージ削除失敗', async () => {
      const otherUser = await testHelper.createTestUser();
      const message = await testHelper.createTestMessage(
        testChannel.id, 
        otherUser.id, 
        'Other user message'
      );

      const authRequest = testHelper.authenticatedRequest(app, testUser);
      const response = await authRequest
        .delete(`/api/messages/${message.id}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('存在しないメッセージ削除失敗', async () => {
      const authRequest = testHelper.authenticatedRequest(app, testUser);
      const response = await authRequest
        .delete('/api/messages/99999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
