# LazyChillRoom 本番環境デプロイガイド

## ⚡ クイックデプロイ（Ubuntu 24.04）

### 🔒 HTTPS完全自動デプロイ（推奨）

**最も安全：** ドメイン名でHTTPS自動設定

```bash
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/auto-deploy-https.sh | bash -s -- your-domain.com
```

**前提条件：**
- ドメインのAレコードでサーバーIPアドレスを指定
- DNS設定が反映されていること

**機能：**
- ✅ Let's Encrypt SSL証明書自動取得
- ✅ HTTPS自動リダイレクト設定  
- ✅ セキュアなパスワード自動生成
- ✅ 自動デプロイ実行
- ✅ SSL証明書自動更新設定

### 🤖 完全自動デプロイ（HTTP）

**最も簡単：** パスワード自動生成 + 自動デプロイ

```bash
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/auto-deploy.sh | bash
```

**機能：**
- ✅ 必要パッケージの自動インストール
- ✅ セキュアなパスワード自動生成（32文字）
- ✅ JWT_SECRET自動生成（64文字）
- ✅ 自動デプロイ実行
- ✅ ファイアウォール設定
- ✅ ゼロタッチインストール

### 🔧 セットアップのみ（自動パスワード生成）

```bash
# HTTPS対応セットアップ（パスワード自動生成、デプロイは手動）
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --auto --domain your-domain.com

# HTTP版セットアップ（パスワード自動生成、デプロイは手動）
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --auto
```

### 方法1: ワンライナーセットアップ（手動設定）

```bash
# HTTPS対応（手動設定）
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash -s -- --domain your-domain.com

# HTTP版（手動設定）
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh | bash
```

### 方法2: 手動セットアップ

```bash
# 1. リポジトリクローン
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom

# 2. 環境設定
cp .env.example .env.production
nano .env.production  # 重要: パスワード等を設定

# 3. デプロイ実行
./deploy-production.sh
```

### 🔧 設定が必要な項目（手動設定の場合）

`.env.production`で以下を必ず変更してください：

- `DB_PASSWORD`: 強力なデータベースパスワード
- `REDIS_PASSWORD`: 強力なRedisパスワード
- `JWT_SECRET`: 64文字以上のランダム文字列

**自動生成の場合は設定不要です。**

強力なパスワード生成例：
```bash
# 強力なパスワード生成
openssl rand -base64 32

# JWT_SECRET生成（64文字以上）
openssl rand -base64 64
```

### 🚀 利用可能なデプロイオプション

| 方法 | コマンド | パスワード | デプロイ | 設定編集 |
|------|----------|-----------|---------|---------|
| 完全自動 | `auto-deploy.sh` | 自動生成 | 自動実行 | 不要 |
| セットアップのみ | `setup-production.sh --auto` | 自動生成 | 手動 | 可能 |
| 手動セットアップ | `setup-production.sh` | 手動設定 | 手動 | 必要 |
| 完全手動 | `git clone + 手動設定` | 手動設定 | 手動 | 必要 |

## 🚀 本番環境へのデプロイ

### 前提条件

- Podman および podman-compose がインストールされていること
- Git がインストールされていること
- curl がインストールされていること（ヘルスチェック用）

### 1. リポジトリのクローン

```bash
git clone https://github.com/suzunayui/lazychillroom.git
cd lazychillroom
```

### 2. 本番環境設定の準備

`.env.production` ファイルを編集し、本番環境用のセキュアな設定を行ってください：

```bash
cp .env.production .env.production.backup
nano .env.production
```

**重要：以下の項目を必ず変更してください：**

- `DB_PASSWORD`: 強力なデータベースパスワード
- `REDIS_PASSWORD`: 強力なRedisパスワード  
- `JWT_SECRET`: 長いランダムな文字列（最低64文字推奨）

### 3. 本番環境デプロイの実行

```bash
# デプロイスクリプトを実行
./deploy-production.sh

# または npm スクリプトを使用
npm run prod:deploy
```

### 4. デプロイ確認

```bash
# サービス状態確認
./maintenance.sh status

# ログ確認
./maintenance.sh logs

# ヘルスチェック
curl http://localhost/health
```

## � SSL/HTTPS設定

### SSL証明書の自動更新設定

```bash
# crontabに自動更新ジョブを追加
sudo crontab -e

# 毎日午前2時に証明書更新チェック
0 2 * * * /home/username/lazychillroom/ssl-renew.sh
```

### SSL証明書の手動管理

```bash
# SSL証明書の手動取得
./ssl-setup.sh your-domain.com

# SSL証明書の手動更新
./ssl-renew.sh

# SSL証明書の状態確認
sudo certbot certificates
```

### HTTPからHTTPSへの移行

既存のHTTPデプロイメントをHTTPSに移行する場合：

```bash
# 1. ドメインのDNS設定確認
nslookup your-domain.com

# 2. SSL証明書取得
./ssl-setup.sh your-domain.com

# 3. 環境設定を更新
nano .env.production
# SSL_ENABLED=true
# DOMAIN=your-domain.com

# 4. Nginxサービス再起動
podman-compose -f podman-compose.production.yaml restart nginx
```

