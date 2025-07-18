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
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" "$ENV_FILE"

# JWT_SECRET
JWT_SECRET=$(generate_secret)
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" "$ENV_FILE"

# DB_PASSWORD
DB_PASSWORD=$(generate_secret)
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD}/" "$ENV_FILE"

echo "✨ Secrets updated successfully!"
echo "🚀 Setup completed!"
