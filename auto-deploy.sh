#!/bin/bash

# LazyChillRoom 完全自動デプロイスクリプト
# 使用方法: curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/auto-deploy.sh | bash

set -e

echo "🤖 LazyChillRoom 完全自動デプロイ開始"
echo "   - パスワード自動生成"
echo "   - 自動デプロイ実行"
echo "   - ゼロタッチインストール"
echo ""

# 既存プロセスの確認
echo "🔍 既存のLazyChillRoomプロセスを確認中..."

# LazyChillRoomコンテナが実行中かチェック
RUNNING_CONTAINERS=$(podman ps --filter "label=com.docker.compose.project=lazychillroom" --format "{{.Names}}" 2>/dev/null || echo "")

if [ -n "$RUNNING_CONTAINERS" ]; then
    echo "⚠️  既存のLazyChillRoomコンテナが実行中です:"
    echo "$RUNNING_CONTAINERS" | while read -r container; do
        echo "   - $container"
    done
    echo ""
    echo "🔄 既存のデプロイメントを停止して新規デプロイを実行します..."
    
    # プロジェクトディレクトリに移動（あれば）
    if [ -d "$HOME/lazychillroom" ]; then
        cd "$HOME/lazychillroom"
        echo "🛑 既存サービスを停止中..."
        podman-compose -f podman-compose.production.yaml down -v 2>/dev/null || true
        echo "✅ 既存サービス停止完了"
    else
        echo "🗑️  個別コンテナを停止中..."
        echo "$RUNNING_CONTAINERS" | while read -r container; do
            podman rm -f "$container" 2>/dev/null || true
        done
    fi
    
    echo "🧹 関連ボリュームをクリーンアップ中..."
    podman volume ls --filter "label=com.docker.compose.project=lazychillroom" --format "{{.Name}}" 2>/dev/null | while read -r volume; do
        if [ -n "$volume" ]; then
            podman volume rm -f "$volume" 2>/dev/null || true
        fi
    done
    
    sleep 3
else
    echo "✅ 既存のLazyChillRoomプロセスは見つかりませんでした"
fi

echo ""

# セットアップスクリプトを自動モードで実行
echo "🚀 完全自動セットアップを開始中..."
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --auto

echo ""
echo "🎊 完全自動デプロイが完了しました！"
echo ""
echo "🌐 アプリケーションURL: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "📋 管理コマンド:"
echo "   cd ~/lazychillroom"
echo "   ./maintenance.sh status    # 状態確認"
echo "   ./maintenance.sh logs      # ログ表示"
echo "   ./maintenance.sh monitor   # リアルタイム監視"
echo "   ./maintenance.sh backup    # バックアップ作成"
echo ""
