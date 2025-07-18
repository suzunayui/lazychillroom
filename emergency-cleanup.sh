#!/bin/bash

# LazyChillRoom 緊急クリーンアップスクリプト
# 全てのLazyChillRoom関連リソースを強制削除します

set -e

echo "🚨 LazyChillRoom 緊急クリーンアップ開始"
echo "⚠️  全てのLazyChillRoomデータが削除されます！"
echo ""

# 確認プロンプト
echo "本当に全てのLazyChillRoomリソースを削除しますか？ (yes/NO)"
read -r response

if [[ "$response" != "yes" ]]; then
    echo "❌ クリーンアップがキャンセルされました"
    exit 0
fi

echo "🛑 全LazyChillRoomサービス停止中..."

# プロジェクトディレクトリに移動
if [ -d "$HOME/lazychillroom" ]; then
    cd "$HOME/lazychillroom"
    
    # compose経由での停止
    podman-compose -f podman-compose.production.yaml down -v --remove-orphans 2>/dev/null || true
fi

echo "🗑️  全LazyChillRoomコンテナ削除中..."
# LazyChillRoom関連の全コンテナを検索・削除
CONTAINERS=$(podman ps -a --filter "label=com.docker.compose.project=lazychillroom" --format "{{.Names}}" 2>/dev/null || echo "")
if [ -n "$CONTAINERS" ]; then
    echo "$CONTAINERS" | while read -r container; do
        if [ -n "$container" ]; then
            echo "   削除中: $container"
            podman rm -f "$container" 2>/dev/null || true
        fi
    done
fi

# 個別名前での削除も実行
container_names=("lazychillroom_postgres_1" "lazychillroom_redis_1" "lazychillroom_app_1" "lazychillroom_nginx_1")
for container in "${container_names[@]}"; do
    if podman container exists "$container" 2>/dev/null; then
        echo "   強制削除: $container"
        podman rm -f "$container" 2>/dev/null || true
    fi
done

echo "🗑️  全LazyChillRoomボリューム削除中..."
# LazyChillRoom関連ボリュームの削除
VOLUMES=$(podman volume ls --filter "label=com.docker.compose.project=lazychillroom" --format "{{.Name}}" 2>/dev/null || echo "")
if [ -n "$VOLUMES" ]; then
    echo "$VOLUMES" | while read -r volume; do
        if [ -n "$volume" ]; then
            echo "   削除中: $volume"
            podman volume rm -f "$volume" 2>/dev/null || true
        fi
    done
fi

# 個別名前での削除も実行
volume_names=("lazychillroom_postgres_data" "lazychillroom_redis_data" "lazychillroom_app_logs" "lazychillroom_nginx_logs")
for volume in "${volume_names[@]}"; do
    if podman volume exists "$volume" 2>/dev/null; then
        echo "   強制削除: $volume"
        podman volume rm -f "$volume" 2>/dev/null || true
    fi
done

echo "🗑️  LazyChillRoomネットワーク削除中..."
# LazyChillRoom関連ネットワークの削除
NETWORKS=$(podman network ls --filter "name=lazychillroom" --format "{{.Name}}" 2>/dev/null || echo "")
if [ -n "$NETWORKS" ]; then
    echo "$NETWORKS" | while read -r network; do
        if [ -n "$network" ] && [ "$network" != "lazychillroom_default" ]; then
            echo "   削除中: $network"
            podman network rm "$network" 2>/dev/null || true
        fi
    done
fi

# デフォルトネットワークも削除
podman network rm lazychillroom_default 2>/dev/null || true

echo "🧹 システム全体クリーンアップ中..."
# 孤立したリソースのクリーンアップ
podman system prune -af --volumes 2>/dev/null || true

echo "🔍 ポート使用状況確認中..."
# ポート80/443の使用状況確認
PORT_80_PID=$(lsof -ti:80 2>/dev/null || echo "")
PORT_443_PID=$(lsof -ti:443 2>/dev/null || echo "")

if [ -n "$PORT_80_PID" ]; then
    echo "⚠️  ポート80がまだ使用中です (PID: $PORT_80_PID)"
    echo "   プロセス詳細: $(ps -p $PORT_80_PID -o comm= 2>/dev/null || echo '不明')"
fi

if [ -n "$PORT_443_PID" ]; then
    echo "⚠️  ポート443がまだ使用中です (PID: $PORT_443_PID)"
    echo "   プロセス詳細: $(ps -p $PORT_443_PID -o comm= 2>/dev/null || echo '不明')"
fi

if [ -z "$PORT_80_PID" ] && [ -z "$PORT_443_PID" ]; then
    echo "✅ ポート80/443は解放されています"
fi

echo ""
echo "✅ LazyChillRoom緊急クリーンアップ完了！"
echo ""
echo "📋 新規デプロイを実行するには:"
echo "   cd ~/lazychillroom"
echo "   ./deploy-production.sh"
echo ""
