// 統合テスト - チャット機能の全体的なフロー
const request = require('supertest');
const express = require('express');
const TestHelper = require('../helpers/TestHelper');

// 完全なテスト用アプリを作成
function createFullTestApp() {
  const app = express();
  app.use(express.json());
  
  // 全ルートを設定
  app.use('/api/auth', require('../../backend/routes/auth'));
  app.use('/api/guilds', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/guilds'));
  app.use('/api/channels', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/channels'));
  app.use('/api/messages', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/messages'));
  app.use('/api/friends', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/friends'));
  app.use('/api/dm', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/dm'));
  
  return app;
}

describe('統合テスト - チャット機能フロー', () => {
  let app;
  let testHelper;

  beforeAll(async () => {
    app = createFullTestApp();
    testHelper = new TestHelper();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('完全なユーザーワークフロー', () => {
    test('ユーザー登録 → ログイン → ギルド作成 → チャンネル作成 → メッセージ送信', async () => {
      // 1. ユーザー登録
      const userData = {
        userid: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        nickname: 'Test User'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      
      const token = registerResponse.body.token;
      const user = registerResponse.body.user;

      // 2. トークンでの認証確認
      const verifyResponse = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.user.id).toBe(user.id);

      // 3. ギルド作成
      const guildData = {
        name: 'Test Guild',
        description: 'A test guild'
      };

      const guildResponse = await request(app)
        .post('/api/guilds')
        .set('Authorization', `Bearer ${token}`)
        .send(guildData);

      expect(guildResponse.status).toBe(201);
      expect(guildResponse.body.success).toBe(true);
      
      const guild = guildResponse.body.guild;

      // 4. チャンネル作成
      const channelData = {
        guild_id: guild.id,
        name: 'general',
        type: 'text',
        topic: 'General discussion'
      };

      const channelResponse = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${token}`)
        .send(channelData);

      expect(channelResponse.status).toBe(201);
      expect(channelResponse.body.success).toBe(true);
      
      const channel = channelResponse.body.channel;

      // 5. メッセージ送信
      const messageData = {
        channel_id: channel.id,
        content: 'Hello, world! This is my first message.'
      };

      const messageResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(messageData);

      expect(messageResponse.status).toBe(201);
      expect(messageResponse.body.success).toBe(true);
      expect(messageResponse.body.message.content).toBe(messageData.content);

      // 6. メッセージ取得確認
      const getMessagesResponse = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .query({ channel_id: channel.id });

      expect(getMessagesResponse.status).toBe(200);
      expect(getMessagesResponse.body.messages).toHaveLength(1);
      expect(getMessagesResponse.body.messages[0].content).toBe(messageData.content);
    });

    test('複数ユーザーのフレンド機能フロー', async () => {
      // ユーザー1を作成
      const user1Data = {
        userid: 'user1',
        email: 'user1@example.com',
        password: 'password123',
        nickname: 'User One'
      };

      const user1Response = await request(app)
        .post('/api/auth/register')
        .send(user1Data);

      const user1Token = user1Response.body.token;

      // ユーザー2を作成
      const user2Data = {
        userid: 'user2',
        email: 'user2@example.com',
        password: 'password123',
        nickname: 'User Two'
      };

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send(user2Data);

      const user2Token = user2Response.body.token;

      // 1. User1がUser2にフレンド申請を送信
      const friendRequestResponse = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ userid: user2Data.userid });

      expect(friendRequestResponse.status).toBe(201);

      // 2. User2がフレンド申請リストを確認
      const requestsResponse = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(requestsResponse.status).toBe(200);
      expect(requestsResponse.body.requests.incoming).toHaveLength(1);
      
      const requestId = requestsResponse.body.requests.incoming[0].id;

      // 3. User2がフレンド申請を承認
      const acceptResponse = await request(app)
        .post(`/api/friends/request/${requestId}/accept`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(acceptResponse.status).toBe(200);

      // 4. User1のフレンドリストを確認
      const friendsResponse = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(friendsResponse.status).toBe(200);
      expect(friendsResponse.body.friends).toHaveLength(1);
      expect(friendsResponse.body.friends[0].userid).toBe(user2Data.userid);

      // 5. User2のフレンドリストも確認
      const user2FriendsResponse = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(user2FriendsResponse.status).toBe(200);
      expect(user2FriendsResponse.body.friends).toHaveLength(1);
      expect(user2FriendsResponse.body.friends[0].userid).toBe(user1Data.userid);
    });

    test('DM機能の完全フロー', async () => {
      // 2人のユーザーを作成
      const user1 = await testHelper.createTestUser();
      const user2 = await testHelper.createTestUser();

      // フレンド関係を作成
      await testHelper.createFriendship(user1.id, user2.id);

      // 1. User1がUser2とのDMチャンネルを作成
      const dmResponse = await request(app)
        .post('/api/dm')
        .set('Authorization', `Bearer ${testHelper.generateToken(user1)}`)
        .send({ user_id: user2.id });

      expect(dmResponse.status).toBe(201);
      expect(dmResponse.body.success).toBe(true);
      
      const dmChannel = dmResponse.body.channel;

      // 2. DMチャンネルでメッセージを送信
      const messageResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${testHelper.generateToken(user1)}`)
        .send({
          channel_id: dmChannel.id,
          content: 'Hello in DM!'
        });

      expect(messageResponse.status).toBe(201);

      // 3. User2がDMリストを取得
      const dmListResponse = await request(app)
        .get('/api/dm')
        .set('Authorization', `Bearer ${testHelper.generateToken(user2)}`);

      expect(dmListResponse.status).toBe(200);
      expect(dmListResponse.body.channels).toHaveLength(1);

      // 4. User2がDMメッセージを確認
      const messagesResponse = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${testHelper.generateToken(user2)}`)
        .query({ channel_id: dmChannel.id });

      expect(messagesResponse.status).toBe(200);
      expect(messagesResponse.body.messages).toHaveLength(1);
      expect(messagesResponse.body.messages[0].content).toBe('Hello in DM!');
    });
  });

  describe('エラーケースとセキュリティ', () => {
    test('権限のないリソースへのアクセス制御', async () => {
      const user1 = await testHelper.createTestUser();
      const user2 = await testHelper.createTestUser();
      
      // User1がギルドを作成
      const guild = await testHelper.createTestGuild(user1.id);
      const channel = await testHelper.createTestChannel(guild.id);

      // User2（メンバーではない）がチャンネルにアクセスを試行
      const response = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${testHelper.generateToken(user2)}`)
        .query({ channel_id: channel.id });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('無効なトークンでのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/guilds')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('SQL インジェクション攻撃の防止', async () => {
      const user = await testHelper.createTestUser();
      
      // 悪意のあるペイロードでメッセージ送信を試行
      const maliciousPayload = {
        channel_id: "1; DROP TABLE messages; --",
        content: "Normal message"
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${testHelper.generateToken(user)}`)
        .send(maliciousPayload);

      // 適切にバリデーションエラーになることを確認
      expect(response.status).toBe(400);
    });
  });
});
