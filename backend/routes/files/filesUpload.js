// ファイルアップロード機能
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const { cacheManager } = require('../../config/cache');
const { authenticateToken } = require('../../middleware/auth');

// アップロード設定
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('サポートされていないファイル形式です'));
    }
  }
});

// 画像処理クラス
class ImageProcessor {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../../uploads');
    this.filesDir = path.join(this.uploadsDir, 'files');
    this.thumbnailSizes = {
      small: { width: 150, height: 150 },
      medium: { width: 400, height: 400 },
      large: { width: 800, height: 800 }
    };
  }

  async ensureDirectories() {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.mkdir(this.filesDir, { recursive: true });
  }

  async processImage(buffer, originalName, userId) {
    await this.ensureDirectories();

    const fileId = uuidv4();
    const timestamp = Date.now();
    const ext = path.extname(originalName).toLowerCase();
    
    // メタデータ取得
    const metadata = await sharp(buffer).metadata();
    
    // 元画像保存（WebP変換）
    const originalFileName = `${fileId}_${timestamp}.webp`;
    const originalPath = path.join(this.filesDir, originalFileName);
    
    await sharp(buffer)
      .webp({ quality: 90 })
      .toFile(originalPath);

    // サムネイル生成
    const thumbnails = {};
    for (const [size, dimensions] of Object.entries(this.thumbnailSizes)) {
      const thumbnailFileName = `${fileId}_${timestamp}_${size}.webp`;
      const thumbnailPath = path.join(this.filesDir, thumbnailFileName);
      
      await sharp(buffer)
        .resize(dimensions.width, dimensions.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
      
      thumbnails[size] = thumbnailFileName;
    }

    return {
      id: fileId,
      originalName,
      fileName: originalFileName,
      thumbnails,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
      mimeType: 'image/webp',
      userId,
      timestamp
    };
  }

  async saveToDatabase(processedImage, userId, fileType) {
    // データベースに保存
    const insertQuery = `
      INSERT INTO files (user_id, original_name, filename, size, mime_type, path, type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `;

    const result = await db.query(insertQuery, [
      userId,
      processedImage.originalName,
      processedImage.fileName,
      processedImage.size,
      processedImage.mimeType,
      `/uploads/files/${processedImage.fileName}`,
      fileType
    ]);

    return {
      id: result[0].id,
      filename: processedImage.fileName,
      file_size: processedImage.size,
      mime_type: processedImage.mimeType,
      width: processedImage.width,
      height: processedImage.height,
      created_at: result[0].created_at,
      type: fileType
    };
  }
}

const imageProcessor = new ImageProcessor();

// 汎用ファイルアップロード（テスト用）
router.post('/upload', 
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'ファイルが必要です'
        });
      }

      const { type } = req.body;
      
      // ファイルタイプが指定されていない場合はmessageとして扱う
      const fileType = type || 'message';
      
      // 画像処理
      const processedImage = await imageProcessor.processImage(
        req.file.buffer,
        req.file.originalname,
        req.user.id
      );

      // データベースに保存
      const fileRecord = await imageProcessor.saveToDatabase(
        processedImage,
        req.user.id,
        fileType
      );

      // チャンネルIDが指定されている場合はメッセージもデータベースに保存
      let messageId = null;
      if (req.body.channel_id) {
        const channelId = parseInt(req.body.channel_id);
        const messageContent = req.body.content || '';
        
        // メッセージをデータベースに保存
        const messageQuery = `
          INSERT INTO messages (channel_id, user_id, content, message_type, image_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, created_at
        `;
        const messageResult = await db.query(messageQuery, [
          channelId,
          req.user.id,
          messageContent,
          'file',
          fileRecord.id
        ]);
        
        messageId = messageResult[0].id;
      }

      // メッセージオブジェクトを作成
      const fileMessage = {
        id: messageId || `file_${fileRecord.id}`,
        content: req.body.content || '',
        user_id: req.user.id,
        author: {
          id: req.user.id,
          userid: req.user.userid,
          nickname: req.user.nickname || req.user.username || 'Unknown User'
        },
        channel_id: parseInt(req.body.channel_id) || null,
        created_at: fileRecord.created_at,
        updated_at: fileRecord.created_at,
        type: 'file',
        message_type: 'file',
        files: [{
          id: fileRecord.id,
          filename: fileRecord.filename,
          original_name: fileRecord.filename,
          file_size: fileRecord.file_size,
          mime_type: fileRecord.mime_type,
          url: `/uploads/files/${fileRecord.filename}`,
          created_at: fileRecord.created_at
        }]
      };

      res.json({
        success: true,
        message: fileMessage,
        file: {
          id: fileRecord.id,
          filename: fileRecord.filename,
          type: fileType,
          size: fileRecord.file_size,
          url: `/uploads/files/${fileRecord.filename}`
        }
      });

    } catch (error) {
      console.error('Upload error:', error);
      
      if (error.message.includes('サポートされていない')) {
        return res.status(400).json({
          success: false,
          error: 'File type not allowed'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'アップロードに失敗しました'
      });
    }
  }
);

