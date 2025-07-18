const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// ユーザーステータス更新
router.put('/status', async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.user.id;

    // 有効なステータス値をチェック
    const validStatuses = ['online', 'away', 'busy', 'invisible', 'offline'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '無効なステータスです'
      });
    }

    // ユーザーステータスを更新
    await query(
      'UPDATE users SET status = $1, last_activity = NOW() WHERE id = $2',
      [status, userId]
    );

    // Socket.ioでステータス変更を通知
    const io = req.app.get('io');
    if (io) {
      // ユーザーが所属するすべてのギルドのメンバーに通知
      const guilds = await query(`
        SELECT DISTINCT g.id as guild_id
        FROM guilds g
        JOIN guild_members gm ON g.id = gm.guild_id
        WHERE gm.user_id = $1 AND gm.is_active = true
      `, [userId]);

      guilds.forEach(guild => {
        io.to(`guild_${guild.guild_id}`).emit('user_status_changed', {
          userId: userId,
          userid: req.user.userid,
          status: status,
          timestamp: new Date()
        });
      });
    }

    res.json({
      success: true,
      status: status,
      message: 'ステータスを更新しました'
    });

  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({
      success: false,
      message: 'ステータスの更新に失敗しました'
    });
  }
});

// オンラインユーザー一覧取得
router.get('/online/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;

    // ユーザーがこのギルドのメンバーかチェック
    const memberCheck = await query(`
      SELECT id FROM guild_members 
      WHERE guild_id = $1 AND user_id = $2
    `, [guildId, req.user.id]);

    if (memberCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'このギルドのメンバーではありません'
      });
    }

    // オンラインユーザーを取得（5分以内にアクティビティがあるユーザー）
    const onlineUsers = await query(`
      SELECT 
        u.id,
        u.userid,
        u.avatar_url,
        u.status,
        u.last_activity,
        gm.role
      FROM users u
      JOIN guild_members gm ON u.id = gm.user_id
      WHERE gm.guild_id = $1 AND gm.is_active = true
        AND (u.status != 'invisible' OR u.id = $1)
        AND u.last_activity >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      ORDER BY 
        CASE u.status 
          WHEN 'online' THEN 1 
          WHEN 'away' THEN 2 
          WHEN 'busy' THEN 3 
          ELSE 4 
        END,
        u.userid
    `, [guildId, req.user.id]);

    res.json({
      success: true,
      online_users: onlineUsers
    });

  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'オンラインユーザーの取得に失敗しました'
    });
  }
});

// ユーザーアクティビティ更新（ハートビート）
router.post('/heartbeat', async (req, res) => {
  try {
    const userId = req.user.id;

    // 最終アクティビティ時間を更新
    await query(
      'UPDATE users SET last_activity = NOW() WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: 'ハートビート更新完了'
    });

  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'ハートビートの更新に失敗しました'
    });
  }
});

// ユーザープレゼンス情報取得
router.get('/presence/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userPresence = await query(`
      SELECT 
        id,
        userid,
        avatar_url,
        status,
        last_activity,
        created_at
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (userPresence.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    const user = userPresence[0];
    
    // プライバシー設定: invisibleの場合は限定的な情報のみ
    if (user.status === 'invisible' && user.id !== req.user.id) {
      user.status = 'offline';
      user.last_activity = null;
    }

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('Get user presence error:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザープレゼンス情報の取得に失敗しました'
    });
  }
});

module.exports = router;
