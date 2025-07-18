// 画像処理とファイル最適化ミドルウェア
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { CacheManager } = require('../config/cache');

const cache = new CacheManager();

// サムネイル設定
const thumbnailSizes = {
  small: { width: 150, height: 150, quality: 70 },
  medium: { width: 400, height: 400, quality: 80 },
  large: { width: 800, height: 800, quality: 85 }
};

// 許可された画像形式
const allowedImageTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp'
];

// ファイルサイズ制限 (10MB)
const maxFileSize = 10 * 1024 * 1024;

// Multer設定（メモリ使用量削減）
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // MIMEタイプチェック
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('サポートされていない画像形式です'), false);
  }
  
  // ファイル拡張子チェック
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (!allowedImageTypes.includes(ext)) {
    return cb(new Error('サポートされていない画像形式です'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 5 // 同時アップロード制限
  }
});

class ImageProcessor {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.thumbnailDir = path.join(this.uploadDir, 'thumbnails');
    this.originalDir = path.join(this.uploadDir, 'originals');
    
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.thumbnailDir, { recursive: true });
      await fs.mkdir(this.originalDir, { recursive: true });
    } catch (error) {
      console.error('ディレクトリ作成エラー:', error);
    }
  }

  // ファイルハッシュ生成（重複排除）
  generateFileHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  // 画像最適化とサムネイル生成
  async processImage(buffer, originalName) {
    try {
      const fileHash = this.generateFileHash(buffer);
      const ext = path.extname(originalName).toLowerCase();
      const baseName = `${fileHash}${ext}`;
      
      // キャッシュから既存ファイルチェック
      const cachedImage = await cache.getCachedImage(fileHash);
      if (cachedImage) {
        return cachedImage;
      }

      // 画像メタデータ取得
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      // サイズ制限チェック（5000x5000px）
      if (metadata.width > 5000 || metadata.height > 5000) {
        throw new Error('画像サイズが大きすぎます (最大5000x5000px)');
      }

      const processedFiles = {
        original: null,
        thumbnails: {}
      };

      // オリジナル画像保存（WebP変換で圧縮）
      const originalPath = path.join(this.originalDir, `${fileHash}.webp`);
      await image
        .webp({ quality: 90 })
        .toFile(originalPath);
      
      processedFiles.original = {
        filename: `${fileHash}.webp`,
        path: originalPath,
        size: (await fs.stat(originalPath)).size
      };

      // サムネイル生成
      for (const [size, config] of Object.entries(thumbnailSizes)) {
        const thumbnailPath = path.join(this.thumbnailDir, `${fileHash}_${size}.webp`);
        
        await image
          .resize(config.width, config.height, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: config.quality })
          .toFile(thumbnailPath);

        processedFiles.thumbnails[size] = {
          filename: `${fileHash}_${size}.webp`,
          path: thumbnailPath,
          size: (await fs.stat(thumbnailPath)).size,
          width: config.width,
          height: config.height
        };
      }

      // メタデータ
      const imageData = {
        id: fileHash,
        originalName,
        mimeType: metadata.format,
        width: metadata.width,
        height: metadata.height,
        originalSize: buffer.length,
        files: processedFiles,
        processedAt: new Date().toISOString()
      };

      // キャッシュに保存
      await cache.cacheImage(fileHash, imageData);

      return imageData;

    } catch (error) {
      console.error('画像処理エラー:', error);
      throw new Error(`画像処理に失敗しました: ${error.message}`);
    }
  }

  // 画像削除
  async deleteImage(imageId) {
    try {
      const cachedImage = await cache.getCachedImage(imageId);
      if (cachedImage) {
        // オリジナル削除
        if (cachedImage.files.original) {
          await fs.unlink(cachedImage.files.original.path).catch(() => {});
        }

        // サムネイル削除
        for (const thumbnail of Object.values(cachedImage.files.thumbnails)) {
          await fs.unlink(thumbnail.path).catch(() => {});
        }

        // キャッシュから削除
        await cache.redis.del(`images:${imageId}`);
      }
    } catch (error) {
      console.error('画像削除エラー:', error);
    }
  }

  // 画像取得（適切なサイズを選択）
  async getImage(imageId, size = 'medium') {
    const cachedImage = await cache.getCachedImage(imageId);
    if (!cachedImage) {
      return null;
    }

    let targetFile;
    if (size === 'original') {
      targetFile = cachedImage.files.original;
    } else {
      targetFile = cachedImage.files.thumbnails[size] || cachedImage.files.thumbnails.medium;
    }

    if (!targetFile) {
      return null;
    }

    try {
      const buffer = await fs.readFile(targetFile.path);
      return {
        buffer,
        contentType: 'image/webp',
        filename: targetFile.filename,
        size: targetFile.size
      };
    } catch (error) {
      console.error('画像読み込みエラー:', error);
      return null;
    }
  }

  // ディスク使用量取得
  async getDiskUsage() {
    try {
      const getDirectorySize = async (dir) => {
        const files = await fs.readdir(dir);
        let totalSize = 0;
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
        
        return totalSize;
      };

      const originalSize = await getDirectorySize(this.originalDir);
      const thumbnailSize = await getDirectorySize(this.thumbnailDir);

      return {
        original: originalSize,
        thumbnails: thumbnailSize,
        total: originalSize + thumbnailSize,
        formatted: {
          original: this.formatBytes(originalSize),
          thumbnails: this.formatBytes(thumbnailSize),
          total: this.formatBytes(originalSize + thumbnailSize)
        }
      };
    } catch (error) {
      console.error('ディスク使用量取得エラー:', error);
      return null;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 古い画像の定期削除（30日経過）
  async cleanupOldImages() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const keys = await cache.redis.keys('images:*');
      let deletedCount = 0;

      for (const key of keys) {
        const imageData = await cache.redis.get(key);
        if (imageData) {
          const data = JSON.parse(imageData);
          if (new Date(data.processedAt) < thirtyDaysAgo) {
            await this.deleteImage(data.id);
            deletedCount++;
          }
        }
      }

      console.log(`古い画像 ${deletedCount} 件を削除しました`);
      return deletedCount;
    } catch (error) {
      console.error('画像クリーンアップエラー:', error);
      return 0;
    }
  }
}

// 画像アップロードミドルウェア
const imageUploadMiddleware = [
  upload.single('image'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '画像ファイルが必要です'
      });
    }

    try {
      const processor = new ImageProcessor();
      const processedImage = await processor.processImage(req.file.buffer, req.file.originalname);
      req.processedImage = processedImage;
      next();
    } catch (error) {
      console.error('画像処理エラー:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
];

module.exports = {
  ImageProcessor,
  imageUploadMiddleware,
  thumbnailSizes,
  allowedImageTypes,
  maxFileSize
};
