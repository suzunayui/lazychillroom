const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// Get pinned messages for a channel
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;

    // Check if user has access to this channel
    const channelAccess = await query(`
      SELECT c.id 
      FROM channels c
      JOIN guild_members gm ON c.guild_id = gm.guild_id
      WHERE c.id = $1 AND gm.user_id = $2 AND gm.is_active = true
    `, [channelId, req.user.id]);

    if (channelAccess.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'このチャンネルにアクセスする権限がありません'
      });
    }

    // Get pinned messages
    const pinnedMessages = await query(`
      SELECT 
        pm.id as pin_id,
        m.id,
        m.content,
        m.channel_id,
        m.user_id,
        m.created_at,
        m.updated_at,
        u.userid,
        u.avatar_url,
        pm.pinned_by,
        pm.created_at as pinned_at,
        pu.userid as pinned_by_userid
      FROM pinned_messages pm
      JOIN messages m ON pm.message_id = m.id
      JOIN users u ON m.user_id = u.id
      JOIN users pu ON pm.pinned_by = pu.id
      WHERE pm.channel_id = $1
      ORDER BY pm.created_at DESC
    `, [channelId]);

    res.json({
      success: true,
      pinned_messages: pinnedMessages
    });

  } catch (error) {
    console.error('Get pinned messages error:', error);
    res.status(500).json({
      success: false,
      message: 'ピン留めメッセージの取得に失敗しました'
    });
  }
});

// Pin a message
router.post('/:channelId/:messageId', async (req, res) => {
  try {
    const { channelId, messageId } = req.params;

    // Check if user has permission to pin messages (admin or owner)
    const permission = await query(`
      SELECT gm.role 
      FROM guild_members gm
      JOIN channels c ON gm.guild_id = c.guild_id
      WHERE c.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')
    `, [channelId, req.user.id]);

    if (permission.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'メッセージをピン留めする権限がありません'
      });
    }

    // Check if message exists and belongs to this channel
    const message = await query(
      'SELECT id, content FROM messages WHERE id = $1 AND channel_id = $2',
      [messageId, channelId]
    );

    if (message.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つかりません'
      });
    }

    // Check if message is already pinned
    const existingPin = await query(
      'SELECT id FROM pinned_messages WHERE message_id = $1',
      [messageId]
    );

    if (existingPin.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'このメッセージは既にピン留めされています'
      });
    }

    // Pin the message
    await query(
      'INSERT INTO pinned_messages (message_id, channel_id, pinned_by) VALUES ($1, $2, $3)',
      [messageId, channelId, req.user.id]
    );

    // Get pinned message with user info
    const pinnedMessage = await query(`
      SELECT 
        pm.id as pin_id,
        m.id,
        m.content,
        m.channel_id,
        m.user_id,
        m.created_at,
        m.updated_at,
        u.userid,
        u.avatar_url,
        pm.pinned_by,
        pm.created_at as pinned_at,
        pu.userid as pinned_by_userid
      FROM pinned_messages pm
      JOIN messages m ON pm.message_id = m.id
      JOIN users u ON m.user_id = u.id
      JOIN users pu ON pm.pinned_by = pu.id
      WHERE pm.message_id = $1
    `, [messageId]);

    // Emit to socket.io for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`channel_${channelId}`).emit('message_pinned', pinnedMessage[0]);
    }

    res.json({
      success: true,
      pinned_message: pinnedMessage[0],
      message: 'メッセージをピン留めしました'
    });

  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージのピン留めに失敗しました'
    });
  }
});

// Unpin a message
router.delete('/:channelId/:messageId', async (req, res) => {
  try {
    const { channelId, messageId } = req.params;

    // Check if user has permission to unpin messages (admin or owner)
    const permission = await query(`
      SELECT gm.role 
      FROM guild_members gm
      JOIN channels c ON gm.guild_id = c.guild_id
      WHERE c.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')
    `, [channelId, req.user.id]);

    if (permission.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'メッセージのピン留めを解除する権限がありません'
      });
    }

    // Check if message is pinned
    const pinnedMessage = await query(
      'SELECT id FROM pinned_messages WHERE message_id = $1 AND channel_id = $2',
      [messageId, channelId]
    );

    if (pinnedMessage.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ピン留めされたメッセージが見つかりません'
      });
    }

    // Unpin the message
    await query(
      'DELETE FROM pinned_messages WHERE message_id = $1 AND channel_id = $2',
      [messageId, channelId]
    );

    // Emit to socket.io for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`channel_${channelId}`).emit('message_unpinned', {
        messageId: parseInt(messageId),
        channelId: parseInt(channelId)
      });
    }

    res.json({
      success: true,
      message: 'メッセージのピン留めを解除しました'
    });

  } catch (error) {
    console.error('Unpin message error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージのピン留め解除に失敗しました'
    });
  }
});

module.exports = router;
