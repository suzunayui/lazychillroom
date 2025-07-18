// メッセージの検索・取得機能
const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { cacheManager } = require('../../config/cache');
const { authenticateToken } = require('../../middleware/auth');

// チャンネルのメッセージ取得（ページネーション付き）
router.get('/channels/:channelId', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // 最大100件
    const offset = (page - 1) * limit;

    // キャッシュチェック
    if (cacheManager) {
      const cachedMessages = await cacheManager.getCachedMessages(channelId, page);
      if (cachedMessages) {
        return res.json({
          success: true,
          messages: cachedMessages,
          page,
          limit,
          cached: true
        });
      }
    }

    // チャンネルアクセス権限チェック
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
        message: 'このチャンネルにアクセスする権限がありません'
      });
    }

    // メッセージクエリ（リアクション、返信、ユーザー情報、ファイル情報含む）
    const messagesQuery = `
      SELECT 
        m.id,
        m.channel_id,
        m.content,
        m.message_type,
        m.reply_to,
        m.image_id,
        m.created_at,
        m.updated_at,
        m.edited_at,
        u.id as author_id,
        u.userid,
        u.nickname,
        u.avatar_url,
        reply_m.content as reply_content,
        reply_u.userid as reply_userid,
        COALESCE(reaction_counts.reactions, '[]'::json) as reactions,
        f.id as file_id,
        f.filename as file_name,
        f.original_name,
        f.mime_type,
        f.size as file_size,
        f.path as file_path,
        f.type as file_type
      FROM messages m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN messages reply_m ON m.reply_to = reply_m.id
      LEFT JOIN users reply_u ON reply_m.user_id = reply_u.id
      LEFT JOIN files f ON m.image_id = f.id
      LEFT JOIN (
        SELECT 
          message_id,
          json_agg(
            json_build_object(
              'emoji', emoji,
              'count', count,
              'users', users
            )
          ) as reactions
        FROM (
          SELECT 
            message_id,
            emoji,
            COUNT(*) as count,
            json_agg(user_id) as users
          FROM reactions
          GROUP BY message_id, emoji
        ) r
        GROUP BY message_id
      ) reaction_counts ON m.id = reaction_counts.message_id
      WHERE m.channel_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(messagesQuery, [channelId, limit, offset]);

    const messages = result.map(row => {
      const message = {
        id: row.id,
        channel_id: row.channel_id,
        user_id: row.author_id, // 追加: user_idを含める
        content: row.content,
        message_type: row.message_type,
        type: row.message_type, // 互換性のため
        reply_to: row.reply_to,
        image_id: row.image_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        edited: row.edited_at, // edited_at を edited として返す
        userid: row.userid, // 互換性のため
        nickname: row.nickname, // 互換性のため
        avatar_url: row.avatar_url, // 互換性のため
        author: {
          id: row.author_id,
          userid: row.userid,
          nickname: row.nickname,
          avatar_url: row.avatar_url
        },
        reply: row.reply_content ? {
          content: row.reply_content,
          userid: row.reply_userid
        } : null,
        reactions: Array.isArray(row.reactions) ? row.reactions : []
      };

      // ファイル情報がある場合は追加
      if (row.file_id) {
        message.files = [{
          id: row.file_id,
          filename: row.file_name,
          original_name: row.original_name,
          mime_type: row.mime_type,
          file_size: row.file_size,
          url: `/api/files/image/${row.file_id}`, // 画像の場合
          created_at: row.created_at
        }];
        
        // レガシー互換性のため
        message.file_id = row.file_id;
        message.file_name = row.file_name;
        message.file_size = row.file_size;
        message.mime_type = row.mime_type;
        message.file_url = `/api/files/image/${row.file_id}`;
      }

      return message;
    });

    // キャッシュに保存
    if (cacheManager) {
      await cacheManager.cacheMessages(channelId, messages, page);
    }

    res.json({
      success: true,
      messages: messages.reverse(), // 古い順に並び替え
      page,
      limit,
      total: messages.length,
      cached: false
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの取得に失敗しました'
    });
  }
});

// 特定のメッセージ取得
router.get('/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);

    const query = `
      SELECT 
        m.id,
        m.channel_id,
        m.content,
        m.message_type,
        m.reply_to,
        m.image_id,
        m.created_at,
        m.updated_at,
        m.edited_at,
        u.id as author_id,
        u.userid,
        u.nickname,
        u.avatar_url,
        c.guild_id
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels c ON m.channel_id = c.id
      WHERE m.id = $1
    `;

    const result = await db.query(query, [messageId]);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つかりません'
      });
    }

    const row = result[0];

    // アクセス権限チェック
    if (row.guild_id) {
      const memberQuery = 'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2';
      const memberResult = await db.query(memberQuery, [row.guild_id, req.user.id]);
      
      if (memberResult.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'このメッセージにアクセスする権限がありません'
        });
      }
    }

    const message = {
      id: row.id,
      channel_id: row.channel_id,
      content: row.content,
      message_type: row.message_type,
      reply_to: row.reply_to,
      image_id: row.image_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      edited: row.edited_at, // edited_at を edited として返す
      author: {
        id: row.author_id,
        userid: row.userid,
        nickname: row.nickname,
        avatar_url: row.avatar_url
      }
    };

    res.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの取得に失敗しました'
    });
  }
});

// メッセージ検索
router.get('/channels/:channelId/search', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const { query: searchQuery, limit = 50, offset = 0 } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '検索クエリが必要です'
      });
    }

    // チャンネルアクセス権限チェック
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
    
    if (channel.type !== 'dm' && !channel.role) {
      return res.status(403).json({
        success: false,
        message: 'このチャンネルにアクセスする権限がありません'
      });
    }

    // 全文検索クエリ
    const searchSql = `
      SELECT 
        m.id,
        m.content,
        m.created_at,
        u.userid,
        u.nickname,
        u.avatar_url,
        ts_rank(to_tsvector('japanese', m.content), plainto_tsquery('japanese', $1)) as rank
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = $2 
        AND to_tsvector('japanese', m.content) @@ plainto_tsquery('japanese', $1)
      ORDER BY rank DESC, m.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await db.query(searchSql, [
      searchQuery.trim(),
      channelId,
      Math.min(parseInt(limit), 100),
      parseInt(offset)
    ]);

    const messages = result.map(row => ({
      id: row.id,
      content: row.content,
      created_at: row.created_at,
      author: {
        userid: row.userid,
        nickname: row.nickname,
        avatar_url: row.avatar_url
      },
      relevance: parseFloat(row.rank)
    }));

    res.json({
      success: true,
      messages,
      query: searchQuery,
      total: messages.length
    });

  } catch (error) {
    console.error('Message search error:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの検索に失敗しました'
    });
  }
});

module.exports = router;
