#!/bin/bash

# LazyChillRoom 本番環境メンテナンススクリプト

set -e

COMPOSE_FILE="podman-compose.production.yaml"

show_usage() {
    echo "LazyChillRoom 本番環境メンテナンスツール"
    echo ""
    echo "使用方法: $0 [コマンド]"
    echo ""
    echo "利用可能なコマンド:"
    echo "  status     - サービス状態確認"
    echo "  logs       - ログ表示"
    echo "  restart    - サービス再起動"
    echo "  update     - アプリケーション更新"
    echo "  backup     - データベースバックアップ"
    echo "  restore    - データベース復元"
    echo "  cleanup    - 不要なイメージ・ボリューム削除"
    echo "  full-clean - 完全クリーンアップ（全ボリューム・コンテナ削除）"
    echo "  monitor    - リアルタイム監視"
    echo "  firewall   - ファイアウォール状態確認"
    echo "  stop       - サービス停止"
    echo "  start      - サービス開始"
    echo ""
}

check_services() {
    echo "� LazyChillRoom サービス状態確認"
    echo ""
    
    # systemdサービス状態
    echo "🔧 Systemdサービス:"
    if systemctl is-active --quiet lazychillroom.service 2>/dev/null; then
        echo "✅ LazyChillRoom Service: 実行中"
    else
        echo "❌ LazyChillRoom Service: 停止中 (systemctl status lazychillroom.service で詳細確認)"
    fi
    
    echo ""
    echo "🐳 コンテナ状態:"
    if podman-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
        podman-compose -f $COMPOSE_FILE ps
    else
        echo "❌ コンテナが実行されていません"
    fi
    
    echo ""
    echo "� サービス稼働確認:"
    
    # アプリケーション接続チェック
    if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|302"; then
        echo "✅ アプリケーション: 正常応答"
    else
        echo "❌ アプリケーション: 応答なし"
    fi
    
    # PostgreSQL接続チェック
    if podman-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U lazychillroom_user > /dev/null 2>&1; then
        echo "✅ PostgreSQL: 正常"
    else
        echo "❌ PostgreSQL: 異常"
    fi
    
    # Redis接続チェック
    if podman-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis: 正常"
    else
        echo "❌ Redis: 異常"
    fi
    
    # システムリソース確認
    echo ""
    echo "💾 システムリソース:"
    echo "ディスク: $(df -h . | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
    echo "メモリ: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
    echo "ロードアベレージ: $(uptime | awk -F'load average:' '{print $2}')"
    
    # ファイアウォール状態確認
    echo ""
    echo "🛡️  ファイアウォール状態:"
    if sudo ufw status | grep -q "Status: active"; then
        echo "✅ UFW: 有効"
        if sudo ufw status | grep -q "80/tcp"; then
            echo "✅ HTTP (80): 開放済み"
        else
            echo "⚠️  HTTP (80): 未開放"
        fi
        if sudo ufw status | grep -q "443/tcp"; then
            echo "✅ HTTPS (443): 開放済み"
        else
            echo "⚠️  HTTPS (443): 未開放"
        fi
    else
        echo "❌ UFW: 無効"
    fi
}

show_logs() {
    echo "📋 ログ表示（Ctrl+Cで終了）"
    podman-compose -f $COMPOSE_FILE logs -f
}

restart_services() {
    echo "🔄 サービス再起動中..."
    podman-compose -f $COMPOSE_FILE restart
    sleep 10
    check_services
}

update_application() {
    echo "🔄 アプリケーション更新中..."
    
    # バックアップ作成
    echo "💾 更新前バックアップ作成中..."
    backup_database
    
    # アプリケーション停止
    echo "🛑 アプリケーション停止中..."
    podman-compose -f $COMPOSE_FILE stop app nginx
    
    # 新しいイメージをビルド
    echo "🔨 新しいイメージビルド中..."
    podman-compose -f $COMPOSE_FILE build app nginx
    
    # アプリケーション再起動
    echo "🚀 アプリケーション起動中..."
    podman-compose -f $COMPOSE_FILE up -d app nginx
    
    sleep 20
    check_services
    echo "✅ アプリケーション更新完了"
}

backup_database() {
    BACKUP_DIR="./backups"
    BACKUP_FILE="$BACKUP_DIR/lazychillroom-$(date +%Y%m%d-%H%M%S).sql"
    
    mkdir -p $BACKUP_DIR
    
    echo "💾 データベースバックアップ中..."
    podman-compose -f $COMPOSE_FILE exec -T postgres pg_dump -U lazychillroom_user lazychillroom > $BACKUP_FILE
    
    if [ $? -eq 0 ]; then
        echo "✅ バックアップ完了: $BACKUP_FILE"
        
        # 7日以上古いバックアップを削除
        find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
    else
        echo "❌ バックアップに失敗しました"
        exit 1
    fi
}

