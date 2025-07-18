// メッセージの統計情報とメタデータ
const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { cacheManager } = require('../../config/cache');
const { authenticateToken } = require('../../middleware/auth');

// チャンネルのメッセージ統計
router.get('/channels/:channelId/stats', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);

    // キャッシュチェック
    if (cacheManager) {
      const cacheKey = `channel_stats:${channelId}`;
      const cachedStats = await cacheManager.get(cacheKey);
      if (cachedStats) {
        return res.json({
          success: true,
          stats: cachedStats,
          cached: true
        });
      }
    }

    // チャンネルアクセス権限チェック
    const channelQuery = `
      SELECT c.*, gm.role_id 
      FROM channels c
      LEFT JOIN guild_members gm ON c.guild_id = gm.guild_id AND gm.user_id = $1
      WHERE c.id = $2
    `;
    const channelResult = await db.query(channelQuery, [req.user.id, channelId]);
    
    if (channelResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'チャンネルが見つかりません'
      });
    }

    const channel = channelResult.rows[0];
    
    if (channel.type !== 'dm' && !channel.role_id) {
      return res.status(403).json({
        success: false,
        message: 'このチャンネルにアクセスする権限がありません'
      });
    }

    // 統計情報クエリ
    const statsQuery = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN image_id IS NOT NULL THEN 1 END) as image_messages,
        MAX(created_at) as latest_message,
        MIN(created_at) as earliest_message,
        AVG(LENGTH(content)) as avg_message_length
      FROM messages 
      WHERE channel_id = $1
    `;

    const statsResult = await db.query(statsQuery, [channelId]);
    const stats = statsResult.rows[0];

    // 最も活発なユーザー（上位5人）
    const topUsersQuery = `
      SELECT 
        u.id,
        u.userid,
        u.nickname,
        u.avatar_url,
        COUNT(m.id) as message_count
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = $1
      GROUP BY u.id, u.userid, u.nickname, u.avatar_url
      ORDER BY message_count DESC
      LIMIT 5
    `;

    const topUsersResult = await db.query(topUsersQuery, [channelId]);

    // 時間別活動統計（過去24時間）
    const hourlyStatsQuery = `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as message_count
      FROM messages 
      WHERE channel_id = $1 
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;

    const hourlyStatsResult = await db.query(hourlyStatsQuery, [channelId]);

    const channelStats = {
      total_messages: parseInt(stats.total_messages),
      unique_users: parseInt(stats.unique_users),
      image_messages: parseInt(stats.image_messages),
      latest_message: stats.latest_message,
      earliest_message: stats.earliest_message,
      avg_message_length: parseFloat(stats.avg_message_length) || 0,
      top_users: topUsersResult.rows,
      hourly_activity: hourlyStatsResult.rows.map(row => ({
        hour: parseInt(row.hour),
        count: parseInt(row.message_count)
      }))
    };

    // キャッシュに保存（30分）
    if (cacheManager) {
      const cacheKey = `channel_stats:${channelId}`;
      await cacheManager.set(cacheKey, channelStats, 1800);
    }

    res.json({
      success: true,
      stats: channelStats,
      cached: false
    });

  } catch (error) {
    console.error('Channel stats error:', error);
    res.status(500).json({
      success: false,
      message: 'チャンネル統計の取得に失敗しました'
    });
  }
});

// ユーザーのメッセージ統計
router.get('/users/:userId/stats', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { guildId } = req.query;

    // 基本的なユーザー統計
    let statsQuery = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT channel_id) as channels_used,
        COUNT(CASE WHEN image_id IS NOT NULL THEN 1 END) as image_messages,
        MAX(created_at) as latest_message,
        MIN(created_at) as earliest_message,
        AVG(LENGTH(content)) as avg_message_length
      FROM messages m
      WHERE user_id = $1
    `;

    const queryParams = [userId];

    // ギルド指定がある場合
    if (guildId) {
      statsQuery += ` AND channel_id IN (SELECT id FROM channels WHERE guild_id = $2)`;
      queryParams.push(parseInt(guildId));

      // ギルドメンバーかチェック
      const memberQuery = 'SELECT role_id FROM guild_members WHERE guild_id = $1 AND user_id = $2';
      const memberResult = await db.query(memberQuery, [guildId, req.user.id]);
      
      if (memberResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'このギルドの統計を表示する権限がありません'
        });
      }
    }

    const statsResult = await db.query(statsQuery, queryParams);
    const stats = statsResult.rows[0];

    // よく使用する絵文字（リアクション）
    let emojiQuery = `
      SELECT 
        emoji,
        COUNT(*) as usage_count
      FROM reactions r
      JOIN messages m ON r.message_id = m.id
      WHERE r.user_id = $1
    `;

    if (guildId) {
      emojiQuery += ` AND m.channel_id IN (SELECT id FROM channels WHERE guild_id = $2)`;
    }

    emojiQuery += ` GROUP BY emoji ORDER BY usage_count DESC LIMIT 10`;

    const emojiResult = await db.query(emojiQuery, queryParams);

    const userStats = {
      total_messages: parseInt(stats.total_messages),
      channels_used: parseInt(stats.channels_used),
      image_messages: parseInt(stats.image_messages),
      latest_message: stats.latest_message,
      earliest_message: stats.earliest_message,
      avg_message_length: parseFloat(stats.avg_message_length) || 0,
      favorite_emojis: emojiResult.rows.map(row => ({
        emoji: row.emoji,
        count: parseInt(row.usage_count)
      }))
    };

    res.json({
      success: true,
      stats: userStats
    });

  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー統計の取得に失敗しました'
    });
  }
});

// メッセージのメタデータ取得
router.get('/:messageId/metadata', authenticateToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);

    const query = `
      SELECT 
        m.id,
        m.channel_id,
        m.created_at,
        m.updated_at,
        m.edited,
        m.message_type,
        c.guild_id,
        COUNT(r.id) as reaction_count,
        COUNT(DISTINCT r.user_id) as unique_reactors
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      LEFT JOIN reactions r ON m.id = r.message_id
      WHERE m.id = $1
      GROUP BY m.id, m.channel_id, m.created_at, m.updated_at, m.edited, m.message_type, c.guild_id
    `;

    const result = await db.query(query, [messageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つかりません'
      });
    }

    const row = result.rows[0];

    // アクセス権限チェック
    if (row.guild_id) {
      const memberQuery = 'SELECT role_id FROM guild_members WHERE guild_id = $1 AND user_id = $2';
      const memberResult = await db.query(memberQuery, [row.guild_id, req.user.id]);
      
      if (memberResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'このメッセージにアクセスする権限がありません'
        });
      }
    }

    // 返信されたメッセージ数
    const repliesQuery = 'SELECT COUNT(*) as reply_count FROM messages WHERE reply_to = $1';
    const repliesResult = await db.query(repliesQuery, [messageId]);

    const metadata = {
      id: row.id,
      channel_id: row.channel_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      edited: row.edited,
      message_type: row.message_type,
      reaction_count: parseInt(row.reaction_count),
      unique_reactors: parseInt(row.unique_reactors),
      reply_count: parseInt(repliesResult.rows[0].reply_count)
    };

    res.json({
      success: true,
      metadata
    });

  } catch (error) {
    console.error('Message metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージメタデータの取得に失敗しました'
    });
  }
});

module.exports = router;
