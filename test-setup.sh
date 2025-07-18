#!/bin/bash

# LazyChillRoom 本番環境セットアップスクリプト (Ubuntu 24.04)
# 使用方法: 
#   curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash
#   または
#   curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --auto

set -e  # エラーが発生したら停止

# 引数処理
AUTO_MODE=false
SKIP_DEPLOY=false
DOMAIN=""
ENABLE_HTTPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto|-a)
            AUTO_MODE=true
            shift
            ;;
        --skip-deploy)
            SKIP_DEPLOY=true
            shift
            ;;
        --domain|-d)
            DOMAIN="$2"
            ENABLE_HTTPS=true
            shift 2
            ;;
        --help|-h)
            echo "LazyChillRoom 本番環境セットアップスクリプト"
            echo ""
            echo "使用方法:"
            echo "  $0 [オプション]"
            echo ""
            echo "オプション:"
            echo "  --auto, -a            完全自動モード（パスワード自動生成・デプロイ自動実行）"
            echo "  --domain, -d DOMAIN   ドメイン名を指定してHTTPS設定（Let's Encrypt）"
            echo "  --skip-deploy         セットアップのみ実行（デプロイは実行しない）"
            echo "  --help, -h            このヘルプを表示"
            echo ""
            echo "例："
            echo "  curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --auto"
            echo "  curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --domain example.com --auto"
            exit 0
            ;;
        *)
            echo "不明なオプション: $1"
            echo "ヘルプを表示するには --help を使用してください"
            exit 1
            ;;
    esac
done

echo "🚀 LazyChillRoom 本番環境セットアップ開始"
echo "対象OS: Ubuntu 24.04"
if [ "$AUTO_MODE" = true ]; then
    echo "🤖 完全自動モードで実行中..."
fi
if [ "$ENABLE_HTTPS" = true ]; then
    echo "🔒 HTTPS設定: $DOMAIN"
fi
echo ""

# 実行ユーザーの確認
if [ "$EUID" -eq 0 ]; then
    echo "❌ このスクリプトはrootユーザーで実行しないでください"
    echo "一般ユーザーで実行し、必要に応じてsudoを使用してください"
    exit 1
fi

# システム情報の表示
echo "📋 システム情報:"
echo "   OS: $(lsb_release -d | cut -f2)"
echo "   ユーザー: $(whoami)"
echo "   ホームディレクトリ: $HOME"
echo ""

# 必要なパッケージのインストール
echo "📦 必要なパッケージをインストール中..."
if [ "$ENABLE_HTTPS" = true ]; then
    sudo apt update
    sudo apt install -y curl wget git podman podman-compose nodejs npm ufw certbot python3-certbot-nginx
else
    sudo apt update
    sudo apt install -y curl wget git podman podman-compose nodejs npm ufw
fi

echo "✅ パッケージインストール完了"

# Node.jsのバージョン確認
NODE_VERSION=$(node --version | cut -c 2-)
REQUIRED_VERSION="22.0.0"

echo "📋 Node.js バージョン: $NODE_VERSION"

# バージョン比較（簡易版）
if dpkg --compare-versions "$NODE_VERSION" "lt" "$REQUIRED_VERSION"; then
    echo "⚠️  Node.js v$REQUIRED_VERSION 以上が必要です"
    echo "🔧 Node.js v22をインストール中..."
    
    # NodeSourceリポジトリを追加
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    echo "✅ Node.js v22 インストール完了"
fi

# LazyChillRoomのクローン
PROJECT_DIR="$HOME/lazychillroom"

if [ -d "$PROJECT_DIR" ]; then
    echo "📁 既存のプロジェクトディレクトリを検出: $PROJECT_DIR"
    echo "🔄 最新版を取得中..."
    cd "$PROJECT_DIR"
    git pull origin main
else
    echo "📥 LazyChillRoomをクローン中..."
    cd "$HOME"
    git clone https://github.com/suzunayui/lazychillroom.git
    cd "$PROJECT_DIR"
fi

