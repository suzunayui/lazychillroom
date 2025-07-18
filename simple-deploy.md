# 🚀 最小構成デプロイ方法

## 📋 必要なファイルのみでデプロイ

### 最小限の3ファイル構成

1. **`.env.production`** - 環境変数設定
2. **`Dockerfile`** - アプリケーションイメージ
3. **`podman-compose.production.yaml`** - コンテナオーケストレーション

### 📦 事前準備（一度だけ）

```bash
# 必須パッケージインストール
sudo apt update
sudo apt install -y podman podman-compose curl git

# ファイアウォール設定（一度だけ）
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
```

### 🔐 セキュアパスワード生成

```bash
# セキュアパスワード生成
DB_PASSWORD=$(openssl rand -base64 48 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-32)
REDIS_PASSWORD=$(openssl rand -base64 48 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 96 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-64)

# .env.productionファイル生成
cat > .env.production << EOF
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USER=lazychillroom_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=lazychillroom
POSTGRES_USER=lazychillroom_user
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=lazychillroom
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=0
JWT_SECRET=$JWT_SECRET
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp,mp4,webm,pdf,txt,docx
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=12
TRUST_PROXY=true
SECURE_COOKIES=true
SESSION_SECURE=true
EOF
```

### 🚀 シンプルデプロイ

```bash
# リポジトリクローン
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom

# 上記のパスワード生成コマンドを実行

# デプロイ実行
podman-compose -f podman-compose.production.yaml up -d --build

# 状態確認
podman-compose -f podman-compose.production.yaml ps
curl http://localhost/health
```

### 🔒 HTTPS設定（SSL証明書）

```bash
# SSL証明書取得
sudo apt install -y certbot
sudo certbot certonly --standalone -d your-domain.com

# SSL証明書をnginxディレクトリにコピー
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/

# Nginx再起動
podman-compose -f podman-compose.production.yaml restart nginx
```

## 📋 必要最小限のコマンド

### ワンライナーデプロイ

```bash
# HTTPSなし版
git clone https://github.com/suzunayui/lazychillroom.git && cd lazychillroom && DB_PASSWORD=$(openssl rand -base64 48 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-32) && REDIS_PASSWORD=$(openssl rand -base64 48 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-32) && JWT_SECRET=$(openssl rand -base64 96 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-64) && sed -e "s/CHANGE_THIS_IN_PRODUCTION/$DB_PASSWORD/g" -e "s/CHANGE_THIS_TO_VERY_LONG_RANDOM_STRING_IN_PRODUCTION/$JWT_SECRET/g" .env.example > .env.production && sed -i "s/REDIS_PASSWORD=CHANGE_THIS_IN_PRODUCTION/REDIS_PASSWORD=$REDIS_PASSWORD/" .env.production && podman-compose -f podman-compose.production.yaml up -d --build
```

### 管理コマンド

```bash
# 停止
podman-compose -f podman-compose.production.yaml down

# 停止（ボリューム削除）
podman-compose -f podman-compose.production.yaml down -v

# 再起動
podman-compose -f podman-compose.production.yaml restart

# ログ確認
podman-compose -f podman-compose.production.yaml logs -f

# 状態確認
podman-compose -f podman-compose.production.yaml ps
```

## 🎯 シェルスクリプトが必要な場面

**シンプルなアプローチでは対応できない：**
- 自動的な依存関係インストール
- 複雑な権限設定の自動化
- エラーハンドリングと復旧
- 環境固有の設定調整
- SSL証明書の自動取得・更新設定

**シェルスクリプトが便利な場面：**
- 初回セットアップ時の環境構築
- ワンコマンドでの完全自動化
- エラー時の自動復旧
- 複数環境での標準化
