// フレンドAPI テスト
const request = require('supertest');
const express = require('express');
const TestHelper = require('../helpers/TestHelper');

// テスト用アプリを作成
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // 認証ミドルウェアを追加
  app.use('/api/friends', require('../../backend/middleware/auth').authenticateToken);
  app.use('/api/friends', require('../../backend/routes/friends'));
  
  return app;
}

describe('フレンドAPI テスト', () => {
  let app;
  let testHelper;
  let user1;
  let user2;

  beforeAll(async () => {
    app = createTestApp();
    testHelper = new TestHelper();
  });

  beforeEach(async () => {
    user1 = await testHelper.createTestUser();
    user2 = await testHelper.createTestUser();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('GET /api/friends', () => {
    test('フレンドリスト取得（空の場合）', async () => {
      const authRequest = testHelper.authenticatedRequest(app, user1);
      const response = await authRequest.get('/api/friends');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.friends).toHaveLength(0);
    });

    test('フレンドリスト取得（フレンドがいる場合）', async () => {
      // フレンド関係を作成
      await testHelper.createFriendship(user1.id, user2.id);

      const authRequest = testHelper.authenticatedRequest(app, user1);
      const response = await authRequest.get('/api/friends');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.friends).toHaveLength(1);
      expect(response.body.friends[0].friend_id).toBe(user2.id);
    });
  });

  describe('POST /api/friends/request', () => {
    test('フレンド申請送信成功', async () => {
      const authRequest = testHelper.authenticatedRequest(app, user1);
      const response = await authRequest
        .post('/api/friends/request')
        .send({ userid: user2.userid });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('申請');
    });

    test('存在しないユーザーへの申請失敗', async () => {
      const authRequest = testHelper.authenticatedRequest(app, user1);
      const response = await authRequest
        .post('/api/friends/request')
        .send({ userid: 'nonexistentuser' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('自分自身への申請失敗', async () => {
      const authRequest = testHelper.authenticatedRequest(app, user1);
      const response = await authRequest
        .post('/api/friends/request')
        .send({ userid: user1.userid });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/friends/requests', () => {
    test('フレンド申請リスト取得', async () => {
      // user1からuser2への申請を作成
      const { query } = require('../../backend/config/database');
      await query(`
        INSERT INTO friend_requests (sender_id, receiver_id, status)
        VALUES ($1, $2, 'pending')
      `, [user1.id, user2.id]);

      const authRequest = testHelper.authenticatedRequest(app, user2);
      const response = await authRequest.get('/api/friends/requests');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.requests.incoming).toHaveLength(1);
      expect(response.body.requests.incoming[0].userid).toBe(user1.userid);
    });
  });

  describe('POST /api/friends/request/:id/accept', () => {
    test('フレンド申請承認成功', async () => {
      const { query } = require('../../backend/config/database');
      
      // user1からuser2への申請を作成
      const result = await query(`
        INSERT INTO friend_requests (sender_id, receiver_id, status)
        VALUES ($1, $2, 'pending') RETURNING id
      `, [user1.id, user2.id]);

      const requestId = result[0].id;

      const authRequest = testHelper.authenticatedRequest(app, user2);
      const response = await authRequest
        .post(`/api/friends/request/${requestId}/accept`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/friends/request/:id/reject', () => {
    test('フレンド申請拒否成功', async () => {
      const { query } = require('../../backend/config/database');
      
      // user1からuser2への申請を作成
      const result = await query(`
        INSERT INTO friend_requests (sender_id, receiver_id, status)
        VALUES ($1, $2, 'pending') RETURNING id
      `, [user1.id, user2.id]);

      const requestId = result[0].id;

      const authRequest = testHelper.authenticatedRequest(app, user2);
      const response = await authRequest
        .post(`/api/friends/request/${requestId}/reject`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/friends/:id', () => {
    test('フレンド削除成功', async () => {
      // フレンド関係を作成
      await testHelper.createFriendship(user1.id, user2.id);

      const authRequest = testHelper.authenticatedRequest(app, user1);
      const response = await authRequest
        .delete(`/api/friends/${user2.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('存在しないフレンド削除失敗', async () => {
      const authRequest = testHelper.authenticatedRequest(app, user1);
      const response = await authRequest
        .delete(`/api/friends/99999`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
