const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  userid: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(3).max(30).required().messages({
    'string.pattern.base': 'ユーザーIDは半角英数字・アンダーバー・ハイフンのみで入力してください',
    'string.min': 'ユーザーIDは3文字以上で入力してください',
    'string.max': 'ユーザーIDは30文字以内で入力してください'
  }),
  nickname: Joi.string().min(1).max(50).required().messages({
    'string.min': 'ニックネームを入力してください',
    'string.max': 'ニックネームは50文字以内で入力してください'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'パスワードは6文字以上で入力してください'
  })
});

const loginSchema = Joi.object({
  userid: Joi.string().required(),
  password: Joi.string().required()
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { userid, nickname, password } = value;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE userid = $1',
      [userid]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'このユーザーIDは既に使用されています'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Use transaction to create user, personal server, and add to default guild
    const newUserId = await transaction(async (connection) => {
      // Check if this is the first user
      const userCountResult = await connection.query('SELECT COUNT(*) as count FROM users');
      const isFirstUser = userCountResult.rows[0].count === '0';

      // Create user
      const userResult = await connection.query(
        'INSERT INTO users (userid, nickname, password_hash, is_admin, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
        [userid, nickname, hashedPassword, isFirstUser]
      );

      const userId_new = userResult.rows[0].id;

      // If this is the first user, create the default public guild
      let defaultGuildId = null;
      if (isFirstUser) {
        const defaultGuildResult = await connection.query(
          'INSERT INTO guilds (name, description, owner_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
          ['LazyChillRoom 公式', 'LazyChillRoomの公式サーバーです', userId_new]
        );
        
        defaultGuildId = defaultGuildResult.rows[0].id;

        // Add first user as owner of default guild
        await connection.query(
          'INSERT INTO guild_members (guild_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW())',
          [defaultGuildId, userId_new, 'owner']
        );

        // Create default channels for public guild
        const publicChannels = [
          { name: '一般', type: 'text', position: 0 },
          { name: '雑談', type: 'text', position: 1 },
          { name: '技術', type: 'text', position: 2 },
          { name: '画像', type: 'text', position: 3 }
        ];

        for (const channel of publicChannels) {
          await connection.query(
            'INSERT INTO channels (guild_id, name, type, position, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [defaultGuildId, channel.name, channel.type, channel.position]
          );
        }

        console.log(`最初のユーザー ${userid} がデフォルトギルド (ID: ${defaultGuildId}) のオーナーとなりました`);
      }

      // Create personal server (マイサーバー)
      const personalServerResult = await connection.query(
        'INSERT INTO guilds (name, description, owner_id, is_personal_server, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
        [`${nickname}のマイサーバー`, '個人用サーバーです', userId_new, true]
      );

      const personalServerId = personalServerResult.rows[0].id;

      // Add user as owner of personal server
      await connection.query(
        'INSERT INTO guild_members (guild_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW())',
        [personalServerId, userId_new, 'owner']
      );

      // Create default channels for personal server
      const channels = [
        { name: '公開', type: 'text', position: 0 },
        { name: '非公開', type: 'text', position: 1 },
        { name: '設定', type: 'text', position: 2 }
      ];

      for (const channel of channels) {
        await connection.query(
          'INSERT INTO channels (guild_id, name, type, position, created_at) VALUES ($1, $2, $3, $4, NOW())',
          [personalServerId, channel.name, channel.type, channel.position]
        );
      }

      // Add user to default guild if it exists and user is not the first user
      if (!isFirstUser) {
        try {
          // Find the default public guild (should be the first one created)
          const defaultGuildQuery = await connection.query(
            'SELECT id FROM guilds ORDER BY id ASC LIMIT 1'
          );
          
          if (defaultGuildQuery.rows.length > 0) {
            const defaultGuildId = defaultGuildQuery.rows[0].id;
            await connection.query(
              'INSERT INTO guild_members (guild_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW())',
              [defaultGuildId, userId_new, 'member']
            );
          }
        } catch (guildError) {
          console.error('デフォルトギルドへの追加に失敗:', guildError);
          // デフォルトギルドが存在しない場合はスキップ
        }
      }

      console.log(`新規ユーザー ${userid} (ID: ${userId_new}) とマイサーバー (ID: ${personalServerId}) を作成しました`);
      if (isFirstUser) {
        console.log(`${userid} が最初のユーザーとして管理者権限を取得しました`);
      }
      
      return userId_new;
    });

    // Generate token
    const token = generateToken(newUserId);

    // Get user data (without password)
    const userData = await query(
      'SELECT id, userid, nickname, avatar_url, created_at FROM users WHERE id = $1',
      [newUserId]
    );

    res.status(201).json({
      success: true,
      message: 'ユーザー登録が完了しました',
      token,
      user: userData[0]
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { userid, password } = value;

    // Find user
    const users = await query(
      'SELECT id, userid, nickname, password_hash, avatar_url, status, created_at FROM users WHERE userid = $1',
      [userid]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '認証情報が正しくありません'
      });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '認証情報が正しくありません'
      });
    }

    // Update last activity
    await query(
      'UPDATE users SET last_activity = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate token
    const token = generateToken(user.id);

    // Remove password hash from user data (ステータスはDBから取得したものを保持)
    delete user.password_hash;

    res.json({
      success: true,
      message: 'ログインしました',
      token,
      user
    });

  } catch (error) {
    console.error('❌ Login error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // SQLエラーの場合は詳細情報を出力
    if (error.code) {
      console.error('SQL Error code:', error.code);
      console.error('SQL Error errno:', error.errno);
      console.error('SQL Error sqlMessage:', error.sqlMessage);
    }
    
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      // 開発環境でのみエラー詳細を含める
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        details: error.code || 'Unknown error'
      })
    });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔍 /auth/verify リクエスト開始');
  console.log('📝 Authorization header:', authHeader ? 'あり' : 'なし');
  console.log('🔑 Token extracted:', token ? 'あり' : 'なし');

  if (!token) {
    console.log('❌ トークンが見つかりません');
    return res.status(401).json({
      success: false,
      message: '認証トークンが必要です'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    console.log('🔐 JWT検証開始...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ JWT検証成功:', { userId: decoded.userId });
    
    const user = await query(
      'SELECT id, userid, nickname, avatar_url, status, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    console.log('🗃️ データベース検索結果:', user.length > 0 ? `ユーザー見つかりました (ID: ${user[0].id})` : 'ユーザーが見つかりませんでした');

    if (!user || user.length === 0) {
      console.log('❌ ユーザーがデータベースに存在しません');
      return res.status(401).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    console.log('✅ 認証検証成功:', user[0].userid);
    res.json({
      success: true,
      user: user[0]
    });

  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    if (error.name === 'TokenExpiredError') {
      console.log('⏰ トークンの有効期限切れ');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('🔐 無効なトークン形式');
    }
    res.status(401).json({
      success: false,
      message: '無効なトークンです'
    });
  }
});

module.exports = router;
