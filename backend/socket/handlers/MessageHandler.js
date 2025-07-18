// Socket.io メッセージ・チャンネル管理
const { cacheManager } = require('../../config/cache');

class MessageHandler {
  constructor(io, connectionHandler) {
    this.io = io;
    this.connectionHandler = connectionHandler;
  }

  // メッセージイベントハンドラーを設定
  setupHandlers(socket) {
    socket.on('send_message', (data) => this.handleSendMessage(socket, data));
    socket.on('edit_message', (data) => this.handleEditMessage(socket, data));
    socket.on('delete_message', (data) => this.handleDeleteMessage(socket, data));
    socket.on('join_channel', (data) => this.handleJoinChannel(socket, data));
    socket.on('leave_channel', (data) => this.handleLeaveChannel(socket, data));
    socket.on('get_messages', (data) => this.handleGetMessages(socket, data));
  }

  // メッセージ送信ハンドラー
  async handleSendMessage(socket, data) {
    try {
      if (!socket.user) {
        socket.emit('error', { message: '認証が必要です' });
        return;
      }

      const { channelId, content, messageType = 'text', replyTo = null, imageId = null } = data;

      // バリデーション
      if ((!content || content.trim().length === 0) && !imageId) {
        socket.emit('error', { message: 'メッセージ内容または画像が必要です' });
        return;
      }

      if (content && content.length > 2000) {
        socket.emit('error', { message: 'メッセージは2000文字以内で入力してください' });
        return;
      }

      // チャンネルアクセス権限チェック
      const hasAccess = await this.checkChannelAccess(socket.user.id, channelId);
      if (!hasAccess) {
        socket.emit('error', { message: 'このチャンネルにアクセスする権限がありません' });
        return;
      }

      // データベースにメッセージ保存
      const db = require('../../config/database');
      const insertQuery = `
        INSERT INTO messages (channel_id, user_id, content, message_type, reply_to, image_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, created_at, updated_at
      `;
      
      const result = await db.query(insertQuery, [
        channelId,
        socket.user.id,
        content ? content.trim() : '',
        messageType,
        replyTo,
        imageId
      ]);

      const messageId = result[0].id;
      const timestamps = result[0];

      // メッセージオブジェクト作成
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
          id: socket.user.id,
          userid: socket.user.userid,
          nickname: socket.user.nickname,
          avatar_url: socket.user.avatar_url
        }
      };

      // キャッシュ無効化
      if (cacheManager) {
        await cacheManager.invalidateChannelCache(channelId);
      }

      // チャンネル内の全ユーザーにブロードキャスト
      this.connectionHandler.emitToChannel(channelId, 'new_message', { message });
      
