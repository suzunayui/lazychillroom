# LazyChillRoom - チャットアプリ

リアルタイムチャット機能を持つWebアプリケーションです。

## 開発環境セットアップ

### 必要なツール
- Podman
- Podman Compose

### 起動方法

1. **コンテナをビルド・起動**
```bash
podman-compose up -d --build
```

2. **データベース初期化** (初回のみ)
```bash
# ブラウザで以下のURLにアクセス
http://localhost:8080/api/init_tables.php
```

3. **アクセス先**
- **Webアプリ**: http://localhost:8080
- **phpMyAdmin**: http://localhost:8081
  - ユーザー: `root`
  - パスワード: `rootpassword`

4. **停止方法**
```bash
podman-compose down
```

4. **ログ確認**
```bash
# 全サービスのログ
podman-compose logs -f

# 特定サービスのログ
podman-compose logs -f web
podman-compose logs -f mysql
```

### データベース接続情報

- **ホスト**: mysql (コンテナ内) / localhost (ホストから)
- **ポート**: 3306
- **データベース名**: lazychillroom
- **ユーザー**: lazychillroom_user
- **パスワード**: lazychillroom_password
- **ルートパスワード**: rootpassword

### 開発時の注意点

- ソースコードは自動的にコンテナにマウントされるため、変更は即座に反映されます
- データベースの変更は`mysql_data`ボリュームに永続化されます
- データベース初期化は`api/init_tables.php`で実行できます

### トラブルシューティング

**ポートが既に使用されている場合**
```bash
# ポート使用状況確認
netstat -tulpn | grep :8080
netstat -tulpn | grep :3306

# 異なるポートを使用する場合はpodman-compose.yamlを編集
```

**データベースをリセットしたい場合**
```bash
podman-compose down -v
podman volume rm lazychillroom_v2_mysql_data
podman-compose up -d --build
# その後、http://localhost:8080/api/init_tables.php にアクセス
```

**コンテナに入って確認したい場合**
```bash
# Webコンテナ
podman exec -it lazychillroom_web bash

# MySQLコンテナ
podman exec -it lazychillroom_mysql mysql -u root -p
```

## プロジェクト構成

```
lazychillroom_v2/
├── index.html              # メインHTML
├── css/
│   ├── style.css          # 共通スタイル
│   ├── auth.css           # 認証画面スタイル
│   └── chat.css           # チャット画面スタイル
├── js/
│   ├── app.js             # モジュールローダー
│   ├── main.js            # SPA管理
│   ├── auth.js            # 認証機能
│   ├── chat.js            # チャット機能
│   ├── websocket.js       # リアルタイム通信
│   └── ui-components.js   # UI共通コンポーネント
├── api/
│   ├── config.php         # データベース設定
│   └── init_tables.php    # データベース初期化
├── sql/
│   └── README.md          # SQL関連ドキュメント
├── Dockerfile             # PHP環境定義
└── podman-compose.yaml    # サービス構成
```

## 次のステップ

1. 認証API（api/auth.php）の実装
2. チャット画面UIの実装
3. メッセージAPI（api/messages.php）の実装
4. ポーリングによるリアルタイム通信
5. ファイルアップロード機能
6. WebSocketによる本格的なリアルタイム通信
