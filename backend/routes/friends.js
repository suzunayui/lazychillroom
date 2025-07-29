const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');

const router = express.Router();

// Validation schemas
const friendRequestSchema = Joi.object({
  userid: Joi.string().min(3).max(30).required()
});

// Get friends list
router.get('/', async (req, res) => {
  try {
    const friends = await query(`
      SELECT 
        f.id,
        f.created_at,
        u.id as friend_id,
        u.userid,
        u.nickname,
        u.avatar_url,
        u.last_activity
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.user1_id = $1 THEN f.user2_id = u.id
          ELSE f.user1_id = u.id
        END
      )
      WHERE f.user1_id = $1 OR f.user2_id = $1
      ORDER BY u.nickname ASC
    `, [req.user.id]);

    res.json({
      success: true,
      friends
    });

  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({
      success: false,
      message: 'フレンドリストの取得に失敗しました'
    });
  }
});

// Get friend requests
router.get('/requests', async (req, res) => {
  try {
    // Incoming requests
    const incomingRequests = await query(`
      SELECT 
        fr.id,
        fr.created_at,
        u.id as user_id,
        u.userid,
        u.nickname,
        u.avatar_url
      FROM friend_requests fr
      JOIN users u ON fr.sender_id = u.id
      WHERE fr.receiver_id = $1 AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [req.user.id]);

    // Outgoing requests
    const outgoingRequests = await query(`
      SELECT 
        fr.id,
        fr.created_at,
        u.id as friend_id,
        u.userid,
        u.nickname,
        u.avatar_url
      FROM friend_requests fr
      JOIN users u ON fr.receiver_id = u.id
      WHERE fr.sender_id = $1 AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      incoming: incomingRequests,
      outgoing: outgoingRequests
    });

  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({
      success: false,
      message: 'フレンドリクエストの取得に失敗しました'
    });
  }
});

// Send friend request
router.post('/request', async (req, res) => {
  try {
    const { error, value } = friendRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { userid } = value;

    // Find target user
    const targetUsers = await query(
      'SELECT id, userid, nickname FROM users WHERE userid = $1',
      [userid]
    );

    if (targetUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    const targetUser = targetUsers[0];

    // Can't add yourself
    if (targetUser.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '自分自身をフレンドに追加することはできません'
      });
    }

    // Check if friendship already exists
    const existingFriendship = await query(
      'SELECT id FROM friendships WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $3 AND user2_id = $4)',
      [Math.min(req.user.id, targetUser.id), Math.max(req.user.id, targetUser.id), 
       Math.min(req.user.id, targetUser.id), Math.max(req.user.id, targetUser.id)]
    );

    if (existingFriendship.length > 0) {
      return res.status(400).json({
        success: false,
        message: '既にフレンドです'
      });
    }

    // Check if friend request already exists
    const existingRequest = await query(
      'SELECT id, status FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $3 AND receiver_id = $4)',
      [req.user.id, targetUser.id, targetUser.id, req.user.id]
    );

    if (existingRequest.length > 0) {
      const status = existingRequest[0].status;
      if (status === 'pending') {
        return res.status(409).json({
          success: false,
          message: 'フレンドリクエストは既に送信済みです'
        });
      }
    }

    // Send friend request
    await query(
      'INSERT INTO friend_requests (sender_id, receiver_id, status, created_at) VALUES ($1, $2, $3, NOW())',
      [req.user.id, targetUser.id, 'pending']
    );

    res.status(201).json({
      success: true,
      message: `${targetUser.nickname}にフレンドリクエストを送信しました`
    });

  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'フレンドリクエストの送信に失敗しました'
    });
  }
});

// Accept friend request
router.post('/accept/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    // Find the request
    const requests = await query(
      'SELECT id, sender_id, receiver_id FROM friend_requests WHERE id = $1 AND receiver_id = $2 AND status = $3',
      [requestId, req.user.id, 'pending']
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'フレンドリクエストが見つかりません'
      });
    }

    const request = requests[0];

    // Accept the request
    await query(
      'UPDATE friend_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      ['accepted', requestId]
    );

    // Create friendship
    await query(
      'INSERT INTO friendships (user1_id, user2_id, created_at) VALUES ($1, $2, NOW())',
      [Math.min(req.user.id, request.sender_id), Math.max(req.user.id, request.sender_id)]
    );

    res.json({
      success: true,
      message: 'フレンドリクエストを承認しました'
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'フレンドリクエストの承認に失敗しました'
    });
  }
});

// Decline friend request
router.delete('/decline/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    const result = await query(
      'UPDATE friend_requests SET status = $1, updated_at = NOW() WHERE id = $2 AND receiver_id = $3 AND status = $4',
      ['declined', requestId, req.user.id, 'pending']
    );

    // PostgreSQLのUPDATEクエリは変更された行数ではなく結果配列を返すことがある
    // 存在チェックのために別途SELECTクエリを実行
    const checkResult = await query(
      'SELECT id FROM friend_requests WHERE id = $1 AND receiver_id = $2',
      [requestId, req.user.id]
    );

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'フレンドリクエストが見つかりません'
      });
    }

    res.json({
      success: true,
      message: 'フレンドリクエストを拒否しました'
    });

  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'フレンドリクエストの拒否に失敗しました'
    });
  }
});

// Remove friend
router.delete('/:friendId', async (req, res) => {
  try {
    const { friendId } = req.params;

    // Remove friendship
    await query(
      'DELETE FROM friendships WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $3 AND user2_id = $4)',
      [Math.min(req.user.id, friendId), Math.max(req.user.id, friendId),
       Math.min(req.user.id, friendId), Math.max(req.user.id, friendId)]
    );

    res.json({
      success: true,
      message: 'フレンドを削除しました'
    });

  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'フレンドの削除に失敗しました'
    });
  }
});

module.exports = router;
