// 簡単なサンプルテスト - データベース接続無しで基本動作を確認
const request = require('supertest');
const express = require('express');

// 基本的なExpressアプリを作成
function createSampleApp() {
  const app = express();
  app.use(express.json());
  
  // サンプルルート
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Test server is running' });
  });
  
  app.post('/echo', (req, res) => {
    res.json({ 
      success: true, 
      received: req.body,
      timestamp: new Date().toISOString()
    });
  });
  
  return app;
}

describe('基本テスト - サーバー動作確認', () => {
  let app;

  beforeAll(() => {
    app = createSampleApp();
  });

  test('ヘルスチェックエンドポイント', async () => {
    const response = await request(app)
      .get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.message).toBe('Test server is running');
  });

  test('エコーエンドポイント - POST リクエスト', async () => {
    const testData = {
      message: 'Hello, Test!',
      number: 123,
      boolean: true
    };

    const response = await request(app)
      .post('/echo')
      .send(testData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.received).toEqual(testData);
    expect(response.body.timestamp).toBeDefined();
  });

  test('存在しないエンドポイントへのアクセス', async () => {
    const response = await request(app)
      .get('/nonexistent');

    expect(response.status).toBe(404);
  });

  test('JSONパース - 正常なデータ', async () => {
    const response = await request(app)
      .post('/echo')
      .send({ test: 'data' })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.received.test).toBe('data');
  });
});
