#!/bin/bash
set -e  # エラー時に停止

# 色付きメッセージ用の関数
print_info() { echo -e "\033[34m[INFO]\033[0m $1"; }
print_success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
print_warning() { echo -e "\033[33m[WARNING]\033[0m $1"; }
print_error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

# プロジェクトの確認とクローン
print_info "プロジェクトディレクトリを確認中..."
if [ -d "lazychillroom" ]; then
    print_success "lazychillroomディレクトリが既に存在します"
    cd lazychillroom
    print_info "最新版に更新中..."
    git pull origin main || print_warning "git pullに失敗しました（続行します）"
else
    print_info "リポジトリをクローン中..."
    git clone https://github.com/suzunayui/lazychillroom.git
    cd lazychillroom
    print_success "リポジトリのクローンが完了しました"
fi

# 必要なディレクトリの作成
print_info "必要なディレクトリを作成中..."
mkdir -p uploads nginx/ssl nginx/logs

# 既存のコンテナ確認と停止
print_info "既存のコンテナを確認中..."
RUNNING_CONTAINERS=$(podman ps -q --filter "name=lazychillroom" | wc -l)

if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
    print_warning "実行中のlazychillroomコンテナを検出しました"
    print_info "既存のコンテナを停止・削除中..."
    
    # podman-compose down を試行
    if [ -f "podman-compose.production.yaml" ]; then
        podman-compose -f podman-compose.production.yaml down -v --remove-orphans || true
    fi
    
    # 開発版のコンテナも停止
    if [ -f "docker-compose.yml" ]; then
        podman-compose -f docker-compose.yml down -v --remove-orphans || true
    fi
    
    # 残っているlazychillroomコンテナを強制削除
    podman ps -aq --filter "name=lazychillroom" | xargs -r podman rm -f
    
    print_success "既存のコンテナを停止・削除しました"
else
    print_info "実行中のlazychillroomコンテナはありません"
fi

# 使用するcompose ファイルの決定
COMPOSE_FILE="podman-compose.production.yaml"
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "$COMPOSE_FILE が見つかりません"
    exit 1
fi

# DOMAIN環境変数の設定確認
print_info "デプロイメント設定を確認中..."
if [ -n "$DOMAIN" ]; then
    print_success "HTTPS環境でデプロイします: $DOMAIN"
    print_info "Let's Encrypt証明書が自動で取得されます"
else
    print_warning "DOMAIN環境変数が未設定です"
    print_info "HTTP環境（localhost）でデプロイします"
    print_info "HTTPS環境でデプロイする場合は以下を実行してください:"
    print_info "  export DOMAIN=your-domain.com"
    print_info "  ./deploy.sh"
fi

# Nginx設定ファイルの確認
if [ ! -f "nginx/nginx.conf" ]; then
    print_warning "nginx/nginx.conf が見つかりません"
    print_info "基本的なNginx設定ファイルを作成します..."
    
    mkdir -p nginx
    cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # HTTP サーバー
    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            proxy_pass http://app/health;
        }
    }

    # HTTPS サーバー（証明書がある場合）
    server {
        listen 443 ssl http2;
        server_name _;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_private_key /etc/nginx/ssl/privkey.pem;

        # SSL証明書が存在しない場合はこのサーバーブロックは無効
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        location /health {
            proxy_pass http://app/health;
        }
    }
}
EOF
    print_success "基本的なNginx設定ファイルを作成しました"
fi

# PostgreSQL初期化スクリプトの確認
if [ ! -f "migrations/postgresql-schema.sql" ]; then
    print_warning "migrations/postgresql-schema.sql が見つかりません"
    print_info "基本的なデータベーススキーマファイルを作成します..."
    
    mkdir -p migrations
    cat > migrations/postgresql-schema.sql << 'EOF'
-- LazyChillRoom Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Posts table  
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[],
    is_published BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, display_name, is_admin) 
VALUES (
    'admin', 
    'admin@localhost', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewS/Z3Z3Z3Z3Z3Z3', 
    'Administrator', 
    TRUE
) ON CONFLICT (username) DO NOTHING;
EOF
    print_success "基本的なデータベーススキーマファイルを作成しました"
fi

# スタックの起動
print_info "LazyChillRoomスタックを起動中..."
export COMPOSE_FILE="$COMPOSE_FILE"

# podman-compose設定の検証
print_info "Compose設定を検証中..."
if podman-compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
    print_success "Compose設定は正常です"
else
    print_error "Compose設定にエラーがあります"
    podman-compose -f "$COMPOSE_FILE" config
    exit 1
fi

# サービス起動
print_info "サービスを起動中..."
podman-compose -f "$COMPOSE_FILE" up -d

# 起動確認
print_info "サービスの起動状況を確認中..."
sleep 10

# ヘルスチェック
HEALTHY_SERVICES=0
TOTAL_SERVICES=0

for service in postgres redis app nginx; do
    TOTAL_SERVICES=$((TOTAL_SERVICES + 1))
    if podman-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1))
        print_success "$service サービスが正常に起動しています"
    else
        print_error "$service サービスの起動に失敗しました"
    fi
done

# 結果表示
echo ""
print_info "=== デプロイメント完了 ==="
print_success "$HEALTHY_SERVICES/$TOTAL_SERVICES サービスが起動中です"

if [ -n "$DOMAIN" ]; then
    print_info "🔒 HTTPS環境:"
    print_info "   https://$DOMAIN"
    print_info "   http://$DOMAIN (HTTPSへリダイレクト)"
else
    print_info "🌐 HTTP環境:"
    print_info "   http://localhost"
    print_info "   http://localhost:3000 (アプリ直接アクセス)"
fi

print_info ""
print_info "管理コマンド:"
print_info "  ログ確認: podman-compose -f $COMPOSE_FILE logs -f"
print_info "  停止: podman-compose -f $COMPOSE_FILE down"
print_info "  再起動: podman-compose -f $COMPOSE_FILE restart"
print_info "  状態確認: podman-compose -f $COMPOSE_FILE ps"

if [ "$HEALTHY_SERVICES" -eq "$TOTAL_SERVICES" ]; then
    print_success "🎉 LazyChillRoomが正常にデプロイされました！"
    exit 0
else
    print_warning "⚠️  一部のサービスに問題があります。ログを確認してください。"
    print_info "podman-compose -f $COMPOSE_FILE logs"
    exit 1
fi
