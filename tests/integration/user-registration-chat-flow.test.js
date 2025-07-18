// 統合テスト - 新規ユーザー登録からチャット画面表示までのフロー
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const TestHelper = require('../helpers/TestHelper');

// テスト環境設定を確実に読み込み
require('dotenv').config({ path: path.join(__dirname, '../setup/test.env') });

// 完全なテスト用アプリを作成（静的ファイル配信含む）
function createFullTestApp() {
  const app = express();
  
  // ミドルウェア設定
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // 静的ファイル配信（フロントエンド）
  app.use(express.static(path.join(__dirname, '../../frontend')));
  
  // APIルート設定
  app.use('/api/auth', require('../../backend/routes/auth'));
  app.use('/api/guilds', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/guilds'));
  app.use('/api/channels', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/channels'));
  app.use('/api/messages', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/messages'));
  app.use('/api/friends', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/friends'));
  app.use('/api/dm', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/dm'));
  app.use('/api/users', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/users'));
  
  // メインページ（チャット画面）のルート
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  });
  
  return app;
}

describe('統合テスト - ユーザー登録〜チャット画面表示フロー', () => {
  let app;
  let testHelper;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // 環境変数を確認
    console.log('Test JWT_SECRET:', process.env.JWT_SECRET);
    
    app = createFullTestApp();
    testHelper = new TestHelper();
  });

  afterAll(async () => {
    // テストデータのクリーンアップ
    if (testHelper) {
      await testHelper.cleanup();
    }
  });

  describe('1. 新規ユーザー登録フロー', () => {
    it('新しいユーザーを登録できること', async () => {
      const userData = {
        userid: `newuser_${Date.now()}`,
        password: 'securepassword123',
        nickname: 'New Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.userid).toBe(userData.userid);
      expect(response.body.user.nickname).toBe(userData.nickname);

      // テスト用に保存
      testUser = userData;
      authToken = response.body.token;
    });

    it('登録したユーザーでログインできること', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          userid: testUser.userid,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.userid).toBe(testUser.userid);
      
      // 新しいトークンを更新
      authToken = response.body.token;
    });
  });

  describe('2. 認証状態確認', () => {
    it('有効なトークンで認証を検証できること', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.userid).toBe(testUser.userid);
    });
  });

  describe('3. 初期データの取得', () => {
    it('ユーザーのギルド一覧を取得できること', async () => {
      const response = await request(app)
        .get('/api/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // 新規ユーザーは最初に「LazyChillRoom 公式」サーバーに参加している
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('デフォルトギルドのチャンネル一覧を取得できること', async () => {
      // まずギルド一覧を取得
      const guildsResponse = await request(app)
        .get('/api/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(guildsResponse.body.length).toBeGreaterThan(0);
      const defaultGuild = guildsResponse.body[0];

      // そのギルドのチャンネル一覧を取得
      const channelsResponse = await request(app)
        .get(`/api/channels?guild_id=${defaultGuild.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(channelsResponse.body)).toBe(true);
      expect(channelsResponse.body.length).toBeGreaterThan(0);
    });
  });

  describe('4. チャット画面表示確認', () => {
    it('メインページ（チャット画面）にアクセスできること', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<html');
      expect(response.text).toContain('</html>');
    });

    it('index.htmlに必要な要素が含まれていること', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const html = response.text;
      
      // 基本的なHTML構造
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      
      // チャット画面の主要要素が含まれているか確認
      expect(html).toContain('LazyChillRoom'); // アプリケーション名
      
      // JavaScript/CSSファイルの読み込み
      expect(html).toMatch(/<script.*src.*\.js/i);
      expect(html).toMatch(/<link.*href.*\.css/i);
    });

    it('静的ファイル（CSS）にアクセスできること', async () => {
      // CSSファイルの存在確認
      const cssPath = path.join(__dirname, '../../frontend/css');
      const cssFiles = fs.readdirSync(cssPath).filter(file => file.endsWith('.css'));
      
      expect(cssFiles.length).toBeGreaterThan(0);
      
      // 最初のCSSファイルにアクセス
      const response = await request(app)
        .get(`/css/${cssFiles[0]}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/css/);
    });

    it('静的ファイル（JavaScript）にアクセスできること', async () => {
      // JavaScriptファイルの存在確認
      const jsPath = path.join(__dirname, '../../frontend/js');
      const jsFiles = fs.readdirSync(jsPath).filter(file => file.endsWith('.js'));
      
      expect(jsFiles.length).toBeGreaterThan(0);
      
      // 最初のJSファイルにアクセス
      const response = await request(app)
        .get(`/js/${jsFiles[0]}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/javascript|text\/javascript/);
    });
  });

  describe('5. チャット機能の基本動作確認', () => {
    let defaultGuildId;
    let defaultChannelId;

    beforeAll(async () => {
      // デフォルトギルドとチャンネルのIDを取得
      const guildsResponse = await request(app)
        .get('/api/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      defaultGuildId = guildsResponse.body[0].id;

      const channelsResponse = await request(app)
        .get(`/api/channels?guild_id=${defaultGuildId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      defaultChannelId = channelsResponse.body[0].id;
    });

    it('チャンネルのメッセージ履歴を取得できること', async () => {
      const response = await request(app)
        .get(`/api/messages?channel_id=${defaultChannelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // 新しいチャンネルなのでメッセージは空の場合もある
    });

    it('新しいメッセージを送信できること', async () => {
      const messageData = {
        channel_id: defaultChannelId,
        content: 'Hello, this is a test message from integration test!'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(messageData.content);
      expect(response.body.channel_id).toBe(defaultChannelId);
    });

    it('送信したメッセージが履歴に反映されること', async () => {
      const response = await request(app)
        .get(`/api/messages?channel_id=${defaultChannelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // 最新のメッセージが我々が送信したものか確認
      const latestMessage = response.body[response.body.length - 1];
      expect(latestMessage.content).toBe('Hello, this is a test message from integration test!');
    });
  });

  describe('6. セッション永続化テスト（リロード後の状態確認）', () => {
    it('再度ログインせずに認証状態を維持できること', async () => {
      // 既存のトークンで再度認証確認
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.userid).toBe(testUser.userid);
    });

    it('リロード後もチャット画面にアクセスできること', async () => {
      // メインページに再度アクセス（リロードのシミュレーション）
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<html');
    });

    it('リロード後もAPIアクセスが正常に動作すること', async () => {
      // ギルド一覧を再取得
      const guildsResponse = await request(app)
        .get('/api/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(guildsResponse.body)).toBe(true);
      expect(guildsResponse.body.length).toBeGreaterThan(0);

      // チャンネル一覧を再取得
      const defaultGuildId = guildsResponse.body[0].id;
      const channelsResponse = await request(app)
        .get(`/api/channels?guild_id=${defaultGuildId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(channelsResponse.body)).toBe(true);
      expect(channelsResponse.body.length).toBeGreaterThan(0);
    });
  });

  describe('7. エラーハンドリング確認', () => {
    it('無効なトークンでAPIアクセスした場合のエラーレスポンス', async () => {
      const response = await request(app)
        .get('/api/guilds')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('トークンなしでAPIアクセスした場合のエラーレスポンス', async () => {
      const response = await request(app)
        .get('/api/guilds')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});
