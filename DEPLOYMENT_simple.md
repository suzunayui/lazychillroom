# LazyChillRoom デプロイガイド

## 🚀 最速デプロイ

### ワンコマンドで完了

**HTTPS自動設定（推奨）：**
```bash
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/auto-deploy-https.sh | bash -s -- your-domain.com
```

**HTTP版：**
```bash
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/auto-deploy.sh | bash
```

これだけで完了！全自動でWebアプリが起動します。

## 📋 手動デプロイ

### 1. 基本セットアップ
```bash
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom
chmod +x *.sh
```

### 2. 環境設定
```bash
cp .env.example .env.production
nano .env.production  # パスワードを設定
```

### 3. デプロイ実行
```bash
npm run prod:all  # 完全デプロイ
```

## 🛠️ よく使うコマンド

```bash
# 本番環境
npm run prod:all      # 完全デプロイ
npm run prod:up       # 起動
npm run prod:down     # 停止
npm run prod:logs     # ログ確認

# SSL設定
npm run prod:ssl-setup   # SSL証明書取得
npm run prod:ssl-renew   # SSL証明書更新

# メンテナンス
./maintenance.sh status    # 状態確認
./maintenance.sh backup    # バックアップ
./maintenance.sh restart   # 再起動
```

## 🔧 設定項目

`.env.production`で必ず変更：
- `DB_PASSWORD`: データベースパスワード
- `REDIS_PASSWORD`: Redisパスワード
- `JWT_SECRET`: JWT秘密鍵（64文字以上）

## 🔒 セキュリティ

### ファイアウォール
```bash
sudo ufw enable
sudo ufw allow 22,80,443/tcp
```

### SSL証明書（Let's Encrypt）
```bash
./ssl-setup.sh your-domain.com
```

## 🆘 トラブルシューティング

```bash
# ログ確認
npm run prod:logs

# 状態確認
./maintenance.sh status

# 緊急時（全削除＆再起動）
./emergency-cleanup.sh
npm run prod:all
```

## 📊 アクセス

- HTTP: `http://your-server`
- HTTPS: `https://your-domain.com`
- ヘルスチェック: `http://your-server/health`

**必要な環境：** Ubuntu 24.04 + Podman + Node.js
