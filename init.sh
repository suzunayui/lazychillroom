#!/bin/bash
# LazyChillRoom 環境初期化スクリプト
# Usage: ./init.sh

set -e

echo "🔐 LazyChillRoom 環境を初期化中..."

# .env.productionファイルを生成
echo "📝 環境設定ファイルを生成中..."
cp .env.example .env.production

# セキュアなパスワードを生成
echo "🔒 セキュアなパスワードを生成中..."
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)

# パスワードを実際の値に置換
sed -i "s/CHANGE_THIS_IN_PRODUCTION/$DB_PASSWORD/g" .env.production
sed -i "s/CHANGE_THIS_REDIS_IN_PRODUCTION/$REDIS_PASSWORD/g" .env.production
sed -i "s/CHANGE_THIS_JWT_IN_PRODUCTION/$JWT_SECRET/g" .env.production

echo "✅ 環境初期化完了！"
echo "📋 生成されたパスワード情報:"
echo "   DB Password: $DB_PASSWORD"
echo "   Redis Password: $REDIS_PASSWORD"
echo "   JWT Secret: ${JWT_SECRET:0:20}... (64文字)"
echo ""
echo "🚀 デプロイを開始するには:"
echo "   podman-compose -f podman-compose.production.yaml up -d --build"