# パスワード生成関数
generate_secure_password() {
    # 32文字のランダムパスワードを生成（英数字+記号）
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

generate_jwt_secret() {
    # 64文字のJWTシークレットを生成
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
}

# 環境設定ファイルの作成
echo "⚙️  環境設定ファイルをセットアップ中..."

if [ ! -f ".env.production" ]; then
    if [ -f ".env.example" ]; then
        echo "🔐 セキュアなパスワードを生成中..."
        
        # セキュアなパスワードを生成
        DB_PASSWORD=$(generate_secure_password)
        REDIS_PASSWORD=$(generate_secure_password)
        JWT_SECRET=$(generate_jwt_secret)
        
        echo "✅ セキュアなパスワードを生成しました"
        
        # .env.exampleをコピーしてパスワードを置換
        cp .env.example .env.production
        
        # 生成されたパスワードで置換
        sed -i "s/your_secure_database_password_here/${DB_PASSWORD}/g" .env.production
        sed -i "s/your_secure_redis_password_here/${REDIS_PASSWORD}/g" .env.production
        sed -i "s/your_very_long_and_secure_jwt_secret_key_minimum_64_characters_required/${JWT_SECRET}/g" .env.production
        
        # ドメイン設定
        if [ "$ENABLE_HTTPS" = true ]; then
            sed -i "s/# DOMAIN=your-domain.com/DOMAIN=$DOMAIN/g" .env.production
            sed -i "s/# SSL_ENABLED=true/SSL_ENABLED=true/g" .env.production
            echo "✅ ドメイン設定を追加: $DOMAIN"
        fi
        
        echo "✅ .env.production を自動設定しました"
        echo ""
        echo "🔒 生成されたパスワード情報:"
        echo "   DB_PASSWORD: ${DB_PASSWORD:0:8}... (32文字)"
        echo "   REDIS_PASSWORD: ${REDIS_PASSWORD:0:8}... (32文字)"
        echo "   JWT_SECRET: ${JWT_SECRET:0:8}... (64文字)"
        echo ""
        echo "⚠️  これらのパスワードは自動生成されました。"
        echo "   必要に応じて .env.production を編集してください。"
        echo ""
        
        if [ "$AUTO_MODE" = false ]; then
            echo "🔧 設定ファイルを確認・編集しますか？ (y/N)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                nano .env.production
            fi
        else
            echo "🤖 自動モードのため設定ファイル編集をスキップします"
        fi
    else
        echo "❌ .env.example ファイルが見つかりません"
        exit 1
    fi
else
    echo "✅ .env.production は既に存在します"
    
    # 既存ファイルのパスワードが初期値のままかチェック
    if grep -q "your_secure_database_password_here" .env.production; then
        echo "⚠️  既存の .env.production に初期値のパスワードが含まれています"
        
        if [ "$AUTO_MODE" = false ]; then
            echo "🔧 パスワードを自動生成して更新しますか？ (y/N)"
            read -r response
            auto_update_response="$response"
        else
            echo "🤖 自動モードのため、パスワードを自動更新します"
            auto_update_response="y"
        fi
        
        if [[ "$auto_update_response" =~ ^[Yy]$ ]]; then
            echo "🔐 新しいパスワードを生成中..."
            
            DB_PASSWORD=$(generate_secure_password)
            REDIS_PASSWORD=$(generate_secure_password)
            JWT_SECRET=$(generate_jwt_secret)
            
            sed -i "s/your_secure_database_password_here/${DB_PASSWORD}/g" .env.production
            sed -i "s/your_secure_redis_password_here/${REDIS_PASSWORD}/g" .env.production
            sed -i "s/your_very_long_and_secure_jwt_secret_key_minimum_64_characters_required/${JWT_SECRET}/g" .env.production
            
            echo "✅ パスワードを自動更新しました"
            echo "🔒 新しいパスワード情報:"
            echo "   DB_PASSWORD: ${DB_PASSWORD:0:8}... (32文字)"
            echo "   REDIS_PASSWORD: ${REDIS_PASSWORD:0:8}... (32文字)"
            echo "   JWT_SECRET: ${JWT_SECRET:0:8}... (64文字)"
        fi
    fi
fi

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

# ファイアウォール設定
echo "🔒 ファイアウォール設定中..."
echo "📋 UFWでポートを開放中..."

# UFWが有効でない場合は有効化
if ! sudo ufw status | grep -q "Status: active"; then
    echo "🛡️  UFWを有効化中..."
    sudo ufw --force enable
fi

# 必要なポートを開放
echo "🔓 SSH (22/tcp) を開放中..."
sudo ufw allow 22/tcp comment 'SSH'

echo "🌐 HTTP (80/tcp) を開放中..."
sudo ufw allow 80/tcp comment 'HTTP for LazyChillRoom'

if [ "$ENABLE_HTTPS" = true ]; then
    echo "🔒 HTTPS (443/tcp) を開放中..."
    sudo ufw allow 443/tcp comment 'HTTPS for LazyChillRoom'
    echo "✅ HTTPS用ポート443が開放されました"
else
    echo "🔒 HTTPS (443/tcp) を開放中（将来のHTTPS用）..."
    sudo ufw allow 443/tcp comment 'HTTPS for LazyChillRoom (future use)'
fi

# ファイアウォール状態の確認
echo "📊 ファイアウォール設定確認:"
sudo ufw status numbered

echo "✅ ファイアウォール設定完了"

# アップロードディレクトリの作成
echo "📁 アップロードディレクトリを作成中..."
mkdir -p uploads/files uploads/avatars logs backups

# SSL証明書の設定（ドメインが指定された場合）
if [ "$ENABLE_HTTPS" = true ] && [ -n "$DOMAIN" ]; then
    echo "🔒 SSL証明書をセットアップ中..."
    
    # ドメインのDNS解決確認
    echo "🔍 ドメインのDNS解決を確認中: $DOMAIN"
    if ! nslookup "$DOMAIN" > /dev/null 2>&1; then
        echo "⚠️  警告: ドメイン $DOMAIN のDNS解決に失敗しました"
        echo "   Let's Encryptの証明書取得にはDNSが正しく設定されている必要があります"
        
        if [ "$AUTO_MODE" = false ]; then
            echo "🔧 SSL設定をスキップしますか？ (y/N)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                ENABLE_HTTPS=false
                echo "⏭️  SSL設定をスキップしました"
            fi
        else
            echo "🤖 自動モードのため、SSL設定をスキップします"
            ENABLE_HTTPS=false
        fi
    fi
    
    if [ "$ENABLE_HTTPS" = true ]; then
        # SSL証明書ディレクトリの作成
        mkdir -p nginx/ssl
        
        # Nginxの設定でHTTPS用に更新
        echo "⚙️  Nginx設定をHTTPS用に更新中..."
        
        # nginx.confのHTTPS設定部分をアンコメント
        sed -i "s/# server {/server {/g" nginx/nginx.conf
        sed -i "s/# listen 443 ssl http2;/listen 443 ssl http2;/g" nginx/nginx.conf
        sed -i "s/# server_name your-domain.com;/server_name $DOMAIN;/g" nginx/nginx.conf
        sed -i "s|# ssl_certificate /etc/nginx/ssl/cert.pem;|ssl_certificate /etc/nginx/ssl/cert.pem;|g" nginx/nginx.conf
        sed -i "s|# ssl_certificate_key /etc/nginx/ssl/key.pem;|ssl_certificate_key /etc/nginx/ssl/key.pem;|g" nginx/nginx.conf
        sed -i "s/# ssl_session_timeout 1d;/ssl_session_timeout 1d;/g" nginx/nginx.conf
        sed -i "s/# ssl_session_cache shared:MozTLS:10m;/ssl_session_cache shared:MozTLS:10m;/g" nginx/nginx.conf
        sed -i "s/# ssl_session_tickets off;/ssl_session_tickets off;/g" nginx/nginx.conf
        sed -i "s/# ssl_protocols TLSv1.2 TLSv1.3;/ssl_protocols TLSv1.2 TLSv1.3;/g" nginx/nginx.conf
        sed -i "s/# ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;/ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;/g" nginx/nginx.conf
        sed -i "s/# ssl_prefer_server_ciphers off;/ssl_prefer_server_ciphers off;/g" nginx/nginx.conf
        sed -i "s/# add_header Strict-Transport-Security \"max-age=63072000\" always;/add_header Strict-Transport-Security \"max-age=63072000\" always;/g" nginx/nginx.conf
        
        # HTTPからHTTPSへのリダイレクトを有効化
        sed -i "s/# return 301 https:\/\/\$server_name\$request_uri;/return 301 https:\/\/$DOMAIN\$request_uri;/g" nginx/nginx.conf
        sed -i "s/# 開発\/テスト用にHTTPで直接処理/# HTTPからHTTPSへのリダイレクト/g" nginx/nginx.conf
        
        # location ブロックをコメントアウト（HTTPSに移行するため）
        sed -i '/# HTTPからHTTPSへのリダイレクト/,${ /location \//,/^        }$/s/^/# /; }' nginx/nginx.conf
        
        echo "✅ Nginx設定をHTTPS用に更新しました"
        
        # SSL証明書の取得をデプロイ後に行う設定
        echo "📝 SSL証明書は初回デプロイ後に取得されます"
        
        # SSL証明書取得スクリプトを作成
        cat > ssl-setup.sh << 'EOF'
#!/bin/bash

set -e

DOMAIN="$1"
if [ -z "$DOMAIN" ]; then
    echo "❌ ドメインが指定されていません"
    echo "使用方法: $0 <domain>"
    exit 1
fi

echo "🔒 Let's EncryptでSSL証明書を取得中: $DOMAIN"

# Nginxコンテナ内でcertbotを実行
echo "📋 SSL証明書取得中..."

# 一時的にHTTP版でNginxを起動（証明書取得のため）
sudo certbot certonly \
    --standalone \
    --preferred-challenges http \
    --http-01-port 80 \
    --email admin@$DOMAIN \
    --agree-tos \
    --no-eff-email \
    --domains $DOMAIN

# 証明書をプロジェクトディレクトリにコピー
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem
sudo chown $(whoami):$(whoami) nginx/ssl/cert.pem nginx/ssl/key.pem

echo "✅ SSL証明書取得完了"

# Nginxサービスを再起動
echo "🔄 Nginxを再起動中..."
podman-compose -f podman-compose.production.yaml restart nginx

echo "🎉 HTTPS設定完了！"
echo "🌐 https://$DOMAIN でアクセス可能です"
EOF
        chmod +x ssl-setup.sh
        
        echo "✅ SSL証明書取得スクリプトを作成しました: ssl-setup.sh"
    fi
fi

# セットアップ完了
echo ""
echo "🎉 LazyChillRoom セットアップ完了！"
echo ""

# 自動デプロイ実行の確認
if [ "$SKIP_DEPLOY" = false ]; then
    if [ "$AUTO_MODE" = true ]; then
        echo "🤖 自動モードのため、デプロイを自動実行します..."
        if ./deploy-production.sh; then
            echo ""
            echo "� デプロイが正常に完了しました！"
            echo "🌐 アプリケーションにアクセス: http://$(hostname -I | awk '{print $1}')"
        else
            echo "❌ デプロイに失敗しました。ログを確認してください。"
            exit 1
        fi
    else
        echo "🚀 デプロイを実行しますか？ (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            if ./deploy-production.sh; then
                echo ""
                echo "🚀 デプロイが正常に完了しました！"
                
                # SSL証明書の取得確認
                if [ "$ENABLE_HTTPS" = true ] && [ -n "$DOMAIN" ]; then
                    echo "🔒 SSL証明書を取得しますか？ (y/N)"
                    read -r ssl_response
                    if [[ "$ssl_response" =~ ^[Yy]$ ]]; then
                        # サービスが完全に起動するまで待機
                        sleep 30
                        # 一時的にHTTPサービスを停止
                        podman-compose -f podman-compose.production.yaml stop nginx
                        # SSL証明書を取得
                        if ./ssl-setup.sh "$DOMAIN"; then
                            echo "✅ SSL証明書取得完了"
                            echo "🌐 https://$DOMAIN でアクセス可能です"
                        else
                            echo "⚠️  SSL証明書取得に失敗しました。手動で実行してください:"
                            echo "   ./ssl-setup.sh $DOMAIN"
                            echo "🌐 http://$(hostname -I | awk '{print $1}') でアクセス可能です"
                        fi
                    else
                        echo "📋 SSL証明書を後で取得する場合:"
                        echo "   ./ssl-setup.sh $DOMAIN"
                        echo "🌐 http://$(hostname -I | awk '{print $1}') でアクセス可能です"
                    fi
                else
                    echo "🌐 アプリケーションにアクセス: http://$(hostname -I | awk '{print $1}')"
                fi
            else
                echo "❌ デプロイに失敗しました。手動で実行してください:"
                echo "   ./deploy-production.sh"
            fi
        else
            echo "📋 手動でデプロイを実行する場合:"
            echo "   cd $PROJECT_DIR"
            echo "   ./deploy-production.sh"
        fi
    fi
else
    echo "⏭️  デプロイはスキップされました"
fi

if [ "$SKIP_DEPLOY" = false ] && [ "$AUTO_MODE" = false ]; then
    echo ""
    echo "�📋 次のステップ:"
    echo "   1. 環境設定の確認:"
    echo "      nano $PROJECT_DIR/.env.production"
    echo ""
    echo "   2. デプロイ実行:"
    echo "      cd $PROJECT_DIR"
    echo "      ./deploy-production.sh"
    echo ""
    echo "   3. 状態確認:"
    echo "      ./maintenance.sh status"
    echo ""
    echo "   4. アクセス:"
    echo "      http://$(hostname -I | awk '{print $1}')"
    echo ""
fi
echo "🔧 利用可能なコマンド:"
echo "   npm run prod:deploy  - デプロイ実行"
echo "   npm run prod:status  - 状態確認"
echo "   npm run prod:logs    - ログ表示"
echo "   npm run prod:backup  - バックアップ作成"
echo "   npm run prod:monitor - リアルタイム監視"
echo ""
echo "📖 詳細な手順: https://github.com/suzunayui/lazychillroom/blob/main/DEPLOYMENT.md"
echo ""

# 環境設定の確認
echo "🔍 設定確認:"
if grep -q "your_secure_database_password_here" .env.production; then
    echo "⚠️  データベースパスワードが初期値のままです"
fi

if grep -q "your_secure_redis_password_here" .env.production; then
    echo "⚠️  Redisパスワードが初期値のままです"
fi

if grep -q "your_very_long_and_secure_jwt_secret" .env.production; then
    echo "⚠️  JWT_SECRETが初期値のままです"
fi

echo ""
echo "✨ セットアップ完了です！上記の設定を確認してからデプロイを実行してください。"