// 画像アップロード
router.post('/upload/image', 
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '画像ファイルが必要です'
        });
      }

      // 画像処理
      const processedImage = await imageProcessor.processImage(
        req.file.buffer,
        req.file.originalname,
        req.user.id
      );

      // データベースに保存
      const insertQuery = `
        INSERT INTO files (id, user_id, original_name, file_name, file_size, mime_type, width, height, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING created_at
      `;

      const result = await db.query(insertQuery, [
        processedImage.id,
        req.user.id,
        processedImage.originalName,
        processedImage.fileName,
        processedImage.size,
        processedImage.mimeType,
        processedImage.width,
        processedImage.height
      ]);

      // キャッシュに保存
      if (cacheManager) {
        await cacheManager.cacheImageMetadata(processedImage.id, {
          ...processedImage,
          created_at: result.rows[0].created_at,
          uploader: {
            id: req.user.id,
            userid: req.user.userid,
            nickname: req.user.nickname
          }
        });
      }

      // チャンネルIDが指定されている場合はメッセージもデータベースに保存
      let messageId = null;
      if (req.body.channel_id) {
        const channelId = parseInt(req.body.channel_id);
        const messageContent = req.body.content || '';
        
        // メッセージをデータベースに保存
        const messageQuery = `
          INSERT INTO messages (channel_id, user_id, content, message_type, image_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, created_at
        `;
        const messageResult = await db.query(messageQuery, [
          channelId,
          req.user.id,
          messageContent,
          'image',
          processedImage.id
        ]);
        
        messageId = messageResult[0].id;
      }

      // メッセージオブジェクトを作成
      const imageMessage = {
        id: messageId || `img_${processedImage.id}`,
        content: req.body.content || '',
        user_id: req.user.id,
        author: {
          id: req.user.id,
          userid: req.user.userid,
          nickname: req.user.nickname || req.user.username || req.user.userid
        },
        channel_id: parseInt(req.body.channel_id) || null,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].created_at,
        type: 'image',
        message_type: 'image',
        files: [{
          id: processedImage.id,
          filename: processedImage.fileName,
          original_name: processedImage.originalName,
          file_size: processedImage.size,
          mime_type: processedImage.mimeType,
          width: processedImage.width,
          height: processedImage.height,
          url: `/api/files/image/${processedImage.id}`,
          thumbnailUrl: `/api/files/image/${processedImage.id}/thumbnail/medium`,
          created_at: result.rows[0].created_at
        }]
      };

      res.json({
        success: true,
        message: imageMessage,
        data: {
          id: processedImage.id,
          message: '画像をアップロードしました',
          file: {
            id: processedImage.id,
            originalName: processedImage.originalName,
            width: processedImage.width,
            height: processedImage.height,
            size: processedImage.size,
            thumbnails: Object.keys(processedImage.thumbnails),
            url: `/api/files/image/${processedImage.id}`,
            thumbnailUrl: `/api/files/image/${processedImage.id}/thumbnail/medium`,
            created_at: result.rows[0].created_at
          }
        }
      });

    } catch (error) {
      console.error('Image upload error:', error);
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'ファイルサイズが大きすぎます（最大100MB）'
        });
      }

      if (error.message.includes('サポートされていない')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: '画像のアップロードに失敗しました'
      });
    }
  }
);

// ファイル削除
router.delete('/:fileId', authenticateToken, async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // ファイルの所有者確認
    const fileQuery = 'SELECT user_id, file_name FROM files WHERE id = $1';
    const fileResult = await db.query(fileQuery, [fileId]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ファイルが見つかりません'
      });
    }

    const file = fileResult.rows[0];
    if (file.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '自分のファイルのみ削除できます'
      });
    }

    // データベースから削除
    await db.query('DELETE FROM files WHERE id = $1', [fileId]);

    // 物理ファイル削除
    try {
      const filePath = path.join(imageProcessor.filesDir, file.file_name);
      await fs.unlink(filePath);

      // サムネイル削除
      for (const size of Object.keys(imageProcessor.thumbnailSizes)) {
        const thumbnailName = file.file_name.replace('.webp', `_${size}.webp`);
        const thumbnailPath = path.join(imageProcessor.filesDir, thumbnailName);
        try {
          await fs.unlink(thumbnailPath);
        } catch (err) {
          console.warn('Failed to delete thumbnail:', err.message);
        }
      }
    } catch (err) {
      console.warn('Failed to delete physical file:', err.message);
    }

    // キャッシュクリア
    if (cacheManager) {
      await cacheManager.del(`image_metadata:${fileId}`);
    }

    res.json({
      success: true,
      message: 'ファイルが削除されました'
    });

  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'ファイルの削除に失敗しました'
    });
  }
});

// アップロード履歴取得
router.get('/uploads/history', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const query = `
      SELECT id, original_name, file_size, width, height, created_at
      FROM files
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [req.user.id, limit, offset]);

    const files = result.rows.map(row => ({
      id: row.id,
      originalName: row.original_name,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      created_at: row.created_at,
      url: `/api/files/image/${row.id}`,
      thumbnailUrl: `/api/files/image/${row.id}/thumbnail/medium`
    }));

    res.json({
      success: true,
      files,
      page,
      limit,
      total: result.rowCount
    });

  } catch (error) {
    console.error('Upload history error:', error);
    res.status(500).json({
      success: false,
      message: 'アップロード履歴の取得に失敗しました'
    });
  }
});

module.exports = router;
