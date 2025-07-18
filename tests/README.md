# テスト実行ガイド

このプロジェクトでは Jest を使用した包括的なテストスイートを提供しています。

## テストの種類

### 1. API テスト (`tests/api/`)
- **auth.test.js**: 認証システム（登録、ログイン、トークン検証）
- **messages.test.js**: メッセージ機能（送信、取得、削除、編集）
- **friends.test.js**: フレンド機能（申請、承認、拒否、削除）

### 2. リアルタイム通信テスト (`tests/socket/`)
- **realtime.test.js**: Socket.io を使用したリアルタイム機能（接続、メッセージ、タイピング）

### 3. 統合テスト (`tests/integration/`)
- **chat-flow.test.js**: チャット機能の完全なワークフロー
- **file-upload.test.js**: ファイルアップロード機能

## テスト実行方法

### 全テストの実行
```bash
npm test
```

### 特定のテストスイートの実行
```bash
# API テストのみ
npm run test:api

# Socket.io テストのみ
npm run test:socket

# 統合テストのみ
npm run test:integration

# 特定のテストファイル
npm test -- auth.test.js
```

### カバレッジレポートの生成
```bash
npm run test:coverage
```

### ウォッチモードでの実行
```bash
npm run test:watch
```

## テスト環境の設定

### 環境変数
テスト用の環境変数は `.env.test` ファイルで設定されています：

```env
NODE_ENV=test
DB_HOST=localhost
DB_USER=testuser
DB_PASSWORD=testpass
DB_NAME=lazychillroom_test
JWT_SECRET=test-jwt-secret
PORT=3001
```

### データベース設定
テスト実行前に、テスト用データベースが作成・設定されることを確認してください：

```bash
# テスト用データベースの作成
psql -U postgres -c "CREATE DATABASE lazychillroom_test;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE lazychillroom_test TO testuser;"
```

## テストヘルパー

`tests/helpers/TestHelper.js` クラスは以下の機能を提供します：

- テストユーザーの作成と削除
- テストギルドの作成と削除
- テストチャンネルの作成と削除
- フレンド関係の作成
- JWTトークンの生成
- データベースのクリーンアップ

### 使用例
```javascript
const TestHelper = require('../helpers/TestHelper');

describe('テストケース', () => {
  let testHelper;

  beforeAll(async () => {
    testHelper = new TestHelper();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  test('ユーザー作成テスト', async () => {
    const user = await testHelper.createTestUser();
    expect(user.id).toBeDefined();
  });
});
```

## カバレッジ目標

プロジェクトでは以下のカバレッジ目標を設定しています：

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## トラブルシューティング

### よくある問題と解決方法

1. **データベース接続エラー**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:5432
   ```
   - PostgreSQL サーバーが起動していることを確認
   - テスト用データベースが作成されていることを確認
   - `.env.test` の設定を確認

2. **ポート競合エラー**
   ```
   Error: listen EADDRINUSE :::3001
   ```
   - 他のプロセスがポート 3001 を使用していないか確認
   - `.env.test` で異なるポートを指定

3. **タイムアウトエラー**
   ```
   Timeout - Async callback was not invoked within the 5000ms timeout
   ```
   - データベースの応答が遅い場合は `jest.config.js` でタイムアウト値を調整
   - 非同期処理が正しく完了していることを確認

## CI/CD での実行

GitHub Actions や他の CI/CD システムでテストを実行する場合：

1. Node.js 環境のセットアップ
2. PostgreSQL データベースのセットアップ
3. 依存関係のインストール
4. 環境変数の設定
5. テストの実行

### GitHub Actions 設定例
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: lazychillroom_test
        options: >-
          --health-cmd="pg_isready"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '16'
    - run: npm install
    - run: npm test
      env:
        DB_HOST: 127.0.0.1
        DB_USER: postgres
        DB_PASSWORD: postgres
        DB_NAME: lazychillroom_test
```

## テストベストプラクティス

1. **独立性**: 各テストは他のテストに依存しない
2. **クリーンアップ**: 各テスト後にデータベースをクリーンアップ
3. **現実的なデータ**: 実際の使用ケースに近いテストデータを使用
4. **エラーケース**: 正常系だけでなく異常系もテスト
5. **セキュリティ**: 認証・認可の機能を重点的にテスト

## テスト追加時の注意点

新しいテストを追加する際は：

1. 適切なディレクトリに配置（API、Socket、統合）
2. TestHelper を活用してテストデータを管理
3. afterEach でクリーンアップを忘れずに
4. 非同期処理は async/await を使用
5. エラーメッセージは具体的で分かりやすく
