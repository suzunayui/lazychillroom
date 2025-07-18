FROM node:22-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションのソースコードをコピー
COPY . .

# アップロードディレクトリを作成
RUN mkdir -p uploads/files uploads/avatars

# ポート3000を公開
EXPOSE 3000