## �🔧 本番環境の管理

### 利用可能なコマンド

```bash
# サービス管理
npm run prod:up      # サービス開始
npm run prod:down    # サービス停止
npm run prod:build   # イメージ再ビルド
npm run prod:logs    # ログ表示

# HTTPS/SSL管理
npm run prod:https   # HTTPS完全自動デプロイ（要ドメイン指定）
npm run prod:ssl-setup  # SSL証明書手動取得
npm run prod:ssl-renew  # SSL証明書手動更新

# メンテナンス
./maintenance.sh status    # 状態確認
./maintenance.sh monitor   # リアルタイム監視
./maintenance.sh backup    # データベースバックアップ
./maintenance.sh restart   # サービス再起動
./maintenance.sh update    # アプリケーション更新
./maintenance.sh cleanup   # 不要データ削除
```

### ログの確認

```bash
# 全サービスのログ
podman-compose -f podman-compose.production.yaml logs -f

# 特定サービスのログ
podman-compose -f podman-compose.production.yaml logs -f app
podman-compose -f podman-compose.production.yaml logs -f postgres
podman-compose -f podman-compose.production.yaml logs -f redis
podman-compose -f podman-compose.production.yaml logs -f nginx
```

## 🔒 セキュリティ設定

### SSL/TLS証明書の設定（推奨）

1. SSL証明書を取得（Let's Encrypt推奨）
2. `nginx/ssl/` ディレクトリに証明書を配置
3. `nginx/nginx.conf` のHTTPS設定部分のコメントを解除
4. サービスを再起動

```bash
# Let's Encrypt証明書の例
mkdir -p nginx/ssl
# 証明書ファイルをnginx/ssl/に配置
./maintenance.sh restart
```

### ファイアウォール設定

```bash
# 必要なポートのみ開放
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# 設定確認
sudo ufw status numbered

# ファイアウォール管理ツール使用
./firewall-manager.sh status     # 状態確認
./firewall-manager.sh setup      # 基本設定
./firewall-manager.sh list       # ルール一覧
```

**開放されるポート:**
- `22/tcp` - SSH接続
- `80/tcp` - HTTP (LazyChillRoom)
- `443/tcp` - HTTPS (LazyChillRoom SSL)

**セキュリティ設定:**
- デフォルト: 受信拒否、送信許可
- 必要最小限のポートのみ開放
- コメント付きルール管理

## 📊 監視とメンテナンス

### 定期バックアップの設定

```bash
# cronジョブでの自動バックアップ設定例
# 毎日午前2時にバックアップ実行
0 2 * * * cd /path/to/lazychillroom && ./maintenance.sh backup
```

### システム監視

```bash
# リアルタイム監視の開始
./maintenance.sh monitor

# システムリソース確認
podman stats

# ディスク使用量確認
df -h
```

### パフォーマンス最適化

- CPU使用率が高い場合：アプリケーションコンテナのCPU制限を調整
- メモリ使用量が高い場合：Redis設定やPostgreSQL設定を調整
- ディスク容量が不足する場合：ログローテーション設定や古いバックアップの削除

## 🔄 アップデート手順

```bash
# 1. 最新コードを取得
git pull origin main

# 2. 安全なアップデート実行
./maintenance.sh update

# 3. 状態確認
./maintenance.sh status
```

## 🆘 トラブルシューティング

### よくある問題と解決方法

#### サービスが起動しない

```bash
# ログを確認
./maintenance.sh logs

# サービス状態確認
podman-compose -f podman-compose.production.yaml ps

# コンテナの詳細確認
podman inspect <container_name>
```

#### データベース接続エラー

```bash
# PostgreSQL接続確認
podman-compose -f podman-compose.production.yaml exec postgres pg_isready -U lazychillroom_user

# データベースログ確認
podman-compose -f podman-compose.production.yaml logs postgres
```

#### Redis接続エラー

```bash
# Redis接続確認
podman-compose -f podman-compose.production.yaml exec redis redis-cli ping

# Redisログ確認
podman-compose -f podman-compose.production.yaml logs redis
```

### 緊急時の復旧

```bash
# 1. サービス停止
./maintenance.sh stop

# 2. データベース復元（バックアップがある場合）
./maintenance.sh restore backup_file.sql

# 3. サービス再起動
./maintenance.sh start
```

## 📋 本番環境チェックリスト

- [ ] `.env.production` の設定完了
- [ ] 強力なパスワードの設定
- [ ] SSL証明書の設定（推奨）
- [ ] ファイアウォール設定
- [ ] 定期バックアップの設定
- [ ] 監視設定
- [ ] ログローテーション設定
- [ ] 緊急連絡先の準備

## 🔗 関連リンク

- [開発環境セットアップ](README.md)
- [API ドキュメント](docs/api.md)
- [トラブルシューティング](docs/troubleshooting.md)