restore_database() {
    if [ -z "$2" ]; then
        echo "❌ 復元するバックアップファイルを指定してください"
        echo "使用方法: $0 restore backup_file.sql"
        exit 1
    fi
    
    BACKUP_FILE=$2
    
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "❌ バックアップファイルが見つかりません: $BACKUP_FILE"
        exit 1
    fi
    
    echo "⚠️  データベース復元を実行します"
    echo "現在のデータは失われます。続行しますか？ (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "🔄 データベース復元中..."
        podman-compose -f $COMPOSE_FILE exec -T postgres psql -U lazychillroom_user -d lazychillroom < $BACKUP_FILE
        echo "✅ データベース復元完了"
    else
        echo "❌ 復元をキャンセルしました"
    fi
}

cleanup_system() {
    echo "🧹 システムクリーンアップ中..."
    
    # 使用されていないイメージを削除
    echo "🗑️  不要なイメージ削除中..."
    podman image prune -f
    
    # 使用されていないボリュームを削除（注意：データが失われる可能性）
    echo "⚠️  不要なボリューム削除を実行しますか？ (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        podman volume prune -f
        echo "✅ ボリューム削除完了"
    fi
    
    echo "✅ クリーンアップ完了"
}

full_cleanup() {
    echo "🚨 完全クリーンアップ - 全てのコンテナとボリュームが削除されます"
    echo "⚠️  データベースデータも含めて全て削除されます。本当に実行しますか？ (yes/NO)"
    read -r response
    
    if [[ "$response" == "yes" ]]; then
        echo "🛑 全サービス停止中..."
        podman-compose -f $COMPOSE_FILE down -v 2>/dev/null || true
        
        echo "🗑️  個別コンテナ削除中..."
        container_names=("lazychillroom_postgres_1" "lazychillroom_redis_1" "lazychillroom_app_1" "lazychillroom_nginx_1")
        for container in "${container_names[@]}"; do
            if podman container exists "$container" 2>/dev/null; then
                echo "   削除中: $container"
                podman rm -f "$container" 2>/dev/null || true
            fi
        done
        
        echo "🗑️  LazyChillRoom関連ボリューム削除中..."
        volume_names=("lazychillroom_postgres_data" "lazychillroom_redis_data" "lazychillroom_app_logs" "lazychillroom_nginx_logs")
        for volume in "${volume_names[@]}"; do
            if podman volume exists "$volume" 2>/dev/null; then
                echo "   削除中: $volume"
                podman volume rm -f "$volume" 2>/dev/null || true
            fi
        done
        
        echo "🧹 システム全体クリーンアップ中..."
        podman system prune -af --volumes 2>/dev/null || true
        
        echo "✅ 完全クリーンアップ完了"
        echo "📋 新規デプロイするには: ./deploy-production.sh"
    else
        echo "❌ 完全クリーンアップがキャンセルされました"
    fi
}

monitor_services() {
    echo "📊 リアルタイム監視開始（Ctrl+Cで終了）"
    
    while true; do
        clear
        echo "=== LazyChillRoom 監視ダッシュボード ==="
        echo "更新時刻: $(date)"
        echo ""
        
        # サービス状態
        check_services
        echo ""
        
        # リソース使用量
        echo "💻 リソース使用量:"
        podman stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | head -10
        echo ""
        
        # 最新のログ（最後の5行）
        echo "📋 最新ログ:"
        podman-compose -f $COMPOSE_FILE logs --tail=5 app | tail -5
        echo ""
        echo "次の更新まで30秒..."
        
        sleep 30
    done
}

# メイン処理
case "$1" in
    status)
        check_services
        ;;
    logs)
        show_logs
        ;;
    restart)
        restart_services
        ;;
    update)
        update_application
        ;;
    backup)
        backup_database
        ;;
    restore)
        restore_database $@
        ;;
    cleanup)
        cleanup_system
        ;;
    full-clean)
        full_cleanup
        ;;
    monitor)
        monitor_services
        ;;
    stop)
        echo "🛑 サービス停止中..."
        echo "🔧 完全停止（ボリューム削除）しますか？ (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo "🗑️  ボリュームも含めて完全停止中..."
            podman-compose -f $COMPOSE_FILE down -v
        else
            echo "📁 ボリュームは保持して停止中..."
            podman-compose -f $COMPOSE_FILE down
        fi
        ;;
    start)
        echo "🚀 サービス開始中..."
        podman-compose -f $COMPOSE_FILE up -d
        sleep 10
        check_services
        ;;
    *)
        show_usage
        ;;
esac
