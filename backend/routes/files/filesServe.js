// ファイル配信・取得機能
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const db = require('../../config/database');
const { cacheManager } = require('../../config/cache');
const { authenticateToken } = require('../../middleware/auth');

const uploadsDir = path.join(__dirname, '../../../uploads');
const filesDir = path.join(uploadsDir, 'files');

// 画像配信（キャッシュ最適化）
router.get('/image/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const { download } = req.query;

    // キャッシュからメタデータ取得
    let fileMetadata;
    if (cacheManager) {
      fileMetadata = await cacheManager.getCachedImageMetadata(fileId);
    }

    // キャッシュにない場合はデータベースから取得
    if (!fileMetadata) {
      const query = `
        SELECT f.*, u.userid, u.nickname
        FROM files f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = $1
      `;
      const rows = await db.query(query, [fileId]);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ファイルが見つかりません'
        });
      }

      const row = rows[0];
      console.log('🔍 File metadata from DB:', row); // デバッグ用
      
      fileMetadata = {
        id: row.id,
        fileName: row.filename,
        originalName: row.original_name,
        mimeType: row.mime_type,
        fileSize: row.size,
        width: row.width,
        height: row.height,
        created_at: row.created_at,
        uploader: {
          userid: row.userid,
          nickname: row.nickname
        }
      };

      console.log('🔍 Processed file metadata:', fileMetadata); // デバッグ用

      // キャッシュに保存
      if (cacheManager) {
        await cacheManager.cacheImageMetadata(fileId, fileMetadata);
      }
    }

    const filePath = path.join(uploadsDir, 'files', fileMetadata.fileName);

    // ファイルの存在確認
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'ファイルが見つかりません'
      });
    }

    // キャッシュヘッダー設定
    res.set({
      'Content-Type': fileMetadata.mimeType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400', // 1日キャッシュ
      'ETag': `"${fileId}"`,
      'Last-Modified': new Date(fileMetadata.created_at).toUTCString()
    });

    // ファイルサイズが分かる場合のみ設定
    if (fileMetadata.fileSize && typeof fileMetadata.fileSize === 'number') {
      res.set('Content-Length', fileMetadata.fileSize);
    }

    // ダウンロード指定の場合
    if (download === 'true') {
      res.set('Content-Disposition', `attachment; filename="${fileMetadata.originalName}"`);
    } else {
      res.set('Content-Disposition', 'inline');
    }

    // 条件付きリクエスト処理
    const ifNoneMatch = req.get('If-None-Match');
    const ifModifiedSince = req.get('If-Modified-Since');

    if (ifNoneMatch === `"${fileId}"` || 
        (ifModifiedSince && new Date(ifModifiedSince) >= new Date(fileMetadata.created_at))) {
      return res.status(304).end();
    }

    // ファイル送信
    res.sendFile(filePath);

  } catch (error) {
    console.error('File serve error:', error);
    res.status(500).json({
      success: false,
      message: 'ファイルの配信に失敗しました'
    });
  }
});

// サムネイル配信
router.get('/image/:fileId/thumbnail/:size', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const size = req.params.size;

    // サイズ検証
    const allowedSizes = ['small', 'medium', 'large'];
    if (!allowedSizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: '無効なサムネイルサイズです'
      });
    }

    // ファイルメタデータ取得
    let fileMetadata;
    if (cacheManager) {
      fileMetadata = await cacheManager.getCachedImageMetadata(fileId);
    }

    if (!fileMetadata) {
      const query = 'SELECT filename, created_at FROM files WHERE id = $1';
      const rows = await db.query(query, [fileId]);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ファイルが見つかりません'
        });
      }

      fileMetadata = rows[0];
      fileMetadata.fileName = fileMetadata.filename; // プロパティ名を統一
    }

    // サムネイルファイル名生成
    const thumbnailName = fileMetadata.fileName.replace('.webp', `_${size}.webp`);
    const thumbnailPath = path.join(uploadsDir, 'files', thumbnailName);

    // ファイルの存在確認
    try {
      await fs.access(thumbnailPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'サムネイルが見つかりません'
      });
    }

    // キャッシュヘッダー設定
    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=604800', // 7日キャッシュ
      'ETag': `"${fileId}-${size}"`,
      'Last-Modified': new Date(fileMetadata.created_at).toUTCString()
    });

    // 条件付きリクエスト処理
    const ifNoneMatch = req.get('If-None-Match');
    if (ifNoneMatch === `"${fileId}-${size}"`) {
      return res.status(304).end();
    }

    // サムネイル送信
    res.sendFile(thumbnailPath);

  } catch (error) {
    console.error('Thumbnail serve error:', error);
    res.status(500).json({
      success: false,
      message: 'サムネイルの配信に失敗しました'
    });
  }
});

