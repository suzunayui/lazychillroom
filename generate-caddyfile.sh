#!/bin/bash

# .env から DOMAIN を読み込む
ENV_FILE=".env"
DOMAIN=$(grep "^DOMAIN=" "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$DOMAIN" ]; then
  echo "❌ DOMAIN is not set in $ENV_FILE"
  exit 1
fi

echo "🌸 DOMAIN found: $DOMAIN"

# Caddyfile を生成
cat <<EOF > Caddyfile
$DOMAIN {
    root * /srv
    file_server
    reverse_proxy /api/* backend:3000
}
EOF

echo "✨ Caddyfile generated successfully!"
