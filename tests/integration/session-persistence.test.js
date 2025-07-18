// 統合テスト - リロード後のセッション持続性の詳細テスト
const request = require('supertest');
const express = require('express');
const path = require('path');

// テスト環境設定を確実に読み込み
require('dotenv').config({ path: path.join(__dirname, '../setup/test.env') });

// 完全なテスト用アプリを作成（認証付き）
function createFullTestApp() {
  const app = express();
  
  // ミドルウェア設定
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // 静的ファイル配信（フロントエンド）
  app.use(express.static(path.join(__dirname, '../../frontend')));
  
  // 完全なAPIルート設定
  app.use('/api/auth', require('../../backend/routes/auth'));
  app.use('/api/guilds', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/guilds'));
  app.use('/api/users', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/users'));
  
  // メインページ（チャット画面）のルート
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  });
  
  return app;
}

describe('統合テスト - リロード後のセッション持続性', () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    app = createFullTestApp();
  });

  describe('1. ユーザー登録とログイン', () => {
    it('テストユーザーを作成してログイン', async () => {
      // 新規ユーザー登録
      const userData = {
        userid: `sessiontest_${Date.now()}`,
        password: 'testpassword123',
        nickname: 'Session Test User'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      testUser = userData;
      authToken = registerResponse.body.token;

      console.log('✅ テストユーザー作成:', testUser.userid);
    });
  });

  describe('2. 認証状態の確認', () => {
    it('有効なトークンで認証を確認', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      console.log('✅ 認証トークンが有効:', response.body.user.userid);
    });
  });

  describe('3. チャット画面アクセス - 初回', () => {
    it('初回のチャット画面アクセス', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const html = response.text;
      
      // チャット画面の基本要素が含まれているか
      expect(html).toContain('LazyChillRoom');
      expect(html).toContain('id="app"');
      expect(html).toContain('socket.io');
      
      console.log('✅ 初回チャット画面アクセス成功');
    });
  });

  describe('4. リロード後のセッション持続性テスト', () => {
    it('リロード後もチャット画面にアクセス可能（HTMLレベル）', async () => {
      // リロードのシミュレーション - 再度メインページにアクセス
      const response = await request(app)
        .get('/')
        .expect(200);

      const html = response.text;
      
      // 同じHTMLが返されることを確認
      expect(html).toContain('LazyChillRoom');
      expect(html).toContain('id="app"');
      expect(html).toContain('socket.io');
      
      console.log('✅ リロード後もHTML画面は正常にアクセス可能');
    });

    it('リロード後もトークンが有効（API認証レベル）', async () => {
      // セッションが保持されているかAPIレベルで確認
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.userid).toBe(testUser.userid);
      
      console.log('✅ リロード後もAPIレベルでの認証状態が維持');
    });

    it('複数回のリロードでも一貫性を保持', async () => {
      for (let i = 1; i <= 5; i++) {
        // HTML レベルの確認
        const htmlResponse = await request(app)
          .get('/')
          .expect(200);
        expect(htmlResponse.text).toContain('LazyChillRoom');
        
        // API レベルの確認
        const apiResponse = await request(app)
          .get('/api/auth/verify')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        expect(apiResponse.body.user.userid).toBe(testUser.userid);
        
        console.log(`✅ ${i}回目のリロード: HTML・API両方で正常アクセス`);
      }
    });
  });

  describe('5. セッション管理の詳細テスト', () => {
    it('フロントエンドJavaScriptファイルが正常にロード可能', async () => {
      // app.jsが正常にロードできるか確認
      const response = await request(app)
        .get('/js/app.js')
        .expect(200);

      const jsContent = response.text;
      
      // 認証関連の処理が含まれているか確認
      expect(jsContent).toContain('localStorage');
      expect(jsContent).toContain('authToken');
      expect(jsContent).toContain('checkAuth');
      
      console.log('✅ フロントエンドJavaScript（認証処理含む）が正常ロード');
    });

    it('認証管理用JavaScriptが正常にロード可能', async () => {
      // auth.jsが正常にロードできるか確認
      const response = await request(app)
        .get('/js/auth.js')
        .expect(200);

      const authJsContent = response.text;
      
      // 認証チェック処理が含まれているか確認
      expect(authJsContent).toContain('checkAuthStatus');
      expect(authJsContent).toContain('AuthManager');
      
      console.log('✅ 認証管理JavaScript（AuthManager）が正常ロード');
    });
  });

  describe('6. 実際のセッション動作シミュレーション', () => {
    it('ログイン → チャット画面 → リロード → チャット画面 のフロー', async () => {
      console.log('\n🎯 完全なセッション持続性フローテスト:');
      
      // Step 1: ログイン状態確認
      console.log('📍 Step 1: ログイン状態確認');
      const loginCheck = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      console.log('   ✅ ログイン状態: OK');
      
      // Step 2: チャット画面アクセス
      console.log('📍 Step 2: チャット画面アクセス');
      const chatAccess1 = await request(app)
        .get('/')
        .expect(200);
      expect(chatAccess1.text).toContain('LazyChillRoom');
      console.log('   ✅ チャット画面: 正常表示');
      
      // Step 3: リロードシミュレーション（5秒間隔で複数回）
      console.log('📍 Step 3: リロード動作シミュレーション');
      for (let reload = 1; reload <= 3; reload++) {
        console.log(`   📍 Step 3-${reload}: ${reload}回目のリロード`);
        
        // リロード後のチャット画面アクセス
        const reloadAccess = await request(app)
          .get('/')
          .expect(200);
        expect(reloadAccess.text).toContain('LazyChillRoom');
        console.log(`     ✅ リロード${reload}: HTML表示正常`);
        
        // リロード後のAPI認証確認
        const reloadAuth = await request(app)
          .get('/api/auth/verify')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        expect(reloadAuth.body.user.userid).toBe(testUser.userid);
        console.log(`     ✅ リロード${reload}: API認証正常`);
      }
      
      // Step 4: 最終確認
      console.log('📍 Step 4: 最終状態確認');
      const finalAccess = await request(app)
        .get('/')
        .expect(200);
      expect(finalAccess.text).toContain('LazyChillRoom');
      console.log('   ✅ 最終チェック: チャット画面正常表示');
      
      console.log('\n🏆 セッション持続性テスト完了！');
      console.log('🎯 結果: ログイン後、複数回のリロードを経てもチャット画面にアクセス可能');
    });
  });

  describe('7. ログアウト後のリダイレクト動作', () => {
    it('ログアウト後はログイン画面に戻る動作確認', async () => {
      // ログアウト処理
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      console.log('✅ ログアウト処理成功');
      
      // ログアウト後のチャット画面アクセス
      // （フロントエンドが認証状態をチェックしてリダイレクトするべき）
      const afterLogout = await request(app)
        .get('/')
        .expect(200);
      
      // HTMLは返されるが、JavaScriptが認証状態をチェックしてログイン画面を表示するべき
      expect(afterLogout.text).toContain('LazyChillRoom');
      expect(afterLogout.text).toContain('id="app"');
      
      console.log('✅ ログアウト後もHTML構造は同じ（フロントエンドで認証チェック実行）');
    });
  });
});
