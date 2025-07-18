const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

const router = express.Router();

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'avatars');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `avatar_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB for avatars
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('アバターは画像ファイルのみアップロード可能です'));
    }
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const user = await query(
      'SELECT id, userid, email, avatar_url, created_at, last_login FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    res.json({
      success: true,
      user: user[0]
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'プロフィールの取得に失敗しました'
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { userid } = req.body;

    if (!userid || userid.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名は必須です'
      });
    }

    // Check if userid is already taken by another user
    const existingUser = await query(
      'SELECT id FROM users WHERE userid = $1 AND id != $2',
      [userid.trim(), req.user.id]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'このユーザー名は既に使用されています'
      });
    }

    // Update userid
    await query(
      'UPDATE users SET userid = $1 WHERE id = $2',
      [userid.trim(), req.user.id]
    );

    // Get updated user data
    const updatedUser = await query(
      'SELECT id, userid, email, avatar_url, created_at, last_login FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'プロフィールを更新しました',
      user: updatedUser[0]
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'プロフィールの更新に失敗しました'
    });
  }
});

// Upload avatar
router.post('/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'アバター画像が選択されていません'
      });
    }

    // Get old avatar path for cleanup
    const oldAvatar = await query(
      'SELECT avatar_url FROM users WHERE id = $1',
      [req.user.id]
    );

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Update user avatar URL
    await query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, req.user.id]
    );

    // Delete old avatar file if it exists
    if (oldAvatar[0] && oldAvatar[0].avatar_url) {
      const oldAvatarPath = path.join(process.cwd(), 'public', oldAvatar[0].avatar_url);
      try {
        await fs.unlink(oldAvatarPath);
      } catch (error) {
        // Ignore error if file doesn't exist
        console.log('Old avatar file not found or could not be deleted');
      }
    }

    res.json({
      success: true,
      message: 'アバターを更新しました',
      avatar_url: avatarUrl
    });

  } catch (error) {
    // Delete the uploaded file if there was an error
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    console.error('Avatar upload error:', error);

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'ファイルサイズが大きすぎます（最大5MB）'
      });
    }

    res.status(500).json({
      success: false,
      message: 'アバターのアップロードに失敗しました'
    });
  }
});

// Search users
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: '検索キーワードは2文字以上で入力してください'
      });
    }

    const searchTerm = `%${q.trim()}%`;
    
    const users = await query(`
      SELECT id, userid, avatar_url, created_at
      FROM users 
      WHERE userid LIKE $1 AND id != $2
      ORDER BY userid ASC
      LIMIT $3
    `, [searchTerm, req.user.id, parseInt(limit)]);

    res.json({
      success: true,
      users
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー検索に失敗しました'
    });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await query(
      'SELECT id, userid, avatar_url, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    res.json({
      success: true,
      user: user[0]
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー情報の取得に失敗しました'
    });
  }
});

module.exports = router;
