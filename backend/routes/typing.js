const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// Store typing users by channel (in memory for demo)
const typingUsers = new Map(); // channelId -> Set of userIds

// Start typing in a channel
router.post('/start', async (req, res) => {
  try {
    const { channel_id } = req.body;

    if (!channel_id) {
      return res.status(400).json({
        success: false,
        message: 'チャンネルIDが必要です'
      });
    }

    // Check if user has access to this channel
    let hasAccess = false;

    // First check if it's a guild channel
    const guildChannelAccess = await query(`
      SELECT c.id, c.name, c.guild_id 
      FROM channels c
      JOIN guild_members gm ON c.guild_id = gm.guild_id
      WHERE c.id = $1 AND gm.user_id = $2 AND gm.is_active = true
    `, [channel_id, req.user.id]);

    if (guildChannelAccess.length > 0) {
      hasAccess = true;
    } else {
      // Check if it's a DM channel the user participates in
      const dmChannelAccess = await query(`
        SELECT c.id, c.name, c.type
        FROM channels c
        JOIN dm_participants dp ON c.id = dp.channel_id
        WHERE c.id = $1 AND c.type = 'dm' AND dp.user_id = $2
      `, [channel_id, req.user.id]);

      if (dmChannelAccess.length > 0) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'このチャンネルにアクセスする権限がありません'
      });
    }

    // Add user to typing users for this channel
    if (!typingUsers.has(channel_id)) {
      typingUsers.set(channel_id, new Set());
    }
    typingUsers.get(channel_id).add(req.user.id);

    // Emit typing start event via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`channel_${channel_id}`).emit('typing_start', {
        userId: req.user.id,
        userid: req.user.userid,
        channelId: channel_id
      });
    }

    res.json({
      success: true,
      message: 'タイピング開始'
    });

  } catch (error) {
    console.error('Start typing error:', error);
    res.status(500).json({
      success: false,
      message: 'タイピング状態の送信に失敗しました'
    });
  }
});

// Stop typing in a channel
router.post('/stop', async (req, res) => {
  try {
    const { channel_id } = req.body;

    if (!channel_id) {
      return res.status(400).json({
        success: false,
        message: 'チャンネルIDが必要です'
      });
    }

    // Remove user from typing users for this channel
    if (typingUsers.has(channel_id)) {
      typingUsers.get(channel_id).delete(req.user.id);
      
      // Clean up empty sets
      if (typingUsers.get(channel_id).size === 0) {
        typingUsers.delete(channel_id);
      }
    }

    // Emit typing stop event via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`channel_${channel_id}`).emit('typing_stop', {
        userId: req.user.id,
        userid: req.user.userid,
        channelId: channel_id
      });
    }

    res.json({
      success: true,
      message: 'タイピング停止'
    });

  } catch (error) {
    console.error('Stop typing error:', error);
    res.status(500).json({
      success: false,
      message: 'タイピング状態の送信に失敗しました'
    });
  }
});

// Get current typing users for a channel
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;

    // Check if user has access to this channel
    let hasAccess = false;

    // First check if it's a guild channel
    const guildChannelAccess = await query(`
      SELECT c.id, c.name, c.guild_id 
      FROM channels c
      JOIN guild_members gm ON c.guild_id = gm.guild_id
      WHERE c.id = $1 AND gm.user_id = $2 AND gm.is_active = true
    `, [channelId, req.user.id]);

    if (guildChannelAccess.length > 0) {
      hasAccess = true;
    } else {
      // Check if it's a DM channel the user participates in
      const dmChannelAccess = await query(`
        SELECT c.id, c.name, c.type
        FROM channels c
        JOIN dm_participants dp ON c.id = dp.channel_id
        WHERE c.id = $1 AND c.type = 'dm' AND dp.user_id = $2
      `, [channelId, req.user.id]);

      if (dmChannelAccess.length > 0) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'このチャンネルにアクセスする権限がありません'
      });
    }

    // Get typing users for this channel
    const typingUserIds = typingUsers.get(parseInt(channelId)) || new Set();
    
    // Get user info for typing users
    if (typingUserIds.size > 0) {
      const userIds = Array.from(typingUserIds);
      const placeholders = userIds.map(() => '$1').join(',');
      const users = await query(
        `SELECT id, userid FROM users WHERE id IN (${placeholders})`,
        userIds
      );

      res.json({
        success: true,
        typing_users: users
      });
    } else {
      res.json({
        success: true,
        typing_users: []
      });
    }

  } catch (error) {
    console.error('Get typing users error:', error);
    res.status(500).json({
      success: false,
      message: 'タイピング状態の取得に失敗しました'
    });
  }
});

module.exports = router;
