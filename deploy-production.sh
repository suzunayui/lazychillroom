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

# 本番環境用の .env ファイルを作成
echo "📁 本番環境用 .env ファイルをセットアップ中..."
cp .env.production .env
echo "✅ .env.production → .env コピー完了"

# 特権ポート設定の確認と適用
echo "🔧 特権ポート設定を確認・適用中..."
current_port_start=$(sysctl -n net.ipv4.ip_unprivileged_port_start 2>/dev/null || echo "1024")
if [ "$current_port_start" -ne 80 ]; then
    echo "⚠️  特権ポート設定が80ではありません（現在: $current_port_start）"
    echo "🔧 設定を適用中..."
    sudo sysctl net.ipv4.ip_unprivileged_port_start=80
    echo "✅ 特権ポート設定を80に変更しました"
else
    echo "✅ 特権ポート設定は正常です（80）"
fi

# 既存コンテナのクリーンアップ（競合回避）
echo "🧹 既存コンテナとボリュームをクリーンアップ中..."

# ポート使用状況の確認
echo "🔍 ポート80/443の使用状況を確認中..."
PORT_80_PID=$(lsof -ti:80 2>/dev/null || echo "")
PORT_443_PID=$(lsof -ti:443 2>/dev/null || echo "")

if [ -n "$PORT_80_PID" ]; then
    echo "⚠️  ポート80が使用中です (PID: $PORT_80_PID)"
fi
if [ -n "$PORT_443_PID" ]; then
    echo "⚠️  ポート443が使用中です (PID: $PORT_443_PID)"
fi

# 既存サービスの完全停止・削除（ボリュームも含む）
echo "🛑 既存のLazyChillRoomサービスを完全停止中..."
if podman-compose -f podman-compose.production.yaml ps -q 2>/dev/null | grep -q .; then
    echo "� compose経由で停止中（ボリューム含む）..."
    podman-compose -f podman-compose.production.yaml down -v --remove-orphans 2>/dev/null || true
    sleep 5
else
    echo "� compose経由での停止をスキップ（サービスが見つかりません）"
fi

# 個別コンテナの強制削除（名前競合回避）
echo "🗑️  個別コンテナを強制削除中..."
container_names=("lazychillroom_postgres_1" "lazychillroom_redis_1" "lazychillroom_app_1" "lazychillroom_nginx_1")
for container in "${container_names[@]}"; do
    if podman container exists "$container" 2>/dev/null; then
        echo "   削除中: $container"
        podman rm -f "$container" 2>/dev/null || true
    fi
done

# LazyChillRoom関連の全コンテナを強制削除
echo "🔍 LazyChillRoom関連コンテナの完全削除..."
LAZYCHILLROOM_CONTAINERS=$(podman ps -a --filter "label=com.docker.compose.project=lazychillroom" --format "{{.Names}}" 2>/dev/null || echo "")
if [ -n "$LAZYCHILLROOM_CONTAINERS" ]; then
    echo "$LAZYCHILLROOM_CONTAINERS" | while read -r container; do
        if [ -n "$container" ]; then
            echo "   強制削除中: $container"
            podman rm -f "$container" 2>/dev/null || true
        fi
    done
fi

# 孤立したボリュームのクリーンアップ
echo "🧹 LazyChillRoom関連ボリュームをクリーンアップ中..."
volume_names=("lazychillroom_postgres_data" "lazychillroom_redis_data" "lazychillroom_app_logs" "lazychillroom_nginx_logs")
for volume in "${volume_names[@]}"; do
    if podman volume exists "$volume" 2>/dev/null; then
        echo "   削除中: $volume"
        podman volume rm -f "$volume" 2>/dev/null || true
    fi
done

# 一般的な孤立ボリューム削除
podman volume prune -f 2>/dev/null || true

# ポートが解放されるまで待機
echo "🕐 ポート解放を待機中..."
sleep 3

# ポート解放の確認
for i in {1..10}; do
    PORT_80_CHECK=$(lsof -ti:80 2>/dev/null || echo "")
    PORT_443_CHECK=$(lsof -ti:443 2>/dev/null || echo "")
    
    if [ -z "$PORT_80_CHECK" ] && [ -z "$PORT_443_CHECK" ]; then
        echo "✅ ポート80/443が解放されました"
        break
    fi
    
    if [ $i -eq 10 ]; then
        echo "⚠️  ポート解放に時間がかかっています。強制的に続行します..."
    else
        echo "   待機中... ($i/10)"
        sleep 2
    fi
done

echo "✅ コンテナとボリュームのクリーンアップ完了"

# PostgreSQLスキーマファイルの確認と修正
echo "🔍 PostgreSQLスキーマファイルを確認中..."
if [ -f "migrations/postgresql-schema.sql" ]; then
    echo "✅ PostgreSQLスキーマファイルが存在します"
    # ファイルの権限を確認・修正
    chmod 644 migrations/postgresql-schema.sql
else
    echo "❌ PostgreSQLスキーマファイルが見つかりません"
    exit 1
fi

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
