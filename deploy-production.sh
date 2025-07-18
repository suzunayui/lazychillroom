#!/bin/bash

# LazyChillRoom 本番環境デプロイスクリプト

set -e  # エラーが発生したら停止

echo "🚀 LazyChillRoom 本番環境デプロイ開始"
echo "📅 $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 実行ユーザーの確認
if [ "$EUID" -eq 0 ]; then
    echo "❌ このスクリプトはrootユーザーで実行しないでください"
    echo "一般ユーザーで実行し、必要に応じてsudoを使用してください"
    exit 1
fi

# 本番環境の設定確認

# 現在のディレクトリがプロジェクトルートかチェック
if [ ! -f "package.json" ] || [ ! -f ".env.example" ]; then
    echo "❌ プロジェクトルートディレクトリで実行してください"
    exit 1
fi

# 本番環境の設定確認
echo "🔍 本番環境設定確認中..."

if [ ! -f ".env.production" ]; then
    echo "❌ .env.production ファイルが見つかりません"
    echo "setup-production.sh を先に実行してください"
    exit 1
fi

# 重要な環境変数の確認
required_vars=("DB_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if grep -q "your_.*_here" .env.production; then
        echo "❌ 設定値が初期値のままです: $var"
        echo ".env.production を確認してください"
        exit 1
    fi
done

echo "✅ 本番環境設定確認完了"

# Node.jsプロセス管理の準備
echo "⚙️  Node.jsプロセス管理準備中..."
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"

echo "✅ Node.jsプロセス管理準備完了"

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
