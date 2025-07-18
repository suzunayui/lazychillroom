// メッセージのCRUD操作（作成・読み取り・更新・削除）
const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { cacheManager } = require('../../config/cache');
const { authenticateToken } = require('../../middleware/auth');

// メッセージ送信
router.post('/channels/:channelId', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const { content, messageType = 'text', replyTo = null, imageId = null } = req.body;
    
    // バリデーション
    if ((!content || content.trim().length === 0) && !imageId) {
      return res.status(400).json({
        success: false,
        message: 'メッセージ内容または画像が必要です'
      });
    }

    if (content && content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'メッセージは2000文字以内で入力してください'
      });
    }

    // チャンネル権限チェック
    const channelQuery = `
      SELECT c.*, gm.role 
      FROM channels c
      LEFT JOIN guild_members gm ON c.guild_id = gm.guild_id AND gm.user_id = $1
      WHERE c.id = $2
    `;
    const channelResult = await db.query(channelQuery, [req.user.id, channelId]);
    
    if (channelResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'チャンネルが見つかりません'
      });
    }

    const channel = channelResult[0];
    
    // DMチャンネルまたはギルドメンバーであることを確認
    if (channel.type !== 'dm' && !channel.role) {
      return res.status(403).json({
        success: false,
        message: 'このチャンネルにメッセージを送信する権限がありません'
      });
    }

    // メッセージをデータベースに保存
    const insertQuery = `
      INSERT INTO messages (channel_id, user_id, content, message_type, reply_to, image_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, created_at, updated_at
    `;
    
    const result = await db.query(insertQuery, [
      channelId,
      req.user.id,
      content ? content.trim() : '',
      messageType,
      replyTo,
      imageId
    ]);

    const messageId = result[0].id;
    const timestamps = result[0];

    // ユーザー情報を取得
    const userQuery = 'SELECT id, userid, nickname, avatar_url FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [req.user.id]);
    const author = userResult[0];

    // レスポンス用メッセージオブジェクト
    const message = {
      id: messageId,
      channel_id: channelId,
      content: content ? content.trim() : '',
      message_type: messageType,
      reply_to: replyTo,
      image_id: imageId,
      created_at: timestamps.created_at,
      updated_at: timestamps.updated_at,
      author: {
        id: author.id,
        userid: author.userid,
        nickname: author.nickname,
        avatar_url: author.avatar_url
      }
    };

    // キャッシュ無効化
    if (cacheManager) {
      await cacheManager.invalidateChannelCache(channelId);
    }

    res.status(201).json({
      success: true,
      message: message
    });

  } catch (error) {
    console.error('Message creation error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの送信に失敗しました'
    });
  }
});

// メッセージ更新
router.put('/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'メッセージ内容が必要です'
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'メッセージは2000文字以内で入力してください'
      });
    }

    // メッセージの所有者確認
    const checkQuery = 'SELECT user_id, channel_id FROM messages WHERE id = $1';
    const checkResult = await db.query(checkQuery, [messageId]);

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つかりません'
      });
    }

    const message = checkResult[0];
    if (message.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '自分のメッセージのみ編集できます'
      });
    }

    // メッセージ更新
    const updateQuery = `
      UPDATE messages 
      SET content = $1, updated_at = NOW(), edited = true
      WHERE id = $2
      RETURNING updated_at
    `;
    
    const result = await db.query(updateQuery, [content.trim(), messageId]);

    // キャッシュ無効化
    if (cacheManager) {
      await cacheManager.invalidateChannelCache(message.channel_id);
    }

    res.json({
      success: true,
      message: {
        id: messageId,
        content: content.trim(),
        updated_at: result[0].updated_at,
        edited: true
      }
    });

  } catch (error) {
    console.error('Message update error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの更新に失敗しました'
    });
  }
});

// メッセージ削除
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);

    // メッセージの所有者確認
    const checkQuery = 'SELECT user_id, channel_id FROM messages WHERE id = $1';
    const checkResult = await db.query(checkQuery, [messageId]);

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つかりません'
      });
    }

    const message = checkResult[0];
    if (message.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '自分のメッセージのみ削除できます'
      });
    }

    // メッセージ削除
    const deleteQuery = 'DELETE FROM messages WHERE id = $1';
    await db.query(deleteQuery, [messageId]);

    // キャッシュ無効化
    if (cacheManager) {
      await cacheManager.invalidateChannelCache(message.channel_id);
    }

    res.json({
      success: true,
      message: 'メッセージが削除されました'
    });

  } catch (error) {
    console.error('Message deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの削除に失敗しました'
    });
  }
});

module.exports = router;
