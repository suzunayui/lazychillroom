#!/bin/bash

# LazyChillRoom HTTPS対応完全自動デプロイスクリプト
# 使用方法: curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/auto-deploy-https.sh | bash -s -- your-domain.com

set -e

DOMAIN="$1"

if [ -z "$DOMAIN" ]; then
    echo "❌ ドメイン名を指定してください"
    echo "使用方法: $0 <domain>"
    echo "例: $0 example.com"
    exit 1
fi

echo "🤖 LazyChillRoom HTTPS完全自動デプロイ開始"
echo "🌐 ドメイン: $DOMAIN"
echo "   - パスワード自動生成"
echo "   - HTTPS自動設定"
echo "   - Let's Encrypt SSL証明書自動取得"
echo "   - ゼロタッチインストール"
echo ""

# DNS解決確認
echo "🔍 ドメインのDNS解決を確認中: $DOMAIN"
if ! nslookup "$DOMAIN" > /dev/null 2>&1; then
    echo "❌ ドメイン $DOMAIN のDNS解決に失敗しました"
    echo "Let's EncryptのSSL証明書取得にはDNSが正しく設定されている必要があります"
    echo ""
    echo "📋 必要な設定:"
    echo "   1. ドメインのAレコードでこのサーバーのIPアドレスを指定"
    echo "   2. DNSの反映を確認（dig $DOMAIN）"
    echo ""
    exit 1
fi

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
    echo "🔄 既存のデプロイメントを停止してHTTPS対応新規デプロイを実行します..."
    
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

# セットアップスクリプトをHTTPS対応の自動モードで実行
echo "🚀 完全自動セットアップを開始中..."
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --auto --domain "$DOMAIN"

echo ""
echo "🎊 HTTPS対応完全自動デプロイが完了しました！"
echo ""
echo "🌐 アプリケーションURL: https://$DOMAIN"
echo "🔒 SSL証明書: Let's Encrypt"
echo ""
echo "📋 管理コマンド:"
echo "   cd ~/lazychillroom"
echo "   ./maintenance.sh status      # 状態確認"
echo "   ./maintenance.sh logs        # ログ表示"
echo "   ./maintenance.sh monitor     # リアルタイム監視"
echo "   ./maintenance.sh backup      # バックアップ作成"
echo "   ./ssl-renew.sh              # SSL証明書手動更新"
echo ""
echo "🔄 SSL証明書自動更新設定:"
echo "   sudo crontab -e"
echo "   # 毎日午前2時に更新チェック"
echo "   0 2 * * * $HOME/lazychillroom/ssl-renew.sh"
echo ""
