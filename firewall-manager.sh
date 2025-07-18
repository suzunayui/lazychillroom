#!/bin/bash

# LazyChillRoom ファイアウォール管理スクリプト

set -e

show_usage() {
    echo "LazyChillRoom ファイアウォール管理ツール"
    echo ""
    echo "使用方法: $0 [コマンド]"
    echo ""
    echo "利用可能なコマンド:"
    echo "  status      - ファイアウォール状態確認"
    echo "  setup       - 基本ファイアウォール設定"
    echo "  enable-ssh  - SSH接続を有効化"
    echo "  enable-http - HTTP接続を有効化"
    echo "  enable-https- HTTPS接続を有効化"
    echo "  list        - 開放ポート一覧表示"
    echo "  logs        - UFWログ表示"
    echo "  reset       - ファイアウォール設定リセット"
    echo ""
}

check_ufw_status() {
    echo "🔍 UFW状態確認中..."
    if sudo ufw status | grep -q "Status: active"; then
        echo "✅ UFW: 有効"
    else
        echo "⚠️  UFW: 無効"
        return 1
    fi
}

show_status() {
    echo "📊 ファイアウォール状態:"
    echo ""
    
    if check_ufw_status; then
        echo "📋 開放ポート一覧:"
        sudo ufw status numbered
        echo ""
        
        # 特定ポートの確認
        echo "🔍 LazyChillRoom関連ポート確認:"
        
        if sudo ufw status | grep -q "22/tcp"; then
            echo "✅ SSH (22/tcp): 開放済み"
        else
            echo "❌ SSH (22/tcp): 未開放"
        fi
        
        if sudo ufw status | grep -q "80/tcp"; then
            echo "✅ HTTP (80/tcp): 開放済み"
        else
            echo "❌ HTTP (80/tcp): 未開放"
        fi
        
        if sudo ufw status | grep -q "443/tcp"; then
            echo "✅ HTTPS (443/tcp): 開放済み"
        else
            echo "❌ HTTPS (443/tcp): 未開放"
        fi
    else
        echo "⚠️  UFWが無効です。'$0 setup' で設定してください。"
    fi
}

setup_firewall() {
    echo "🛡️  基本ファイアウォール設定中..."
    
    # UFW有効化
    echo "🔧 UFWを有効化中..."
    sudo ufw --force enable
    
    # デフォルトポリシー設定
    echo "🔒 デフォルトポリシー設定中..."
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # SSH接続を確保
    echo "🔓 SSH (22/tcp) を開放中..."
    sudo ufw allow 22/tcp comment 'SSH'
    
    # LazyChillRoom用ポート
    echo "🌐 HTTP (80/tcp) を開放中..."
    sudo ufw allow 80/tcp comment 'HTTP for LazyChillRoom'
    
    echo "🔒 HTTPS (443/tcp) を開放中..."
    sudo ufw allow 443/tcp comment 'HTTPS for LazyChillRoom'
    
    echo "✅ 基本ファイアウォール設定完了"
    show_status
}

enable_ssh() {
    echo "🔓 SSH接続を有効化中..."
    sudo ufw allow 22/tcp comment 'SSH'
    echo "✅ SSH (22/tcp) が開放されました"
}

enable_http() {
    echo "🌐 HTTP接続を有効化中..."
    sudo ufw allow 80/tcp comment 'HTTP for LazyChillRoom'
    echo "✅ HTTP (80/tcp) が開放されました"
}

enable_https() {
    echo "🔒 HTTPS接続を有効化中..."
    sudo ufw allow 443/tcp comment 'HTTPS for LazyChillRoom'
    echo "✅ HTTPS (443/tcp) が開放されました"
}

list_rules() {
    echo "📋 UFWルール一覧:"
    sudo ufw status numbered
}

show_logs() {
    echo "📜 UFWログ (最新50行):"
    if [ -f "/var/log/ufw.log" ]; then
        sudo tail -50 /var/log/ufw.log
    else
        echo "⚠️  UFWログファイルが見つかりません"
    fi
}

reset_firewall() {
    echo "⚠️  ファイアウォール設定をリセットします"
    echo "これにより全てのルールが削除されます。続行しますか？ (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "🔄 ファイアウォール設定をリセット中..."
        sudo ufw --force reset
        echo "✅ ファイアウォール設定がリセットされました"
        echo "📋 基本設定を再適用するには: $0 setup"
    else
        echo "❌ リセットをキャンセルしました"
    fi
}

# メイン処理
case "$1" in
    status)
        show_status
        ;;
    setup)
        setup_firewall
        ;;
    enable-ssh)
        enable_ssh
        ;;
    enable-http)
        enable_http
        ;;
    enable-https)
        enable_https
        ;;
    list)
        list_rules
        ;;
    logs)
        show_logs
        ;;
    reset)
        reset_firewall
        ;;
    *)
        show_usage
        ;;
esac
