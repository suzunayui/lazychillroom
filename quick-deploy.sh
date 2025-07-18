#!/bin/bash

# LazyChillRoom ワンライナーデプロイスクリプト
# 使用方法: curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/quick-deploy.sh | bash

set -e

echo "🚀 LazyChillRoom クイックデプロイ"
echo ""

# セットアップスクリプトをダウンロードして実行
echo "📥 セットアップスクリプトをダウンロード中..."
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh -o /tmp/setup-production.sh
chmod +x /tmp/setup-production.sh

echo "🔧 セットアップ実行中..."
/tmp/setup-production.sh

echo ""
echo "✨ クイックデプロイ完了！"
echo "次に .env.production を編集してからデプロイを実行してください。"
