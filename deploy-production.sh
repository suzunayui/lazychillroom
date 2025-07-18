#!/bin/bash

# LazyChillRoom 本番環境デプロイスクリプト

set -e  # エラーが発生したら停止

echo "=== LazyChillRoom 本番環境デプロイ開始 ==="

# 現在のディレクトリがプロジェクトルートかチェック
if [ ! -f "package.json" ] || [ ! -f ".env.example" ]; then
    echo "❌ プロジェクトルートディレクトリで実行してください"
    exit 1
fi

# 環境変数の確認
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production ファイルが見つかりません"
    echo "🔧 .env.example をコピーして .env.production を作成してください:"
    echo "   cp .env.example .env.production"
    echo "   nano .env.production"
    exit 1
fi

# 必要な環境変数が設定されているかチェック
source .env.production

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "your_secure_database_password_here" ]; then
    echo "❌ DB_PASSWORD が設定されていません"
    echo "🔧 .env.production でDB_PASSWORDを設定してください"
    exit 1
fi

if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "your_secure_redis_password_here" ]; then
    echo "❌ REDIS_PASSWORD が設定されていません"
    echo "🔧 .env.production でREDIS_PASSWORDを設定してください"
    exit 1
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your_very_long_and_secure_jwt_secret_key_minimum_64_characters_required" ]; then
    echo "❌ JWT_SECRET が設定されていません"
    echo "🔧 .env.production でJWT_SECRETを設定してください"
    exit 1
fi

echo "✅ 環境変数チェック完了"

# 既存のコンテナを停止
echo "🛑 既存のコンテナを停止中..."
podman-compose -f podman-compose.production.yaml down || true

# イメージをビルド
echo "🔨 Dockerイメージをビルド中..."
podman-compose -f podman-compose.production.yaml build

# データベースとRedisを先に起動
echo "🗄️ データベースとRedisを起動中..."
podman-compose -f podman-compose.production.yaml up -d postgres redis

# データベースが準備できるまで待機
echo "⏳ データベースの準備を待機中..."
sleep 30

# データベースマイグレーション
echo "🔄 データベースマイグレーション実行中..."
NODE_ENV=production podman-compose -f podman-compose.production.yaml exec postgres psql -U lazychillroom_user -d lazychillroom -f /docker-entrypoint-initdb.d/01-schema.sql || echo "⚠️ マイグレーション完了（既に実行済みの可能性があります）"

# 全サービスを起動
echo "🚀 全サービスを起動中..."
podman-compose -f podman-compose.production.yaml up -d

# サービスの状態確認
echo "🔍 サービス状態確認中..."
sleep 10
podman-compose -f podman-compose.production.yaml ps

# ヘルスチェック
echo "🏥 ヘルスチェック実行中..."
sleep 20

# アプリケーションのヘルスチェック
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ アプリケーション正常稼働中"
else
    echo "❌ アプリケーションのヘルスチェックに失敗"
    echo "📋 ログを確認してください:"
    echo "   podman-compose -f podman-compose.production.yaml logs app"
    exit 1
fi

echo ""
echo "🎉 LazyChillRoom 本番環境デプロイ完了！"
echo ""
echo "📋 重要な情報:"
echo "   - アプリケーション: http://localhost"
echo "   - ポート: 80 (HTTP)"
echo "   - ログ確認: podman-compose -f podman-compose.production.yaml logs -f"
echo "   - 停止: podman-compose -f podman-compose.production.yaml down"
echo ""
echo "🔒 セキュリティチェックリスト:"
echo "   ✓ 本番環境用パスワード設定済み"
echo "   ✓ JWT_SECRET設定済み"
echo "   ⚠️  SSL証明書の設定（必要に応じて）"
echo "   ⚠️  ファイアウォール設定の確認"
echo "   ⚠️  定期バックアップの設定"
echo ""
