# LazyChillRoom 自動デプロイメント

## 📋 概要

LazyChillRoomを簡単にデプロイするための自動化スクリプトです。HTTP環境とHTTPS環境の両方に対応しています。

## 🚀 クイックスタート

### HTTP環境（ローカル開発）

```bash
# プロジェクトのクローンと起動
curl -sSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/deploy.sh | bash

# または手動で実行
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom
./deploy.sh
```

**アクセス:** http://localhost

### HTTPS環境（本番環境）

```bash
# ドメインを指定してHTTPS環境でデプロイ
export DOMAIN=your-domain.com
curl -sSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/deploy.sh | bash

# または手動で実行
export DOMAIN=your-domain.com
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom
./deploy.sh
```

**アクセス:** https://your-domain.com

## 🔧 必要な環境

- **Podman** または **Docker**
- **podman-compose** または **docker-compose**
- **Git**
- **curl** (ヘルスチェック用)

### Podmanのインストール (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y podman podman-compose
```

### Podmanのインストール (CentOS/RHEL)

```bash
sudo dnf install -y podman podman-compose
```

## 📁 自動生成されるファイル

デプロイスクリプトは以下のファイルを自動生成します：

- `.env.production` - 環境変数設定（パスワード等）
- `nginx/nginx.conf` - Nginx設定（存在しない場合）
- `migrations/postgresql-schema.sql` - データベーススキーマ（存在しない場合）
- `uploads/` - アップロードファイル用ディレクトリ
- `nginx/ssl/` - SSL証明書用ディレクトリ

## 🔐 セキュリティ機能

### 自動生成されるパスワード
- **データベース**: 32文字のランダムパスワード
- **Redis**: 32文字のランダムパスワード
- **JWT Secret**: 64文字のランダムシークレット

### SSL/TLS (HTTPS環境)
- Let's Encrypt証明書の自動取得
- TLS 1.2/1.3対応
- HSTS (HTTP Strict Transport Security)
- セキュリティヘッダー自動設定

### レート制限
- API: 10req/sec (バースト: 20req)
- ログイン: 1req/sec (バースト: 5req)

## 📊 管理コマンド

```bash
cd lazychillroom

# サービス状態確認
podman-compose -f podman-compose.production.yaml ps

# ログ確認
podman-compose -f podman-compose.production.yaml logs -f

# 特定サービスのログ確認
podman-compose -f podman-compose.production.yaml logs -f app

# サービス停止
podman-compose -f podman-compose.production.yaml down

# サービス再起動
podman-compose -f podman-compose.production.yaml restart

# 完全クリーンアップ（データ削除）
podman-compose -f podman-compose.production.yaml down -v
podman system prune -af
```

## 🌐 アクセス先

### HTTP環境
- **メインアプリ**: http://localhost
- **アプリ直接**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### HTTPS環境
- **メインアプリ**: https://your-domain.com
- **HTTP→HTTPSリダイレクト**: http://your-domain.com

## 🔍 トラブルシューティング

### 1. ポートが使用中の場合

```bash
# 使用中のポートを確認
sudo netstat -tlnp | grep ":80\|:443\|:3000\|:5432\|:6379"

# 既存のコンテナを全て停止
podman stop $(podman ps -aq)
podman rm $(podman ps -aq)
```

### 2. SSL証明書の問題

```bash
# 証明書ファイルの確認
ls -la nginx/ssl/

# Let's Encrypt証明書の再取得
podman-compose -f podman-compose.production.yaml restart certbot
```

### 3. データベース接続エラー

```bash
# PostgreSQLの状態確認
podman-compose -f podman-compose.production.yaml exec postgres pg_isready

# データベースログ確認
podman-compose -f podman-compose.production.yaml logs postgres
```

### 4. 環境変数の確認

```bash
# 生成された環境変数の確認
cat .env.production
```

## 🔄 更新手順

```bash
cd lazychillroom

# 最新版に更新
git pull origin main

# サービス再起動
podman-compose -f podman-compose.production.yaml down
./deploy.sh
```

## 📝 ログ場所

- **アプリケーション**: `podman-compose logs app`
- **Nginx**: `podman-compose logs nginx`
- **PostgreSQL**: `podman-compose logs postgres`
- **Redis**: `podman-compose logs redis`

## ⚙️ カスタマイズ

### 環境変数のカスタマイズ

`.env.production`ファイルを編集後、サービスを再起動：

```bash
podman-compose -f podman-compose.production.yaml restart
```

### Nginx設定のカスタマイズ

`nginx/nginx.conf`を編集後、Nginxサービスを再起動：

```bash
podman-compose -f podman-compose.production.yaml restart nginx
```

## 🆘 サポート

問題が発生した場合は、以下の情報と共にIssueを作成してください：

```bash
# システム情報の収集
echo "=== システム情報 ===" > debug.log
uname -a >> debug.log
podman version >> debug.log
podman-compose version >> debug.log
echo "" >> debug.log

echo "=== サービス状態 ===" >> debug.log
podman-compose -f podman-compose.production.yaml ps >> debug.log
echo "" >> debug.log

echo "=== ログ ===" >> debug.log
podman-compose -f podman-compose.production.yaml logs --tail=50 >> debug.log

# debug.logをGitHub Issueに添付
```