// ファイル情報取得
router.get('/:fileId/info', authenticateToken, async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // キャッシュチェック
    let fileInfo;
    if (cacheManager) {
      fileInfo = await cacheManager.getCachedImageMetadata(fileId);
    }

    if (!fileInfo) {
      const query = `
        SELECT f.*, u.userid, u.nickname, u.avatar_url
        FROM files f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = $1
      `;
      const rows = await db.query(query, [fileId]);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ファイルが見つかりません'
        });
      }

      const row = rows[0];
      fileInfo = {
        id: row.id,
        originalName: row.original_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        width: row.width,
        height: row.height,
        created_at: row.created_at,
        uploader: {
          id: row.user_id,
          userid: row.userid,
          nickname: row.nickname,
          avatar_url: row.avatar_url
        }
      };

      // キャッシュに保存
      if (cacheManager) {
        await cacheManager.cacheImageMetadata(fileId, fileInfo);
      }
    }

    res.json({
      success: true,
      file: {
        ...fileInfo,
        url: `/api/files/image/${fileId}`,
        downloadUrl: `/api/files/image/${fileId}$1download=true`,
        thumbnails: {
          small: `/api/files/image/${fileId}/thumbnail/small`,
          medium: `/api/files/image/${fileId}/thumbnail/medium`,
          large: `/api/files/image/${fileId}/thumbnail/large`
        }
      }
    });

  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({
      success: false,
      message: 'ファイル情報の取得に失敗しました'
    });
  }
});

// ファイル一覧取得（管理者用）
router.get('/list', authenticateToken, async (req, res) => {
  try {
    // 管理者権限チェック（例：role_id = 1 が管理者）
    const userQuery = 'SELECT role_id FROM guild_members WHERE user_id = $1 AND role_id = 1';
    const userResult = await db.query(userQuery, [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: '管理者権限が必要です'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        f.id,
        f.original_name,
        f.file_size,
        f.width,
        f.height,
        f.created_at,
        u.userid,
        u.nickname
      FROM files f
      JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const files = result.rows.map(row => ({
      id: row.id,
      originalName: row.original_name,
      fileSize: row.file_size,
      dimensions: `${row.width}x${row.height}`,
      created_at: row.created_at,
      uploader: {
        userid: row.userid,
        nickname: row.nickname
      },
      url: `/api/files/image/${row.id}`,
      thumbnailUrl: `/api/files/image/${row.id}/thumbnail/medium`
    }));

    // 統計情報も含める
    const statsQuery = `
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        AVG(file_size) as avg_size
      FROM files
    `;
    const statsResult = await db.query(statsQuery);
    const stats = statsResult.rows[0];

    res.json({
      success: true,
      files,
      page,
      limit,
      total: result.rowCount,
      stats: {
        totalFiles: parseInt(stats.total_files),
        totalSize: parseInt(stats.total_size),
        averageSize: parseFloat(stats.avg_size)
      }
    });

  } catch (error) {
    console.error('File list error:', error);
    res.status(500).json({
      success: false,
      message: 'ファイル一覧の取得に失敗しました'
    });
  }
});

module.exports = router;
