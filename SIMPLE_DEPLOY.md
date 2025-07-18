# LazyChillRoom 超シンプルデプロイガイド

## 🚀 HTTPSデプロイ（推奨）

```bash
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom && DOMAIN=your-domain.com podman-compose -f podman-compose.production.yaml up -d --build
```

**HTTPS完全自動化！**
- ✅ Let's Encrypt SSL証明書自動取得
- ✅ セキュアなパスワード自動生成
- ✅ HTTPS自動リダイレクト設定
- ✅ 証明書自動更新準備

## 🌐 HTTP簡単デプロイ（ローカル・テスト用）

```bash
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom && podman-compose -f podman-compose.production.yaml up -d --build
```

**これだけで完了！**
- ✅ 環境設定ファイル自動生成
- ✅ セキュアなパスワード自動生成
- ✅ コンテナ自動ビルド・起動
- ✅ アプリケーション即座に利用可能
- ✅ 追加のスクリプトファイル不要

### 📋 何が自動で行われるか

1. **環境変数初期化** - `init`サービスが`.env.production`を自動生成
2. **セキュアパスワード生成** - DB、Redis、JWT用の32-64文字パスワード
3. **サービス起動順序制御** - 依存関係に基づいた適切な起動順序
4. **ヘルスチェック** - 各サービスの正常性確認

---

## ⚡ ワンライナーデプロイ

### HTTPS版（本番環境）
```bash
git clone https://github.com/suzunayui/lazychillroom.git && cd lazychillroom && DOMAIN=your-domain.com podman-compose -f podman-compose.production.yaml up -d --build
```

### HTTP版（開発・テスト環境）
```bash
git clone https://github.com/suzunayui/lazychillroom.git && cd lazychillroom && podman-compose -f podman-compose.production.yaml up -d --build
```

---

## 🔧 詳細手順（理解したい場合）

### HTTPS版デプロイ

```bash
# 1. リポジトリクローン
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom

# 2. HTTPS対応デプロイ実行
DOMAIN=your-domain.com podman-compose -f podman-compose.production.yaml up -d --build
```

### HTTP版デプロイ

```bash
# 1. リポジトリクローン
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom

# 2. HTTP版デプロイ実行
podman-compose -f podman-compose.production.yaml up -d --build
```

**内部で実行される処理：**
- `init`サービスが環境設定ファイルを生成
- `certbot`サービスがSSL証明書を取得（HTTPS版のみ）
- PostgreSQL、Redis、アプリケーション、Nginxが順次起動
- 各サービスのヘルスチェック実行

### 📋 HTTPS設定の前提条件

**ドメインの事前設定が必要：**
1. ドメインのAレコードでサーバーのIPアドレスを指定
2. DNS設定が反映されていること（`nslookup your-domain.com`で確認）
3. ポート80/443がファイアウォールで開放されていること

**DNS確認例：**
```bash
# DNS解決確認
nslookup your-domain.com
dig your-domain.com

# サーバーIP確認
curl -4 ifconfig.me
```

## 📋 管理コマンド

### 基本操作
```bash
# サービス開始
podman-compose -f podman-compose.production.yaml up -d

# サービス停止
podman-compose -f podman-compose.production.yaml down

# 完全停止（ボリューム削除）
podman-compose -f podman-compose.production.yaml down -v

# サービス再起動
podman-compose -f podman-compose.production.yaml restart

# ログ確認
podman-compose -f podman-compose.production.yaml logs -f

# 状態確認
podman-compose -f podman-compose.production.yaml ps
```

### 個別サービス操作
```bash
# 特定サービスのログ
podman-compose -f podman-compose.production.yaml logs -f app
podman-compose -f podman-compose.production.yaml logs -f postgres
podman-compose -f podman-compose.production.yaml logs -f nginx

# 特定サービス再起動
podman-compose -f podman-compose.production.yaml restart app
```

### ヘルスチェック
```bash
# アプリケーション確認
curl http://localhost/health

# 各サービス確認
podman-compose -f podman-compose.production.yaml exec app curl http://localhost:3000/health
podman-compose -f podman-compose.production.yaml exec postgres pg_isready -U lazychillroom_user
podman-compose -f podman-compose.production.yaml exec redis redis-cli ping
```

## ⚡ 代替デプロイ方法

### 手動環境設定（カスタマイズしたい場合）

```bash
# リポジトリクローン
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom

# 手動で環境設定
cp .env.example .env.production
nano .env.production  # パスワード手動編集

# デプロイ実行
podman-compose -f podman-compose.production.yaml up -d --build
```

### 従来のスクリプト使用

```bash
# init.sh使用（スクリプトが残っている場合）
git clone https://github.com/suzunayui/lazychillroom.git && cd lazychillroom && ./init.sh && podman-compose -f podman-compose.production.yaml up -d --build
```

## 🔧 トラブルシューティング

### ポート競合エラー
```bash
# 使用中のポートを確認
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# 既存サービス停止
podman-compose -f podman-compose.production.yaml down -v
```

### コンテナが起動しない
```bash
# 詳細ログ確認
podman-compose -f podman-compose.production.yaml logs

# イメージ再ビルド
podman-compose -f podman-compose.production.yaml build --no-cache
podman-compose -f podman-compose.production.yaml up -d
```

### データベース接続エラー
```bash
# PostgreSQL接続確認
podman-compose -f podman-compose.production.yaml exec postgres pg_isready -U lazychillroom_user

# Redis接続確認
podman-compose -f podman-compose.production.yaml exec redis redis-cli -a "$REDIS_PASSWORD" ping
```