      // 送信者に確認応答
      socket.emit('message_sent', { 
        tempId: data.tempId, 
        message 
      });

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'メッセージの送信に失敗しました' });
    }
  }

  // メッセージ編集ハンドラー
  async handleEditMessage(socket, data) {
    try {
      if (!socket.user) {
        socket.emit('error', { message: '認証が必要です' });
        return;
      }

      const { messageId, content } = data;

      if (!content || content.trim().length === 0) {
        socket.emit('error', { message: 'メッセージ内容が必要です' });
        return;
      }

      if (content.length > 2000) {
        socket.emit('error', { message: 'メッセージは2000文字以内で入力してください' });
        return;
      }

      const db = require('../../config/database');
      
      // メッセージの所有者確認
      const checkQuery = 'SELECT user_id, channel_id FROM messages WHERE id = $1';
      const checkResult = await db.query(checkQuery, [messageId]);

      if (checkResult.length === 0) {
        socket.emit('error', { message: 'メッセージが見つかりません' });
        return;
      }

      const message = checkResult[0];
      if (message.user_id !== socket.user.id) {
        socket.emit('error', { message: '自分のメッセージのみ編集できます' });
        return;
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

      const updatedMessage = {
        id: messageId,
        content: content.trim(),
        updated_at: result[0].updated_at,
        edited: true
      };

      // チャンネル内の全ユーザーにブロードキャスト
      this.connectionHandler.emitToChannel(message.channel_id, 'message_edited', { 
        message: updatedMessage 
      });

    } catch (error) {
      console.error('Edit message error:', error);
      socket.emit('error', { message: 'メッセージの編集に失敗しました' });
    }
  }

  // メッセージ削除ハンドラー
  async handleDeleteMessage(socket, data) {
    try {
      if (!socket.user) {
        socket.emit('error', { message: '認証が必要です' });
        return;
      }

      const { messageId } = data;

      const db = require('../../config/database');
      
      // メッセージの所有者確認
      const checkQuery = 'SELECT user_id, channel_id FROM messages WHERE id = $1';
      const checkResult = await db.query(checkQuery, [messageId]);

      if (checkResult.length === 0) {
        socket.emit('error', { message: 'メッセージが見つかりません' });
        return;
      }

      const message = checkResult[0];
      if (message.user_id !== socket.user.id) {
        socket.emit('error', { message: '自分のメッセージのみ削除できます' });
        return;
      }

      // メッセージ削除
      const deleteQuery = 'DELETE FROM messages WHERE id = $1';
      await db.query(deleteQuery, [messageId]);

      // キャッシュ無効化
      if (cacheManager) {
        await cacheManager.invalidateChannelCache(message.channel_id);
      }

      // チャンネル内の全ユーザーにブロードキャスト
      this.connectionHandler.emitToChannel(message.channel_id, 'message_deleted', { 
        messageId 
      });

    } catch (error) {
      console.error('Delete message error:', error);
      socket.emit('error', { message: 'メッセージの削除に失敗しました' });
    }
  }

  // チャンネル参加ハンドラー
  async handleJoinChannel(socket, data) {
    try {
      if (!socket.user) {
        socket.emit('error', { message: '認証が必要です' });
        return;
      }

      const { channelId } = data;

      // チャンネルアクセス権限チェック
      const hasAccess = await this.checkChannelAccess(socket.user.id, channelId);
      if (!hasAccess) {
        socket.emit('error', { message: 'このチャンネルにアクセスする権限がありません' });
        return;
      }

      socket.join(`channel:${channelId}`);
      socket.emit('channel_joined', { channelId });

    } catch (error) {
      console.error('Join channel error:', error);
      socket.emit('error', { message: 'チャンネルへの参加に失敗しました' });
    }
  }

  // チャンネル離脱ハンドラー
  async handleLeaveChannel(socket, data) {
    try {
      const { channelId } = data;
      socket.leave(`channel:${channelId}`);
      socket.emit('channel_left', { channelId });
    } catch (error) {
      console.error('Leave channel error:', error);
    }
  }

  // メッセージ取得ハンドラー
  async handleGetMessages(socket, data) {
    try {
      if (!socket.user) {
        socket.emit('error', { message: '認証が必要です' });
        return;
      }

      const { channelId, page = 1, limit = 50 } = data;

      // チャンネルアクセス権限チェック
      const hasAccess = await this.checkChannelAccess(socket.user.id, channelId);
      if (!hasAccess) {
        socket.emit('error', { message: 'このチャンネルにアクセスする権限がありません' });
        return;
      }

      // キャッシュからメッセージ取得を試行
      let messages = null;
      if (cacheManager) {
        messages = await cacheManager.getCachedMessages(channelId, page);
      }

      if (!messages) {
        // データベースからメッセージ取得
        const db = require('../../config/database');
        const offset = (page - 1) * Math.min(limit, 100);
        
        const messagesQuery = `
          SELECT 
            m.id, m.content, m.message_type, m.reply_to, m.image_id,
            m.created_at, m.updated_at, m.edited,
            u.id as author_id, u.userid, u.nickname, u.avatar_url
          FROM messages m
          JOIN users u ON m.user_id = u.id
          WHERE m.channel_id = $1
          ORDER BY m.created_at DESC
          LIMIT $2 OFFSET $3
        `;

        const result = await db.query(messagesQuery, [channelId, limit, offset]);
        
        messages = result.map(row => ({
          id: row.id,
          content: row.content,
          message_type: row.message_type,
          reply_to: row.reply_to,
          image_id: row.image_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          edited: row.edited_at,
          author: {
            id: row.author_id,
            userid: row.userid,
            nickname: row.nickname,
            avatar_url: row.avatar_url
          }
        }));

        // キャッシュに保存
        if (cacheManager) {
          await cacheManager.cacheMessages(channelId, messages, page);
        }
      }

      socket.emit('messages_received', {
        channelId,
        messages: messages.reverse(),
        page,
        cached: !!messages
      });

    } catch (error) {
      console.error('Get messages error:', error);
      socket.emit('error', { message: 'メッセージの取得に失敗しました' });
    }
  }

  // チャンネルアクセス権限チェック
  async checkChannelAccess(userId, channelId) {
    try {
      const db = require('../../config/database');
      // チャンネルアクセス権限チェック
      let hasAccess = false;
      
      // 通常のギルドチャンネルチェック
      const guildChannelQuery = `
        SELECT c.* 
        FROM channels c
        JOIN guild_members gm ON c.guild_id = gm.guild_id AND gm.user_id = $1
        WHERE c.id = $2
      `;
      const guildResult = await db.query(guildChannelQuery, [userId, channelId]);
      
      if (guildResult.length > 0) {
        hasAccess = true;
      } else {
        // DMチャンネルチェック
        const dmChannelQuery = `
          SELECT dm.* 
          FROM dm_channels dm
          WHERE dm.id = $1 AND (dm.user1_id = $2 OR dm.user2_id = $2)
        `;
        const dmResult = await db.query(dmChannelQuery, [channelId, userId]);
        hasAccess = dmResult.length > 0;
      }
      
      return hasAccess;
    } catch (error) {
      console.error('Channel access check error:', error);
      return false;
    }
  }
}

module.exports = MessageHandler;
