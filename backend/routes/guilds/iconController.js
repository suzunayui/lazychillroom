const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { query } = require('../../config/database');

// Guild icon upload operations
class IconController {
  static getIconUpload() {
    const iconStorage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'server_icons');
          await fs.mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const uniqueName = `server_${req.body.guild_id || 'temp'}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

    return multer({
      storage: iconStorage,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('サーバーアイコンは画像ファイルのみアップロード可能です'));
        }
      }
    });
  }

  // Upload server icon
  static async uploadIcon(req, res) {
    try {
      const { guild_id } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'ファイルがアップロードされていません'
        });
      }

      // Check if user has permission to manage server
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guild_id, req.user.id]
      );

      if (memberCheck.length === 0 || !['owner', 'admin'].includes(memberCheck[0].role)) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(console.error);
        return res.status(403).json({
          success: false,
          message: 'サーバーを管理する権限がありません'
        });
      }

      const iconUrl = `/uploads/server_icons/${req.file.filename}`;

      // Update guild icon
      await query(
        'UPDATE guilds SET icon_url = $1 WHERE id = $2',
        [iconUrl, guild_id]
      );

      res.json({
        success: true,
        message: 'サーバーアイコンを更新しました',
        icon_url: iconUrl
      });

    } catch (error) {
      console.error('Upload server icon error:', error);
      
      // Clean up uploaded file if there was an error
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      
      res.status(500).json({
        success: false,
        message: 'サーバーアイコンのアップロードに失敗しました'
      });
    }
  }
}

module.exports = IconController;
