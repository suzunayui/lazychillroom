const express = require('express');
const Joi = require('joi');
const { query, transaction } = require('../config/database');

const router = express.Router();

// Validation schemas
const createDMSchema = Joi.object({
  user_id: Joi.number().integer().positive().required()
});

// Get user's DM channels
router.get('/', async (req, res) => {
  try {
    console.log('📱 DM channels request for user:', req.user.id);
    
    // まず、dm_participantsテーブルが存在するかチェック
    const tableCheck = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'dm_participants'
    `);
    
    if (tableCheck[0].count === 0) {
      console.log('⚠️ dm_participantsテーブルが存在しません。空の配列を返します。');
      return res.json({
        success: true,
        channels: []
      });
    }

    const dmChannels = await query(`
      SELECT 
        c.id,
        c.name,
        c.type,
        c.created_at,
        string_agg(
          u.id || ':' || u.userid || ':' || COALESCE(u.avatar_url, ''),
          ';' ORDER BY u.userid
        ) as participants
      FROM channels c
      JOIN dm_participants dp ON c.id = dp.channel_id
      JOIN users u ON dp.user_id = u.id
      WHERE c.type = 'dm'
      AND c.id IN (
        SELECT channel_id 
        FROM dm_participants 
        WHERE user_id = $1
      )
      GROUP BY c.id, c.name, c.type, c.created_at
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    console.log('📱 Found DM channels:', dmChannels.length);

    // Format participants data
    const formattedChannels = dmChannels.map(channel => {
      const participants = [];
      if (channel.participants) {
        const parts = channel.participants.split(';');
        for (const part of parts) {
          const [id, userid, avatar] = part.split(':');
          if (parseInt(id) !== req.user.id) { // Exclude self
            participants.push({
              id: parseInt(id),
              userid,
              avatar_url: avatar || null
            });
          }
        }
      }
      
      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        created_at: channel.created_at,
        participants,
        display_name: participants.length > 0 ? participants[0].userid : 'DM'
      };
    });

    res.json({
      success: true,
      channels: formattedChannels
    });

  } catch (error) {
    console.error('Get DM channels error:', error);
    res.status(500).json({
      success: false,
      message: 'DMチャンネルの取得に失敗しました'
    });
  }
});

// Create or get existing DM channel with a user
router.post('/', async (req, res) => {
  try {
    console.log('📬 DM creation request received');
    console.log('Request body:', req.body);
    console.log('Request user:', req.user?.id);
    
    // Validate input
    const { error, value } = createDMSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { user_id } = value;

    // Can't DM yourself
    if (user_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '自分自身とのDMはできません'
      });
    }

    // Check if target user exists
    const targetUser = await query(
      'SELECT id, userid, avatar_url FROM users WHERE id = $1',
      [user_id]
    );

    if (targetUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    // Check if DM channel already exists between these users
    const existingDM = await query(`
      SELECT c.id, c.name, c.created_at
      FROM channels c
      JOIN dm_participants dp1 ON c.id = dp1.channel_id
      JOIN dm_participants dp2 ON c.id = dp2.channel_id
      WHERE c.type = 'dm'
      AND dp1.user_id = $1 AND dp2.user_id = $2
      AND (
        SELECT COUNT(*) FROM dm_participants 
        WHERE channel_id = c.id
      ) = 2
    `, [req.user.id, user_id]);

    if (existingDM.length > 0) {
      // Return existing DM channel
      return res.json({
        success: true,
        channel: {
          id: existingDM[0].id,
          name: existingDM[0].name,
          type: 'dm',
          created_at: existingDM[0].created_at,
          participants: [targetUser[0]],
          display_name: targetUser[0].userid
        },
        message: '既存のDMチャンネルを開きました'
      });
    }

    // Create new DM channel
    const channelId = await transaction(async (connection) => {
      // Create DM channel
      console.log('🔄 Creating DM channel...');
      const channelResult = await connection.query(
        'INSERT INTO channels (name, type, created_at) VALUES ($1, $2, NOW()) RETURNING id',
        [null, 'dm']
      );

      console.log('📝 Channel creation result:', channelResult);
      const newChannelId = channelResult.rows[0].id;
      console.log('🆔 New channel ID:', newChannelId);

      // Add both users as participants
      await connection.query(
        'INSERT INTO dm_participants (channel_id, user_id, created_at) VALUES ($1, $2, NOW()), ($3, $4, NOW())',
        [newChannelId, req.user.id, newChannelId, user_id]
      );

      return newChannelId;
    });

    res.status(201).json({
      success: true,
      channel: {
        id: channelId,
        name: null,
        type: 'dm',
        created_at: new Date(),
        participants: [targetUser[0]],
        display_name: targetUser[0].userid
      },
      message: 'DMチャンネルを作成しました'
    });

  } catch (error) {
    console.error('Create DM channel error:', error);
    res.status(500).json({
      success: false,
      message: 'DMチャンネルの作成に失敗しました'
    });
  }
});

// Get DM channel details
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;

    // Check if user is participant of this DM
    const dmChannel = await query(`
      SELECT 
        c.id,
        c.name,
        c.type,
        c.created_at
      FROM channels c
      JOIN dm_participants dp ON c.id = dp.channel_id
      WHERE c.id = $1 AND c.type = 'dm' AND dp.user_id = $2
    `, [channelId, req.user.id]);

    if (dmChannel.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'このDMチャンネルにアクセスする権限がありません'
      });
    }

    // Get other participants
    const participants = await query(`
      SELECT u.id, u.userid, u.avatar_url
      FROM users u
      JOIN dm_participants dp ON u.id = dp.user_id
      WHERE dp.channel_id = $1 AND u.id != $2
    `, [channelId, req.user.id]);

    res.json({
      success: true,
      channel: {
        ...dmChannel[0],
        participants,
        display_name: participants.length > 0 ? participants[0].userid : 'DM'
      }
    });

  } catch (error) {
    console.error('Get DM channel error:', error);
    res.status(500).json({
      success: false,
      message: 'DMチャンネルの取得に失敗しました'
    });
  }
});

// DMチャンネルを削除
router.delete('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.id;

    // まず、ユーザーがそのDMチャンネルの参加者かどうかを確認
    const participantCheck = await query(`
      SELECT COUNT(*) as count
      FROM dm_participants 
      WHERE channel_id = $1 AND user_id = $2
    `, [channelId, userId]);

    if (participantCheck[0].count === 0) {
      return res.status(403).json({
        success: false,
        message: 'このDMチャンネルにアクセスする権限がありません'
      });
    }

    // DMチャンネルから自分を削除
    await query(`
      DELETE FROM dm_participants 
      WHERE channel_id = $1 AND user_id = $2
    `, [channelId, userId]);

    // 他に参加者がいない場合は、チャンネル自体を削除
    const remainingParticipants = await query(`
      SELECT COUNT(*) as count
      FROM dm_participants 
      WHERE channel_id = $1
    `, [channelId]);

    if (remainingParticipants[0].count === 0) {
      // メッセージも削除
      await query(`DELETE FROM messages WHERE channel_id = $1`, [channelId]);
      // チャンネルを削除
      await query(`DELETE FROM channels WHERE id = $1`, [channelId]);
    }

    res.json({
      success: true,
      message: 'DMチャンネルを削除しました'
    });

  } catch (error) {
    console.error('DM削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'DMチャンネルの削除に失敗しました'
    });
  }
});

module.exports = router;
