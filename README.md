# LazyChillRoom - Node.js版

このプロジェクトのNode.js版です。Express.js、Socket.io、PostgreSQL、Redisを使用してリアルタイムチャットアプリケーションを構築しています。

## ⚡ クイックデプロイ（本番環境）

Ubuntu 24.04サーバーで簡単にデプロイできます：

### 🤖 完全自動（ゼロタッチ）
```bash
# パスワード自動生成 + 自動デプロイ（最も簡単）
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/auto-deploy.sh | bash
```

### 🔧 セットアップのみ（パスワード自動生成）
```bash
# 自動セットアップ（デプロイは手動実行）
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --auto

# 手動セットアップ（設定ファイル編集可能）
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash
```

### 📝 手動設定
```bash
# 完全手動
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom
cp .env.example .env.production
nano .env.production  # パスワードとJWT_SECRETを設定
./deploy-production.sh
```

詳細な本番環境デプロイ手順は [DEPLOYMENT.md](DEPLOYMENT.md) を参照してください。

## 🚀 機能

- **リアルタイムチャット**: Socket.ioを使用したリアルタイムメッセージング
- **ユーザー認証**: JWT認証システム
- **サーバー管理**: Discordライクなサーバー（ギルド）とチャンネル管理
- **ファイル共有**: 画像、動画、ドキュメントのアップロード機能
- **プロフィール管理**: アバターアップロード機能
- **レスポンシブデザイン**: モバイル対応UI
- **DM・フレンド機能**: ダイレクトメッセージとフレンド申請システム
- **リアクション機能**: メッセージへの絵文字リアクション
- **ピン機能**: 重要なメッセージのピン留め
- **プレゼンス管理**: ユーザーのオンライン状態表示
- **自動テスト**: Jest を使用した包括的なテストスイート

## 🧪 テスト自動化

本プロジェクトでは Jest を使用した包括的な自動テストを実装しています：

### 基本テスト（推奨）
```bash
# 基本機能テスト - データベース不要で高速実行
npm run test:basic

# PostgreSQL + Redis版 - メインデータベーススタック
npm run test:postgresql

# 全テストスイート
npm run test:all

# カバレッジレポート付き
npm run test:coverage:basic
```

### 完全テスト（データベース必要）
```bash
# API テスト
npm run test:api

# Socket.io テスト  
npm run test:socket

# 統合テスト
npm run test:integration

# 全テスト実行
npm test
```

### テストの種類
- **単体テスト**: API エンドポイント、認証システム
- **統合テスト**: エンドツーエンドワークフロー
- **リアルタイムテスト**: Socket.io 通信
- **PostgreSQL + Redis テスト**: データベーススタック検証 (50テスト)
- **セキュリティテスト**: SQL インジェクション対策

詳細は [TESTING.md](./docs/TESTING.md) を参照してください。

## 🛠️ 技術スタック

### バックエンド
- **Node.js**: サーバーサイドJavaScript
- **Express.js**: Webフレームワーク
- **Socket.io**: リアルタイム通信
- **PostgreSQL**: メインデータベース (高性能・拡張性)
- **Redis**: キャッシュ・セッション管理・リアルタイム機能
- **JWT**: 認証トークン
- **Multer**: ファイルアップロード
- **bcryptjs**: パスワードハッシュ化
- **Sharp**: 画像最適化・サムネイル生成
- **Helmet**: セキュリティヘッダー
- **Express Rate Limit**: レート制限
- **Compression**: Gzip圧縮

### フロントエンド
- **Vanilla JavaScript**: フロントエンド
- **Socket.io Client**: リアルタイム通信
- **CSS3**: スタイリング

## 📦 インストールと起動

### 前提条件
- Node.js 22以上
- Podman & Podman Compose (推奨)

### Podman Composeを使用した起動（推奨）

#### PostgreSQL + Redis版（推奨）

1. **プロジェクトディレクトリに移動**
   ```bash
   cd lazychillroom_v7
   ```

2. **依存関係をインストール**
   ```bash
   npm install
   ```

3. **PostgreSQL + Redis環境を起動**
   ```bash
   npm run setup:postgresql
   ```

4. **アクセス**
   - **Webアプリ**: http://localhost:3000
   - **pgAdmin**: http://localhost:5050
   - **Redis Commander**: http://localhost:8082

### ローカル開発環境での起動

1. **PostgreSQL と Redis を起動** (別途インストールが必要)

2. **環境変数を設定**
   ```bash
   # .envファイルを作成してデータベース設定を記述
   cp .env .env.local
   # .env.localファイルを編集してローカル環境用の設定に更新
   ```

3. **依存関係をインストール**
   ```bash
   npm install
   ```

4. **データベースマイグレーション**
   ```bash
   npm run migrate:postgresql
   ```

5. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

## 🔄 データベースリセット

初期状態に戻したい場合や、最初のユーザーを管理者にしたい場合：

```bash
# データベースコンテナを完全リセット（全データ削除）
npm run all
```

