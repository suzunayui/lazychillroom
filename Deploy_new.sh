#!/bin/bash
set -euo pipefail

# 色付きメッセージ
log()    { echo -e "\033[36m[INFO]\033[0m $*"; }
warn()   { echo -e "\033[33m[WARN]\033[0m $*"; }
error()  { echo -e "\033[31m[FAIL]\033[0m $*"; }
ok()     { echo -e "\033[32m[OK]\033[0m $*"; }

REPO="https://github.com/suzunayui/lazychillroom.git"
DIR="lazychillroom"
COMPOSE_FILE="podman-compose.production.yaml"

# 1. ソース取得・更新
if [ ! -d "$DIR" ]; then
  log "リポジトリをクローン"
  git clone "$REPO" "$DIR"
  cd "$DIR"
else
  cd "$DIR"
  log "リポジトリを更新"
  git pull --ff-only || warn "pull失敗: 続行"
fi

# 2. ディレクトリ
mkdir -p uploads nginx/ssl nginx/logs

# 3. 既存サービス停止
log "既存Podmanスタックを停止"
podman-compose -f "$COMPOSE_FILE" down -v --remove-orphans || true
podman ps -aq --filter "name=lazychillroom" | xargs -r podman rm -f || true

# 4. 必須ファイル生成
if [ ! -f nginx/nginx.conf ]; then
  log "nginx.conf自動生成"
  cat > nginx/nginx.conf <<'EOF'
events { worker_connections 1024; }
http {
  upstream app { server app:3000; }
  server { listen 80; server_name _; location / { proxy_pass http://app; } }
  server {
    listen 443 ssl http2;
    server_name _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    location / { proxy_pass http://app; }
  }
}
EOF
  ok "nginx.conf生成"
fi

# 5. SSL証明書
if [ -n "${DOMAIN:-}" ]; then
  if [[ ! -f nginx/ssl/fullchain.pem || ! -f nginx/ssl/privkey.pem ]]; then
    log "SSL証明書自動取得"
    OUTFILE=$(mktemp)
    if podman run --rm -it \
      -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
      -p 80:80 \
      docker.io/certbot/certbot certonly --standalone --non-interactive --agree-tos \
      --register-unsafely-without-email -d "$DOMAIN" >"$OUTFILE" 2>&1; then

      cp "nginx/ssl/live/$DOMAIN/fullchain.pem" nginx/ssl/
      cp "nginx/ssl/live/$DOMAIN/privkey.pem" nginx/ssl/
      ok "証明書取得成功"
    else
      error "Let's Encrypt証明書取得に失敗しました"
      # 失敗内容に応じたヒントを表示
      if grep -qi 'rate limit' "$OUTFILE"; then
        warn "→ レートリミットに達しています（数時間～数日待って再試行してください）"
      elif grep -qi 'No valid IP addresses found' "$OUTFILE"; then
        warn "→ DNS設定が正しいかご確認ください"
      elif grep -qi 'connection refused' "$OUTFILE"; then
        warn "→ ポート80番が外部から到達可能か/NAT・ファイアウォールをご確認ください"
      elif grep -qi 'Timeout' "$OUTFILE"; then
        warn "→ ネットワークやDNS伝播が完了しているか確認してください"
      elif grep -qi 'too many certificates already issued' "$OUTFILE"; then
        warn "→ 同一FQDNへの証明書発行上限（週5回）です。しばらく待つ必要があります"
      elif grep -qi 'NXDOMAIN' "$OUTFILE"; then
        warn "→ ドメイン名が存在しない、またはタイプミスの可能性があります"
      else
        warn "→ エラーログ内容："
        tail -n 10 "$OUTFILE"
      fi
      rm -f "$OUTFILE"
      exit 1
    fi
    rm -f "$OUTFILE"
  else
    ok "SSL証明書あり"
  fi
else
  warn "DOMAIN未指定: HTTPのみで起動"
fi

# 6. DBマイグレーション雛形
if [ ! -f migrations/postgresql-schema.sql ]; then
  log "migrations/postgresql-schema.sql作成"
  mkdir -p migrations
  cat > migrations/postgresql-schema.sql <<'EOF'
-- 初期テーブル定義（必要に応じて編集）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), username VARCHAR(50) UNIQUE, password_hash VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
EOF
  ok "DBスキーマ生成"
fi

# 7. 設定ファイル存在チェック
if [ ! -f "$COMPOSE_FILE" ]; then
  error "$COMPOSE_FILE がありません。"
  exit 1
fi

# 8. コンフィグ検証
podman-compose -f "$COMPOSE_FILE" config > /dev/null || { error "composeファイルにエラー"; exit 1; }
ok "composeファイル正常"

# 9. サービス起動
log "サービス起動"
podman-compose -f "$COMPOSE_FILE" up -d

# 10. ヘルスチェック(10秒待機→全サービス確認)
sleep 10
SERVICES=(postgres redis app nginx)
HEALTHY=0
for s in "${SERVICES[@]}"; do
  if podman-compose -f "$COMPOSE_FILE" ps "$s" 2>/dev/null | grep -q "Up"; then
    ok "$s 起動OK"
    ((HEALTHY++))
  else
    error "$s 起動失敗"
  fi
done

echo
log "=== デプロイ結果: $HEALTHY/${#SERVICES[@]} サービス起動 ==="
if [ "$HEALTHY" -eq "${#SERVICES[@]}" ]; then
  ok "🎉 全サービス正常起動"
else
  warn "一部サービス異常: ログ確認 podman-compose -f $COMPOSE_FILE logs"
  exit 1
fi

# 11. アクセス先案内
if [ -n "${DOMAIN:-}" ]; then
  echo "  https://$DOMAIN"
else
  echo "  http://localhost"
fi
