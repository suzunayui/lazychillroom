#!/bin/bash

ENV_FILE=".env"

# .envがなければ.exampleからコピー
if [ ! -f "$ENV_FILE" ]; then
    echo "📄 Copying .env.example to .env..."
    cp .env.example "$ENV_FILE"
else
    echo "✅ .env already exists. Skipping copy."
fi

# ランダム生成関数
generate_secret() {
    head -c 32 /dev/urandom | base64 | tr -d '\n'
}

echo "🔐 Updating secrets in $ENV_FILE..."

# SESSION_SECRET
SESSION_SECRET=$(generate_secret)
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" "$ENV_FILE"

# JWT_SECRET
JWT_SECRET=$(generate_secret)
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "$ENV_FILE"

# DB_PASSWORD
DB_PASSWORD=$(generate_secret)
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" "$ENV_FILE"

echo "✨ Secrets updated successfully!"

# DOMAIN を読み込んでCaddyfileを生成
DOMAIN=$(grep "^DOMAIN=" "$ENV_FILE" | cut -d '=' -f2)
CERT_PATH=$(grep "^CERT_PATH=" "$ENV_FILE" | cut -d '=' -f2)
KEY_PATH=$(grep "^KEY_PATH=" "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$DOMAIN" ]; then
  echo "❌ DOMAIN is not set in $ENV_FILE"
  exit 1
fi

if [ -z "$CERT_PATH" ] || [ -z "$KEY_PATH" ]; then
  echo "❌ CERT_PATH or KEY_PATH is not set in $ENV_FILE"
  exit 1
fi

echo "🌸 DOMAIN found: $DOMAIN"
echo "🔐 Using certificates: $CERT_PATH, $KEY_PATH"

# Caddyfile を生成
cat <<EOF > Caddyfile
$DOMAIN {
    root * /srv
    file_server
    
    # Socket.IO websocket connections
    reverse_proxy /socket.io/* backend:3000 {
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }
    
    # API calls to backend
    reverse_proxy /api/* backend:3000
    
    # Direct file access for uploads (served from backend)
    reverse_proxy /uploads/* backend:3000
    
    tls /etc/ssl/certs/fullchain.pem /etc/ssl/private/privkey.pem
}
EOF

echo "✨ Caddyfile generated successfully!"
echo "🚀 Setup completed!"
