FROM docker.io/php:8.2-apache

# 必要なPHP拡張をインストール
RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libzip-dev \
    libonig-dev \
    libxml2-dev \
    unzip \
    git \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        gd \
        pdo \
        pdo_mysql \
        mysqli \
        zip \
        mbstring \
        xml \
        bcmath

# Composerをインストール
COPY --from=docker.io/composer:latest /usr/bin/composer /usr/bin/composer

# Apache設定
RUN a2enmod rewrite
# DocumentRootがすでに/var/www/htmlなので変更は不要

# PHPの設定を調整（開発環境用）
RUN echo "upload_max_filesize = 50M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size = 50M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "max_execution_time = 300" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "display_errors = On" >> /usr/local/etc/php/conf.d/development.ini \
    && echo "error_reporting = E_ALL" >> /usr/local/etc/php/conf.d/development.ini \
    && echo "log_errors = On" >> /usr/local/etc/php/conf.d/development.ini

# 作業ディレクトリを設定
WORKDIR /var/www/html

# アプリケーションファイルをコピー
COPY . /var/www/html/

# 必要なディレクトリを作成
RUN mkdir -p /var/www/html/logs /var/www/html/uploads

# ファイルの権限を設定
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# ポート80を公開
EXPOSE 80

# Apacheを起動
CMD ["apache2-foreground"]