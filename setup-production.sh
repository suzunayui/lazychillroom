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
        --help|-h)
            echo "LazyChillRoom 本番環境セットアップスクリプト"
            echo ""
            echo "使用方法:"
            echo "  $0 [オプション]"
            echo ""
            echo "オプション:"
            echo "  --auto, -a        完全自動モード（パスワード自動生成・デプロイ自動実行）"
            echo "  --skip-deploy     セットアップのみ実行（デプロイは実行しない）"
            echo "  --help, -h        このヘルプを表示"
            echo ""
            echo "例："
            echo "  curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --auto"
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
sudo apt update
sudo apt install -y curl wget git podman podman-compose nodejs npm ufw

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
sudo ufw --force enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

echo "✅ ファイアウォール設定完了"

# アップロードディレクトリの作成
echo "📁 アップロードディレクトリを作成中..."
mkdir -p uploads/files uploads/avatars logs backups

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
                echo "🌐 アプリケーションにアクセス: http://$(hostname -I | awk '{print $1}')"
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
