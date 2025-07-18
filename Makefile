# LazyChillRoom Makefile
# シンプルなデプロイと管理コマンド

.PHONY: help setup deploy up down restart logs status clean

# デフォルトターゲット
help:
	@echo "LazyChillRoom 管理コマンド"
	@echo ""
	@echo "利用可能なコマンド:"
	@echo "  make setup     - 初回セットアップ（パスワード生成、.env作成）"
	@echo "  make deploy    - アプリケーションデプロイ"
	@echo "  make up        - サービス開始"
	@echo "  make down      - サービス停止"
	@echo "  make restart   - サービス再起動"
	@echo "  make logs      - ログ表示"
	@echo "  make status    - 状態確認"
	@echo "  make clean     - 完全クリーンアップ（ボリューム削除）"

# 初回セットアップ
setup:
	@echo "🔐 セキュアなパスワードを生成中..."
	@DB_PASSWORD=$$(openssl rand -base64 48 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-32); \
	REDIS_PASSWORD=$$(openssl rand -base64 48 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-32); \
	JWT_SECRET=$$(openssl rand -base64 96 | tr -d "=+/|" | tr -cd 'A-Za-z0-9' | cut -c1-64); \
	echo "NODE_ENV=production" > .env.production; \
	echo "PORT=3000" >> .env.production; \
	echo "DB_HOST=postgres" >> .env.production; \
	echo "DB_PORT=5432" >> .env.production; \
	echo "DB_USER=lazychillroom_user" >> .env.production; \
	echo "DB_PASSWORD=$$DB_PASSWORD" >> .env.production; \
	echo "DB_NAME=lazychillroom" >> .env.production; \
	echo "POSTGRES_USER=lazychillroom_user" >> .env.production; \
	echo "POSTGRES_PASSWORD=$$DB_PASSWORD" >> .env.production; \
	echo "POSTGRES_DB=lazychillroom" >> .env.production; \
	echo "REDIS_HOST=redis" >> .env.production; \
	echo "REDIS_PORT=6379" >> .env.production; \
	echo "REDIS_PASSWORD=$$REDIS_PASSWORD" >> .env.production; \
	echo "REDIS_DB=0" >> .env.production; \
	echo "JWT_SECRET=$$JWT_SECRET" >> .env.production; \
	echo "UPLOAD_PATH=./uploads" >> .env.production; \
	echo "MAX_FILE_SIZE=10485760" >> .env.production; \
	echo "ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp,mp4,webm,pdf,txt,docx" >> .env.production; \
	echo "RATE_LIMIT_WINDOW_MS=60000" >> .env.production; \
	echo "RATE_LIMIT_MAX_REQUESTS=100" >> .env.production; \
	echo "BCRYPT_ROUNDS=12" >> .env.production; \
	echo "TRUST_PROXY=true" >> .env.production; \
	echo "SECURE_COOKIES=true" >> .env.production; \
	echo "SESSION_SECURE=true" >> .env.production
	@echo "✅ .env.production ファイルが生成されました"

# アプリケーションデプロイ
deploy: setup
	@echo "🚀 LazyChillRoom をデプロイ中..."
	podman-compose -f podman-compose.production.yaml up -d --build
	@echo "✅ デプロイ完了"
	@echo "🌐 アプリケーションURL: http://localhost"

# サービス開始
up:
	@echo "🚀 サービスを開始中..."
	podman-compose -f podman-compose.production.yaml up -d

# サービス停止
down:
	@echo "🛑 サービスを停止中..."
	podman-compose -f podman-compose.production.yaml down

# サービス再起動
restart:
	@echo "🔄 サービスを再起動中..."
	podman-compose -f podman-compose.production.yaml restart

# ログ表示
logs:
	podman-compose -f podman-compose.production.yaml logs -f

# 状態確認
status:
	@echo "📊 サービス状態:"
	podman-compose -f podman-compose.production.yaml ps
	@echo ""
	@echo "🔍 ヘルスチェック:"
	@curl -s http://localhost/health || echo "❌ サービスに接続できません"

# 完全クリーンアップ
clean:
	@echo "🧹 完全クリーンアップを実行中..."
	podman-compose -f podman-compose.production.yaml down -v
	@echo "✅ クリーンアップ完了"

# ワンコマンドセットアップ（新規環境用）
install:
	@echo "📦 システムパッケージを確認中..."
	@command -v podman >/dev/null 2>&1 || (echo "❌ Podmanが必要です: sudo apt install -y podman podman-compose" && exit 1)
	@command -v podman-compose >/dev/null 2>&1 || (echo "❌ podman-composeが必要です: sudo apt install -y podman-compose" && exit 1)
	@echo "✅ 必要なパッケージが確認されました"
	@$(MAKE) deploy
