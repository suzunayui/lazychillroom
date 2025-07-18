const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');

const router = express.Router();

// Validation schemas
const reactionSchema = Joi.object({
  message_id: Joi.number().integer().positive().required(),
  emoji_unicode: Joi.string().max(50).required()
});

// Add reaction to a message
router.post('/', async (req, res) => {
  try {
    // Validate input
    const { error, value } = reactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { message_id, emoji_unicode } = value;

    // Check if message exists and user has access to it
    const messageAccess = await query(`
      SELECT m.id, m.channel_id, c.guild_id
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      LEFT JOIN guild_members gm ON c.guild_id = gm.guild_id
      LEFT JOIN dm_participants dp ON c.id = dp.channel_id AND c.type = 'dm'
      WHERE m.id = $1 
      AND (
        (c.type != 'dm' AND gm.user_id = $1 AND gm.is_active = true)
        OR 
        (c.type = 'dm' AND dp.user_id = $1)
      )
    `, [message_id, req.user.id, req.user.id]);

    if (messageAccess.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'このメッセージにリアクションする権限がありません'
      });
    }

    const message = messageAccess[0];

    // Check if user already reacted with this emoji
    const existingReaction = await query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji_unicode = $3',
      [message_id, req.user.id, emoji_unicode]
    );

    if (existingReaction.length > 0) {
      // Remove existing reaction (toggle)
      await query(
        'DELETE FROM message_reactions WHERE id = $1',
        [existingReaction[0].id]
      );

      // Get updated reaction counts
      const reactionCounts = await query(`
        SELECT 
          emoji_unicode,
          COUNT(*) as count,
          string_agg(u.userid, ', ' ORDER BY u.userid) as users
        FROM message_reactions mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = $1
        GROUP BY emoji_unicode
        ORDER BY emoji_unicode
      `, [message_id]);

      // Emit socket event
      const io = req.app.get('io');
      if (io) {
        io.to(`channel_${message.channel_id}`).emit('reaction_removed', {
          messageId: message_id,
          userId: req.user.id,
          emoji: emoji_unicode,
          reactions: reactionCounts
        });
      }

      res.json({
        success: true,
        message: 'リアクションを削除しました',
        action: 'removed',
        reactions: reactionCounts
      });
    } else {
      // Add new reaction
      await query(
        'INSERT INTO message_reactions (message_id, user_id, emoji_unicode, created_at) VALUES ($1, $2, $3, NOW())',
        [message_id, req.user.id, emoji_unicode]
      );

      // Get updated reaction counts
      const reactionCounts = await query(`
        SELECT 
          emoji_unicode,
          COUNT(*) as count,
          string_agg(u.userid, ', ' ORDER BY u.userid) as users
        FROM message_reactions mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = $1
        GROUP BY emoji_unicode
        ORDER BY emoji_unicode
      `, [message_id]);

      // Emit socket event
      const io = req.app.get('io');
      if (io) {
        io.to(`channel_${message.channel_id}`).emit('reaction_added', {
          messageId: message_id,
          userId: req.user.id,
          userid: req.user.userid,
          emoji: emoji_unicode,
          reactions: reactionCounts
        });
      }

      res.json({
        success: true,
        message: 'リアクションを追加しました',
        action: 'added',
        reactions: reactionCounts
      });
    }

  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'リアクションの追加に失敗しました'
    });
  }
});

// Get reactions for a message
router.get('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if message exists and user has access to it
    const messageAccess = await query(`
      SELECT m.id, m.channel_id, c.guild_id
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      LEFT JOIN guild_members gm ON c.guild_id = gm.guild_id
      LEFT JOIN dm_participants dp ON c.id = dp.channel_id AND c.type = 'dm'
      WHERE m.id = $1 
      AND (
        (c.type != 'dm' AND gm.user_id = $1 AND gm.is_active = true)
        OR 
        (c.type = 'dm' AND dp.user_id = $1)
      )
    `, [messageId, req.user.id, req.user.id]);

    if (messageAccess.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'このメッセージにアクセスする権限がありません'
      });
    }

    // Get reaction counts
    const reactionCounts = await query(`
      SELECT 
        emoji_unicode,
        COUNT(*) as count,
        string_agg(u.userid, ', ' ORDER BY u.userid) as users,
        string_agg(u.id::text, ',' ORDER BY u.userid) as user_ids
      FROM message_reactions mr
      JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = $1
      GROUP BY emoji_unicode
      ORDER BY emoji_unicode
    `, [messageId]);

    // Format response
    const reactions = reactionCounts.map(reaction => ({
      emoji: reaction.emoji_unicode,
      count: reaction.count,
      users: reaction.users.split(', '),
      user_ids: reaction.user_ids.split(',').map(id => parseInt(id)),
      user_reacted: reaction.user_ids.split(',').includes(req.user.id.toString())
    }));

    res.json({
      success: true,
      reactions
    });

  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({
      success: false,
      message: 'リアクションの取得に失敗しました'
    });
  }
});

// Remove specific reaction
router.delete('/', async (req, res) => {
  try {
    const { message_id, emoji_unicode } = req.body;

    if (!message_id || !emoji_unicode) {
      return res.status(400).json({
        success: false,
        message: 'メッセージIDと絵文字が必要です'
      });
    }

    // Check if reaction exists
    const reaction = await query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji_unicode = $3',
      [message_id, req.user.id, emoji_unicode]
    );

    if (reaction.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'リアクションが見つかりません'
      });
    }

    // Get message info for socket emit
    const messageInfo = await query(
      'SELECT channel_id FROM messages WHERE id = $1',
      [message_id]
    );

    // Remove reaction
    await query(
      'DELETE FROM message_reactions WHERE id = $1',
      [reaction[0].id]
    );

    // Get updated reaction counts
    const reactionCounts = await query(`
      SELECT 
        emoji_unicode,
        COUNT(*) as count,
        string_agg(u.userid, ', ' ORDER BY u.userid) as users
      FROM message_reactions mr
      JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = $1
      GROUP BY emoji_unicode
      ORDER BY emoji_unicode
    `, [message_id]);

    // Emit socket event
    if (messageInfo.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`channel_${messageInfo[0].channel_id}`).emit('reaction_removed', {
          messageId: message_id,
          userId: req.user.id,
          emoji: emoji_unicode,
          reactions: reactionCounts
        });
      }
    }

    res.json({
      success: true,
      message: 'リアクションを削除しました',
      reactions: reactionCounts
    });

  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'リアクションの削除に失敗しました'
    });
  }
});

module.exports = router;
