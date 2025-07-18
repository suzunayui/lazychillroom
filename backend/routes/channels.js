const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');

const router = express.Router();

// Validation schemas
const channelSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  type: Joi.string().valid('text', 'voice').default('text'),
  position: Joi.number().integer().min(0).optional(),
  guild_id: Joi.number().integer().required(),
  category_id: Joi.number().integer().optional(),
  topic: Joi.string().max(500).optional().allow('')
});

// Get channels for a guild
router.get('/guild/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;

    // Check if user is member of this guild
    const memberCheck = await query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
      [guildId, req.user.id]
    );

    if (memberCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'このサーバーにアクセスする権限がありません'
      });
    }

    const channels = await query(`
      SELECT id, name, type, position, created_at
      FROM channels 
      WHERE guild_id = $1 
      ORDER BY position ASC, created_at ASC
    `, [guildId]);

    res.json({
      success: true,
      channels
    });

  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({
      success: false,
      message: 'チャンネルリストの取得に失敗しました'
    });
  }
});

// Create new channel
router.post('/', async (req, res) => {
  try {
    // Validate input
    const { error, value } = channelSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, type, position, guild_id, category_id, topic } = value;

    if (!guild_id) {
      return res.status(400).json({
        success: false,
        message: 'サーバーIDが必要です'
      });
    }

    // Check if user has permission to create channels (admin or owner)
    const memberCheck = await query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
      [guild_id, req.user.id]
    );

    if (memberCheck.length === 0 || !['owner', 'admin'].includes(memberCheck[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'チャンネルを作成する権限がありません'
      });
    }

    // Get next position if not provided
    let channelPosition = position;
    if (channelPosition === undefined) {
      const lastPosition = await query(
        'SELECT MAX(position) as max_pos FROM channels WHERE guild_id = $1',
        [guild_id]
      );
      channelPosition = (lastPosition[0].max_pos || -1) + 1;
    }

    // Create channel
    const result = await query(
      'INSERT INTO channels (guild_id, name, type, position, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [guild_id, name, type, channelPosition]
    );

    // Get the created channel
    const newChannel = await query(
      'SELECT id, name, type, position, created_at FROM channels WHERE id = $1',
      [result[0].id]
    );

    res.status(201).json({
      success: true,
      message: 'チャンネルを作成しました',
      channel: newChannel[0]
    });

  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({
      success: false,
      message: 'チャンネルの作成に失敗しました'
    });
  }
});

// Update channel
router.put('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { name, position } = req.body;

    // Get channel info
    const channels = await query(
      'SELECT guild_id FROM channels WHERE id = $1',
      [channelId]
    );

    if (channels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'チャンネルが見つかりません'
      });
    }

    const channel = channels[0];

    // Check if user has permission (admin or owner)
    const memberCheck = await query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
      [channel.guild_id, req.user.id]
    );

    if (memberCheck.length === 0 || !['owner', 'admin'].includes(memberCheck[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'チャンネルを編集する権限がありません'
      });
    }

    // Update channel
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = $1');
      params.push(name);
    }

    if (position !== undefined) {
      updates.push('position = $1');
      params.push(position);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '更新する項目がありません'
      });
    }

    params.push(channelId);

    await query(
      `UPDATE channels SET ${updates.join(', ')} WHERE id = $1`,
      params
    );

    // Get updated channel
    const updatedChannel = await query(
      'SELECT id, name, type, position, created_at FROM channels WHERE id = $1',
      [channelId]
    );

    res.json({
      success: true,
      message: 'チャンネルを更新しました',
      channel: updatedChannel[0]
    });

  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({
      success: false,
      message: 'チャンネルの更新に失敗しました'
    });
  }
});

// Delete channel
router.delete('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;

    // Get channel info
    const channels = await query(
      'SELECT guild_id, name FROM channels WHERE id = $1',
      [channelId]
    );

    if (channels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'チャンネルが見つかりません'
      });
    }

    const channel = channels[0];

    // Check if user has permission (admin or owner)
    const memberCheck = await query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
      [channel.guild_id, req.user.id]
    );

    if (memberCheck.length === 0 || !['owner', 'admin'].includes(memberCheck[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'チャンネルを削除する権限がありません'
      });
    }

    // Check if this is the only channel (don't allow deleting the last channel)
    const channelCount = await query(
      'SELECT COUNT(*) as count FROM channels WHERE guild_id = $1',
      [channel.guild_id]
    );

    if (channelCount[0].count <= 1) {
      return res.status(400).json({
        success: false,
        message: '最後のチャンネルは削除できません'
      });
    }

    // Delete channel (this will also delete all messages due to foreign key constraints)
    await query('DELETE FROM channels WHERE id = $1', [channelId]);

    res.json({
      success: true,
      message: 'チャンネルを削除しました'
    });

  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({
      success: false,
      message: 'チャンネルの削除に失敗しました'
    });
  }
});

module.exports = router;
