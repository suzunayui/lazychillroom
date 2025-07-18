#!/bin/bash
set -e

# 色付きメッセージ用の関数
print_info() { echo -e "\033[34m[INFO]\033[0m $1"; }
print_success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
print_warning() { echo -e "\033[33m[WARNING]\033[0m $1"; }
print_error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

# 使用方法
usage() {
    echo "SSL証明書取得スクリプト"
    echo ""
    echo "使用方法:"
    echo "  $0 <domain> [method]"
    echo ""
    echo "Parameters:"
    echo "  domain  - 証明書を取得するドメイン名"
    echo "  method  - 取得方法 (standalone|dns|webroot) [デフォルト: standalone]"
    echo ""
    echo "例:"
    echo "  $0 example.com standalone    # スタンドアロンモード"
    echo "  $0 example.com dns          # DNS認証"
    echo "  $0 example.com webroot      # Webroot モード"
    echo ""
    echo "環境変数:"
    echo "  EMAIL   - Let's Encryptに登録するメールアドレス"
    echo "  WEBROOT - Webroot モード時のドキュメントルート [デフォルト: /var/www/html]"
}

# パラメータチェック
if [ $# -lt 1 ]; then
    usage
    exit 1
fi

DOMAIN="$1"
METHOD="${2:-standalone}"
EMAIL="${EMAIL:-admin@$DOMAIN}"
WEBROOT="${WEBROOT:-/var/www/html}"

print_info "SSL証明書取得スクリプト"
print_info "ドメイン: $DOMAIN"
print_info "方法: $METHOD"
print_info "メール: $EMAIL"

# ディレクトリ作成
mkdir -p nginx/ssl

# 既存の証明書確認
if [ -f "nginx/ssl/fullchain.pem" ] && [ -f "nginx/ssl/privkey.pem" ]; then
    print_warning "既存の証明書が見つかりました"
    print_info "上書きしますか？ [y/N]"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_info "処理を中断しました"
        exit 0
    fi
fi

case $METHOD in
    standalone)
        print_info "スタンドアロンモードで証明書を取得します"
        print_warning "ポート80が空いている必要があります"
        
        # 既存のコンテナでポート80を使用しているものを停止
        print_info "ポート80を使用している可能性のあるコンテナを停止中..."
        podman stop $(podman ps -q --filter "publish=80") 2>/dev/null || true
        
        # Certbotコンテナで証明書取得
        podman run --rm -it \
            -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
            -p 80:80 \
            docker.io/certbot/certbot:latest \
            certonly --standalone --non-interactive --agree-tos \
            --email "$EMAIL" \
            -d "$DOMAIN" || {
            print_error "証明書取得に失敗しました"
            exit 1
        }
        ;;
    
    dns)
        print_info "DNS認証モードで証明書を取得します"
        print_warning "DNSレコードの手動設定が必要です"
        
        podman run --rm -it \
            -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
            docker.io/certbot/certbot:latest \
            certonly --manual --preferred-challenges dns \
            --email "$EMAIL" \
            -d "$DOMAIN" || {
            print_error "証明書取得に失敗しました"
            exit 1
        }
        ;;
    
    webroot)
        print_info "Webrootモードで証明書を取得します"
        print_info "Webroot: $WEBROOT"
        
        if [ ! -d "$WEBROOT" ]; then
            print_error "Webroot ディレクトリが存在しません: $WEBROOT"
            exit 1
        fi
        
        podman run --rm -it \
            -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
            -v "$WEBROOT:/var/www/html" \
            docker.io/certbot/certbot:latest \
            certonly --webroot -w /var/www/html \
            --email "$EMAIL" \
            -d "$DOMAIN" || {
            print_error "証明書取得に失敗しました"
            exit 1
        }
        ;;
    
    *)
        print_error "無効な方法: $METHOD"
        print_info "利用可能な方法: standalone, dns, webroot"
        exit 1
        ;;
esac

# 証明書ファイルのコピー
print_info "証明書ファイルをコピー中..."
if [ -d "nginx/ssl/live/$DOMAIN" ]; then
    cp "nginx/ssl/live/$DOMAIN/fullchain.pem" "nginx/ssl/"
    cp "nginx/ssl/live/$DOMAIN/privkey.pem" "nginx/ssl/"
    
    # 権限設定
    chmod 644 "nginx/ssl/fullchain.pem"
    chmod 600 "nginx/ssl/privkey.pem"
    
    print_success "証明書が正常に設定されました"
    
    # 証明書情報の表示
    print_info "証明書情報:"
    openssl x509 -in "nginx/ssl/fullchain.pem" -text -noout | grep -E "(Subject:|Not After)" || true
    
else
    print_error "証明書ファイルが見つかりません"
    print_info "Certbotのログを確認してください"
    exit 1
fi

# 次のステップの案内
print_info ""
print_success "🎉 SSL証明書の取得が完了しました！"
print_info ""
print_info "次のステップ:"
print_info "1. HTTPS環境でデプロイ:"
print_info "   export DOMAIN=$DOMAIN"
print_info "   ./deploy.sh"
print_info ""
print_info "2. 証明書の自動更新設定:"
print_info "   crontab -e"
print_info "   # 毎日午前2時に証明書更新をチェック"
print_info "   0 2 * * * $PWD/get-ssl.sh $DOMAIN $METHOD"
print_info ""
print_info "3. 証明書の有効期限確認:"
print_info "   openssl x509 -in nginx/ssl/fullchain.pem -enddate -noout"
