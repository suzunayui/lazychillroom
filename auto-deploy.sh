#!/bin/bash

# LazyChillRoom 完全自動デプロイスクリプト
# 使用方法: curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/auto-deploy.sh | bash

set -e

echo "🤖 LazyChillRoom 完全自動デプロイ開始"
echo "   - パスワード自動生成"
echo "   - 自動デプロイ実行"
echo "   - ゼロタッチインストール"
echo ""

# セットアップスクリプトを自動モードで実行
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
