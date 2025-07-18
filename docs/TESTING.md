# LazyChillRoom v7 - 自動テストガイド

## 🎯 概要

LazyChillRoom v7 では包括的な自動テストを実装しています。データベース接続が不要な基本テストから、完全な統合テストまで、段階的にテストを実行できます。

## 📋 テストの種類と実行方法

### 1. 基本テスト（推奨・常時実行可能）

データベース接続不要で、すぐに実行できるテストです：

```bash
# 基本テストの実行
npm run test:basic

# 基本テストのカバレッジレポート
npm run test:coverage:basic
```

**含まれるテスト:**
- サーバー基本動作確認
- 認証API のバリデーションテスト
- JSON パース機能
- エラーハンドリング

### 2. API テスト（データベース必要）

実際のデータベースを使用するAPI テストです：

```bash
# データベースが利用可能な場合
npm run test:api
```

**前提条件:**
- MySQL サーバーが起動している
- `lazychillroom_test` データベースが存在する
- `.env.test` の設定が正しい

### 3. Socket.io テスト（データベース必要）

リアルタイム通信のテストです：

```bash
npm run test:socket
```

### 4. 統合テスト（データベース必要）

エンドツーエンドのワークフローテストです：

```bash
npm run test:integration
```

### 5. 全テスト実行

```bash
# 全テスト（エラーが発生する可能性あり）
npm test

# カバレッジ付き全テスト
npm run test:coverage

# CI/CD 用テスト
npm run test:ci
```

## 🔧 環境設定

### データベースなしでのテスト

基本テストはデータベース接続不要で実行できます：

```bash
# 依存関係のインストールのみで実行可能
npm install
npm run test:basic
```

### データベースありでのテスト

完全なテストを実行するには、MySQL データベースのセットアップが必要です：

1. **MySQL の起動**
   ```bash
   # Podman/Docker を使用する場合
   npm run db:up
   
   # または手動でMySQLを起動
   sudo systemctl start mysql
   ```

2. **テストデータベースの作成**
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS lazychillroom_test;"
   mysql -u root -p -e "GRANT ALL PRIVILEGES ON lazychillroom_test.* TO 'root'@'localhost';"
   ```

3. **環境変数の設定**
   
   `.env.test` ファイルを確認・編集：
   ```env
   NODE_ENV=test
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=lazychillroom_test
   JWT_SECRET=test-jwt-secret-very-long-and-secure-for-testing-purposes
   PORT=3001
   ```

## 🚀 CI/CD パイプライン

### GitHub Actions

`.github/workflows/ci.yml` ファイルでCI/CD パイプラインが設定されています：

1. **基本テスト**: 常に実行される
2. **API テスト**: データベースが利用可能な場合に実行
3. **セキュリティ監査**: npm audit
4. **カバレッジレポート**: Codecov への送信

### ローカル CI テスト

CI 環境を模倣してローカルで実行：

```bash
npm run test:ci
```

## 📊 テストカバレッジ

### 現在の目標値
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

### カバレッジレポートの確認

```bash
# HTMLレポートの生成
npm run test:coverage

# ブラウザでレポートを確認
# coverage/lcov-report/index.html を開く
```

## 🐛 トラブルシューティング

### よくある問題と解決方法

1. **データベース接続エラー**
   ```
   Error: Access denied for user 'root'@'localhost'
   ```
   → `.env.test` のデータベース認証情報を確認

2. **ポート競合エラー**
   ```
   Error: listen EADDRINUSE :::3001
   ```
   → 他のプロセスが3001ポートを使用していないか確認

3. **テストタイムアウト**
   ```
   Timeout - Async callback was not invoked within the 30000ms timeout
   ```
   → データベースの応答が遅い場合、`jest.config.js` のタイムアウト値を調整

### エラー時の対処手順

1. **基本テストが失敗する場合**
   ```bash
   # Node.js とnpm のバージョン確認
   node --version
   npm --version
   
   # 依存関係の再インストール
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **データベーステストが失敗する場合**
   ```bash
   # MySQL サービスの状態確認
   sudo systemctl status mysql
   
   # テストデータベースの確認
   mysql -u root -p -e "SHOW DATABASES LIKE 'lazychillroom_test';"
   
   # 権限の確認
   mysql -u root -p -e "SHOW GRANTS FOR 'root'@'localhost';"
   ```

## 🔄 継続的改善

### テストの追加方法

1. **新機能のテスト追加**
   - `tests/api/` - API エンドポイントのテスト
   - `tests/socket/` - Socket.io のテスト
   - `tests/integration/` - 統合テスト

2. **テストヘルパーの活用**
   ```javascript
   const TestHelper = require('../helpers/TestHelper');
   
   // テストデータの作成と削除が自動化される
   ```

3. **基本テストの拡張**
   - データベース不要なロジックテスト
   - バリデーション機能のテスト
   - ユーティリティ関数のテスト

## 📝 開発ワークフロー

### 推奨テスト実行順序

1. **開発時**
   ```bash
   npm run test:basic  # 高速・常時実行
   ```

2. **機能実装後**
   ```bash
   npm run test:api    # 関連API テスト
   ```

3. **リリース前**
   ```bash
   npm run test:coverage  # 全テスト+カバレッジ
   ```

### コミット前チェックリスト

- [ ] 基本テストがパスする
- [ ] 新機能のテストを追加した
- [ ] カバレッジが下がっていない
- [ ] エラーログに不要な出力がない

## 🎯 成果と利点

### 実装されたテスト自動化

✅ **基本テスト**: データベース不要で高速実行  
✅ **API テスト**: 認証、メッセージ、フレンド機能  
✅ **Socket.io テスト**: リアルタイム通信  
✅ **統合テスト**: エンドツーエンドワークフロー  
✅ **CI/CD パイプライン**: GitHub Actions 設定  
✅ **カバレッジレポート**: 詳細な分析  
✅ **セキュリティ監査**: 自動脆弱性チェック  

### 品質向上効果

- **回帰テスト**: 新機能追加時の既存機能保護
- **リファクタリング**: 安全なコード改善
- **ドキュメント**: テストコードが仕様書代わり
- **信頼性**: プロダクション環境での安定性向上

---

**注意**: 本格的なAPI テストを実行するには、MySQL データベースのセットアップが必要です。データベース環境がない場合は、基本テスト（`npm run test:basic`）を使用して、コードの品質を確保できます。
