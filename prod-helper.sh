#!/bin/bash
# 本番環境用の便利スクリプト

# 色付きメッセージ用の関数
print_info() { echo -e "\033[34m[INFO]\033[0m $1"; }
print_success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
print_warning() { echo -e "\033[33m[WARNING]\033[0m $1"; }
print_error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

case "$1" in
    "init")
        print_info "本番環境を初期化します..."
        # .env.productionがない場合のみ環境変数生成
        if [ ! -f ".env.production" ]; then
            print_info "環境変数ファイルを生成中..."
            podman-compose -f podman-compose.production.yaml run --rm init
        fi
        print_success "初期化完了"
        ;;
    "ssl-check")
        print_info "SSL証明書の確認中..."
        if [ -f "nginx/ssl/fullchain.pem" ]; then
            openssl x509 -in nginx/ssl/fullchain.pem -enddate -noout
            print_success "SSL証明書が存在します"
        else
            print_warning "SSL証明書が見つかりません"
        fi
        ;;
    "health")
        print_info "ヘルスチェック実行中..."
        
        # コンテナ状態確認
        echo "📋 コンテナ状態:"
        podman-compose -f podman-compose.production.yaml ps
        
        echo ""
        echo "🌐 アプリケーションヘルスチェック:"
        
        # HTTPヘルスチェック
        if curl -s http://localhost/health > /dev/null 2>&1; then
            print_success "HTTP: 正常"
        elif curl -s http://localhost:3000/health > /dev/null 2>&1; then
            print_success "アプリ直接: 正常"
        else
            print_error "アプリケーションが応答しません"
        fi
        
        # HTTPSヘルスチェック
        if [ -f "nginx/ssl/fullchain.pem" ]; then
            if curl -s -k https://localhost/health > /dev/null 2>&1; then
                print_success "HTTPS: 正常"
            else
                print_warning "HTTPS: 応答なし"
            fi
        fi
        ;;
    "backup")
        print_info "データベースバックアップを作成中..."
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        podman-compose -f podman-compose.production.yaml exec postgres pg_dump -U lazychillroom_user -d lazychillroom > "$BACKUP_FILE"
        print_success "バックアップ完了: $BACKUP_FILE"
        ;;
    "clean")
        print_info "システムクリーンアップ中..."
        podman system prune -af
        podman volume prune -f
        print_success "クリーンアップ完了"
        ;;
    *)
        echo "使用方法: $0 {init|ssl-check|health|backup|clean}"
        echo ""
        echo "コマンド説明:"
        echo "  init      - 環境変数ファイル生成"
        echo "  ssl-check - SSL証明書確認"
        echo "  health    - ヘルスチェック"
        echo "  backup    - データベースバックアップ"
        echo "  clean     - システムクリーンアップ"
        exit 1
        ;;
esac
