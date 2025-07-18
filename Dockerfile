# Node.js 22 LTS (alpineベース)
FROM node:22-alpine

# 作業ディレクトリ
WORKDIR /app

# 依存関係インストール
COPY package*.json ./
RUN npm install

# ソースコードコピー
COPY ./backend /app
COPY ./migrations /app/migrations

# 環境変数
ENV NODE_ENV=production

# サーバーポート
EXPOSE 3000