**重要**: リセット後、最初に登録したユーザーが自動的に管理者権限を取得し、デフォルトの「LazyChillRoom 公式」サーバーのオーナーになります。

## 📁 プロジェクト構造

```
lazychillroom_v7/
├── backend/
│   ├── server.js              # メインサーバーファイル
│   ├── config/
│   │   └── database.js        # データベース設定
│   ├── middleware/
│   │   └── auth.js           # 認証ミドルウェア
│   ├── routes/               # APIルート
│   │   ├── auth.js          # 認証API
│   │   ├── channels.js      # チャンネルAPI
│   │   ├── dm.js            # ダイレクトメッセージAPI
│   │   ├── files.js         # ファイルAPI
│   │   ├── friends.js       # フレンドAPI
│   │   ├── guilds.js        # ギルドAPI
│   │   ├── messages.js      # メッセージAPI
│   │   ├── pins.js          # ピン機能API
│   │   ├── presence.js      # プレゼンス（在線状況）API
│   │   ├── reactions.js     # リアクションAPI
│   │   ├── typing.js        # タイピング状況API
│   │   └── users.js         # ユーザーAPI
│   ├── socket/
│   │   └── socketHandler.js # Socket.io ハンドラー
│   ├── services/            # ビジネスロジック
│   └── migrations/
│       ├── initPostgreSQL.js    # データベース初期化
│       └── postgresql-schema.sql # PostgreSQLスキーマ定義
├── frontend/                # フロントエンド
│   ├── index.html          # メインHTML
│   ├── css/               # スタイルシート
│   └── js/                # フロントエンドJS
├── tests/                 # テストファイル
├── docs/                  # ドキュメント
├── uploads/               # アップロードファイル保存
├── package.json           # 依存関係とスクリプト
├── .env                   # 環境変数設定
├── Dockerfile             # Docker設定
└── podman-compose.yaml    # Podman Compose設定
```

## 🔧 API エンドポイント

### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/auth/verify` - トークン検証

### メッセージ
- `GET /api/messages` - メッセージ取得
- `POST /api/messages` - メッセージ送信
- `DELETE /api/messages/:id` - メッセージ削除

### ギルド
- `GET /api/guilds` - ギルド一覧取得
- `GET /api/guilds/:id` - ギルド詳細取得
- `POST /api/guilds` - ギルド作成
- `POST /api/guilds/join/:inviteCode` - ギルド参加

### チャンネル
- `GET /api/channels/guild/:guildId` - チャンネル一覧取得
- `POST /api/channels` - チャンネル作成
- `PUT /api/channels/:id` - チャンネル更新
- `DELETE /api/channels/:id` - チャンネル削除

### ファイル
- `POST /api/files/upload` - ファイルアップロード
- `GET /api/files/:id` - ファイル取得
- `DELETE /api/files/:id` - ファイル削除

## 🔌 Socket.io イベント

### クライアント → サーバー
- `join_guilds` - ユーザーのギルドに参加
- `join_channel` - 特定のチャンネルに参加
- `leave_channel` - チャンネルから離脱
- `typing_start` - タイピング開始
- `typing_stop` - タイピング停止

### サーバー → クライアント
- `new_message` - 新しいメッセージ
- `message_deleted` - メッセージ削除
- `user_joined` - ユーザー参加
- `user_left` - ユーザー離脱
- `user_typing` - ユーザータイピング中

## 🛡️ セキュリティ機能

- **JWT認証**: セキュアなトークンベース認証
- **Rate Limiting**: API呼び出し制限
- **CORS設定**: クロスオリジンリクエスト制御
- **Helmet**: セキュリティヘッダー設定
- **パスワードハッシュ化**: bcryptjsによる安全なパスワード保存
- **ファイルアップロード制限**: ファイルタイプとサイズの制限

## 🚧 開発状況

### 完了済み
- ✅ 基本的なRESTful API
- ✅ Socket.ioによるリアルタイム通信
- ✅ ユーザー認証システム
- ✅ ギルドとチャンネル管理
- ✅ メッセージング機能
- ✅ ファイルアップロード機能
- ✅ プレゼンス（在線状況）管理
- ✅ タイピング状況表示
- ✅ ピン機能
- ✅ リアクション機能
- ✅ DM（ダイレクトメッセージ）
- ✅ フレンド機能
- ✅ Docker/Podman環境
- ✅ **PostgreSQL + Redis データベーススタック**
- ✅ **包括的テスト自動化とパフォーマンス最適化**

### 今後の実装予定
- 🔄 ボイスチャット機能
- 🔄 通知システム
- 🔄 絵文字とカスタム絵文字
- 🔄 モデレーション機能
- 🔄 サーバーブースト機能

## � ドキュメント

詳細なドキュメントは [`docs/`](./docs/) フォルダにあります：

- **[テストガイド](./docs/TESTING.md)** - 自動テストの実行方法
- **[パフォーマンス最適化](./docs/PERFORMANCE_OPTIMIZATION.md)** - 最適化のベストプラクティス

## �📝 ライセンス

MIT License

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📞 サポート

問題や質問がある場合は、GitHubのIssueを作成してください。
