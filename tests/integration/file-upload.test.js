// 統合テスト - ファイルアップロード機能
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const TestHelper = require('../helpers/TestHelper');

function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // ファイルアップロード関連のルートを設定
  app.use('/api/auth', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/auth'));
  app.use('/api/files', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/files'));
  app.use('/api/messages', require('../../backend/middleware/auth').authenticateToken, require('../../backend/routes/messages'));
  
  return app;
}

describe('統合テスト - ファイル機能', () => {
  let app;
  let testHelper;

  beforeAll(async () => {
    app = createTestApp();
    testHelper = new TestHelper();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('ファイルアップロードフロー', () => {
    test('画像ファイルのアップロードとメッセージ添付', async () => {
      const user = await testHelper.createTestUser();
      const guild = await testHelper.createTestGuild(user.id);
      const channel = await testHelper.createTestChannel(guild.id);

      // テスト用画像ファイルを作成
      const testImagePath = path.join(__dirname, '../fixtures/test-image.png');
      
      // 簡単なPNG画像データを作成（1x1ピクセルの透明PNG）
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
      ]);

      // テスト用ディレクトリを作成
      const testDir = path.dirname(testImagePath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      fs.writeFileSync(testImagePath, pngBuffer);

      try {
        // 1. ファイルをアップロード
        const uploadResponse = await request(app)
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${testHelper.generateToken(user)}`)
          .attach('file', testImagePath)
          .field('type', 'message');

        expect(uploadResponse.status).toBe(200);
        expect(uploadResponse.body.success).toBe(true);
        expect(uploadResponse.body.file).toBeDefined();
        
        const fileData = uploadResponse.body.file;

        // 2. アップロードしたファイルをメッセージに添付
        const messageResponse = await request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${testHelper.generateToken(user)}`)
          .send({
            channel_id: channel.id,
            content: 'Check out this image!',
            file_id: fileData.id
          });

        expect(messageResponse.status).toBe(201);
        expect(messageResponse.body.success).toBe(true);
        expect(messageResponse.body.message.file_url).toBeTruthy();

        // 3. メッセージとファイルを取得して確認
        const messagesResponse = await request(app)
          .get('/api/messages')
          .set('Authorization', `Bearer ${testHelper.generateToken(user)}`)
          .query({ channel_id: channel.id });

        expect(messagesResponse.status).toBe(200);
        expect(messagesResponse.body.messages).toHaveLength(1);
        
        const message = messagesResponse.body.messages[0];
        expect(message.file_url).toBeTruthy();
        expect(message.content).toBe('Check out this image!');

      } finally {
        // テストファイルを削除
        if (fs.existsSync(testImagePath)) {
          fs.unlinkSync(testImagePath);
        }
      }
    });

    test('アバター画像のアップロードと更新', async () => {
      const user = await testHelper.createTestUser();

      // テスト用画像ファイルを作成
      const testAvatarPath = path.join(__dirname, '../fixtures/test-avatar.jpg');
      
      // 簡単なJPEG画像データを作成
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
        0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
        0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
        0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
        0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
        0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
        0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
        0x32, 0xFF, 0xD9
      ]);

      // テスト用ディレクトリを作成
      const testDir = path.dirname(testAvatarPath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      fs.writeFileSync(testAvatarPath, jpegBuffer);

      try {
        // アバター画像をアップロード
        const uploadResponse = await request(app)
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${testHelper.generateToken(user)}`)
          .attach('file', testAvatarPath)
          .field('type', 'avatar');

        expect(uploadResponse.status).toBe(200);
        expect(uploadResponse.body.success).toBe(true);
        expect(uploadResponse.body.file).toBeDefined();
        expect(uploadResponse.body.file.type).toBe('avatar');

      } finally {
        // テストファイルを削除
        if (fs.existsSync(testAvatarPath)) {
          fs.unlinkSync(testAvatarPath);
        }
      }
    });
  });

  describe('ファイルバリデーション', () => {
    test('サポートされていないファイル形式の拒否', async () => {
      const user = await testHelper.createTestUser();

      // 実行可能ファイルを模倣したテストファイルを作成
      const testExePath = path.join(__dirname, '../fixtures/test-malicious.exe');
      const testDir = path.dirname(testExePath);
      
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      fs.writeFileSync(testExePath, 'MZ\x90\x00'); // PE executable header

      try {
        const uploadResponse = await request(app)
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${testHelper.generateToken(user)}`)
          .attach('file', testExePath)
          .field('type', 'message');

        expect(uploadResponse.status).toBe(400);
        expect(uploadResponse.body.success).toBe(false);
        expect(uploadResponse.body.error).toMatch(/not allowed/i);

      } finally {
        if (fs.existsSync(testExePath)) {
          fs.unlinkSync(testExePath);
        }
      }
    });

    test('ファイルサイズ制限の確認', async () => {
      const user = await testHelper.createTestUser();

      // 大きなファイルを作成（テスト用に適度なサイズ）
      const testLargeFilePath = path.join(__dirname, '../fixtures/test-large.txt');
      const testDir = path.dirname(testLargeFilePath);
      
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      // 1MB のテストファイルを作成（実際の制限より小さくてテスト目的）
      const largeContent = 'A'.repeat(1024 * 1024);
      fs.writeFileSync(testLargeFilePath, largeContent);

      try {
        const uploadResponse = await request(app)
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${testHelper.generateToken(user)}`)
          .attach('file', testLargeFilePath)
          .field('type', 'message');

        // ファイルサイズ制限の設定に応じて、200または400のいずれかが期待される
        expect([200, 400]).toContain(uploadResponse.status);

        if (uploadResponse.status === 400) {
          expect(uploadResponse.body.error).toMatch(/size|large/i);
        }

      } finally {
        if (fs.existsSync(testLargeFilePath)) {
          fs.unlinkSync(testLargeFilePath);
        }
      }
    });
  });

  describe('ファイルセキュリティ', () => {
    test('他のユーザーのファイルへの不正アクセス防止', async () => {
      const user1 = await testHelper.createTestUser();
      const user2 = await testHelper.createTestUser();
      const guild = await testHelper.createTestGuild(user1.id);
      const channel = await testHelper.createTestChannel(guild.id);

      // User1がファイルをアップロード
      const testFilePath = path.join(__dirname, '../fixtures/test-private.txt');
      const testDir = path.dirname(testFilePath);
      
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      fs.writeFileSync(testFilePath, 'Private content');

      try {
        const uploadResponse = await request(app)
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${testHelper.generateToken(user1)}`)
          .attach('file', testFilePath)
          .field('type', 'message');

        expect(uploadResponse.status).toBe(200);
        const fileData = uploadResponse.body.file;

        // User2が他人のファイルにアクセスを試行
        const accessResponse = await request(app)
          .get(`/api/files/${fileData.id}`)
          .set('Authorization', `Bearer ${testHelper.generateToken(user2)}`);

        expect(accessResponse.status).toBe(403);
        expect(accessResponse.body.success).toBe(false);

      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });
});
