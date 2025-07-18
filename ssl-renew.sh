#!/bin/bash

# Let's Encrypt SSL証明書自動更新スクリプト
# cron で定期実行することを想定

set -e

PROJECT_DIR="$HOME/lazychillroom"
cd "$PROJECT_DIR"

# 環境変数読み込み
if [ -f ".env.production" ]; then
    source .env.production
else
    echo "❌ .env.production が見つかりません"
    exit 1
fi

if [ "$SSL_ENABLED" != "true" ] || [ -z "$DOMAIN" ]; then
    echo "ℹ️  SSL設定が無効またはドメインが設定されていません"
    exit 0
fi

echo "🔄 SSL証明書の更新確認: $DOMAIN"

# 証明書の有効期限確認（30日以内に期限切れの場合更新）
if sudo certbot renew --dry-run --cert-name "$DOMAIN"; then
    echo "🔍 証明書更新の確認中..."
    
    # 実際の更新実行
    if sudo certbot renew --cert-name "$DOMAIN"; then
        echo "🔄 証明書が更新されました。証明書をコピー中..."
        
        # 更新された証明書をプロジェクトディレクトリにコピー
        sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem
        sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem
        sudo chown $(whoami):$(whoami) nginx/ssl/cert.pem nginx/ssl/key.pem
        
        # Nginxコンテナを再起動
        echo "🔄 Nginxを再起動中..."
        podman-compose -f podman-compose.production.yaml restart nginx
        
        echo "✅ SSL証明書更新完了"
        
        # ログに記録
        echo "$(date): SSL certificate renewed for $DOMAIN" >> logs/ssl-renewal.log
    else
        echo "ℹ️  証明書は最新です（更新不要）"
    fi
else
    echo "⚠️  証明書更新チェックに失敗しました"
    exit 1
fi
