// Socket.io プレゼンス・タイピング管理
const { presenceManager } = require('../../config/cache');

class PresenceHandler {
  constructor(io, connectionHandler) {
    this.io = io;
    this.connectionHandler = connectionHandler;
    this.typingUsers = new Map(); // チャンネルID -> Set<ユーザーID>
    this.typingTimeouts = new Map(); // ユーザーID -> タイマーID
  }

  // プレゼンス・タイピングイベントハンドラーを設定
  setupHandlers(socket) {
    socket.on('start_typing', (data) => this.handleStartTyping(socket, data));
    socket.on('stop_typing', (data) => this.handleStopTyping(socket, data));
    socket.on('update_status', (data) => this.handleUpdateStatus(socket, data));
    socket.on('get_online_users', (data) => this.handleGetOnlineUsers(socket, data));
    socket.on('heartbeat', () => this.handleHeartbeat(socket));
  }

  // タイピング開始ハンドラー
  async handleStartTyping(socket, data) {
    try {
      if (!socket.user) {
        socket.emit('error', { message: '認証が必要です' });
        return;
      }

      const { channelId } = data;

      // チャンネルアクセス権限チェック
      const hasAccess = await this.checkChannelAccess(socket.user.id, channelId);
      if (!hasAccess) {
        return;
      }

      // タイピング状態を記録
      if (!this.typingUsers.has(channelId)) {
        this.typingUsers.set(channelId, new Set());
      }
      this.typingUsers.get(channelId).add(socket.user.id);

      // 既存のタイマーをクリア
      const existingTimeout = this.typingTimeouts.get(`${socket.user.id}_${channelId}`);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // 10秒後に自動的にタイピングを停止
      const timeout = setTimeout(() => {
        this.stopUserTyping(socket.user.id, channelId);
      }, 10000);
      this.typingTimeouts.set(`${socket.user.id}_${channelId}`, timeout);

      // チャンネル内の他のユーザーにブロードキャスト
      socket.to(`channel:${channelId}`).emit('user_typing', {
        channelId,
        user: {
          id: socket.user.id,
          userid: socket.user.userid,
          nickname: socket.user.nickname
        }
      });

    } catch (error) {
      console.error('Start typing error:', error);
    }
  }

  // タイピング停止ハンドラー
  async handleStopTyping(socket, data) {
    try {
      if (!socket.user) {
        return;
      }

      const { channelId } = data;
      this.stopUserTyping(socket.user.id, channelId);
    } catch (error) {
      console.error('Stop typing error:', error);
    }
  }

  // ユーザータイピング停止処理
  stopUserTyping(userId, channelId) {
    // タイピング状態から削除
    if (this.typingUsers.has(channelId)) {
      this.typingUsers.get(channelId).delete(userId);
      if (this.typingUsers.get(channelId).size === 0) {
        this.typingUsers.delete(channelId);
      }
    }

    // タイマーをクリア
    const timeoutKey = `${userId}_${channelId}`;
    const existingTimeout = this.typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.typingTimeouts.delete(timeoutKey);
    }

    // チャンネル内の他のユーザーにブロードキャスト
    this.io.to(`channel:${channelId}`).emit('user_stop_typing', {
      channelId,
      userId
    });
  }

  // ステータス更新ハンドラー
  async handleUpdateStatus(socket, data) {
    try {
      if (!socket.user) {
        socket.emit('error', { message: '認証が必要です' });
        return;
      }

      const { status } = data; // online, idle, dnd, invisible

      const allowedStatuses = ['online', 'idle', 'dnd', 'invisible'];
      if (!allowedStatuses.includes(status)) {
        socket.emit('error', { message: '無効なステータスです' });
        return;
      }

      // プレゼンス更新
      if (presenceManager) {
        await presenceManager.setUserOnline(socket.user.id, socket.id);
      }

      // ユーザーの所属ギルドメンバーにブロードキャスト
      const db = require('../../config/database');
      const guildsQuery = 'SELECT guild_id FROM guild_members WHERE user_id = $1';
      const guildsResult = await db.query(guildsQuery, [socket.user.id]);

      for (const row of guildsResult) {
        this.io.to(`guild:${row.guild_id}`).emit('user_status_update', {
          userId: socket.user.id,
          status
        });
      }

    } catch (error) {
      console.error('Update status error:', error);
      socket.emit('error', { message: 'ステータスの更新に失敗しました' });
    }
  }

  // オンラインユーザー取得ハンドラー
  async handleGetOnlineUsers(socket, data) {
    try {
      if (!socket.user) {
        socket.emit('error', { message: '認証が必要です' });
        return;
      }

      const { guildId } = data;

      let onlineUsers = [];
      if (presenceManager) {
        const allOnlineUsers = await presenceManager.getOnlineUsers();
        
        if (guildId) {
          // 特定ギルドのメンバーのみフィルター
          const db = require('../../config/database');
          const membersQuery = `
            SELECT gm.user_id, u.userid, u.nickname, u.avatar_url
            FROM guild_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.guild_id = $1
          `;
          const membersResult = await db.query(membersQuery, [guildId]);
          const guildMemberIds = new Set(membersResult.map(row => row.user_id));
          
          onlineUsers = allOnlineUsers
            .filter(user => guildMemberIds.has(user.userId))
            .map(user => {
              const member = membersResult.find(m => m.user_id === user.userId);
              return {
                id: user.userId,
                userid: member.userid,
                nickname: member.nickname,
                avatar_url: member.avatar_url,
                status: 'online',
                lastSeen: user.timestamp
              };
            });
        } else {
          // 全体のオンラインユーザー（フレンドのみなど）
          onlineUsers = allOnlineUsers.map(user => ({
            id: user.userId,
            status: 'online',
            lastSeen: user.timestamp
          }));
        }
      }

      socket.emit('online_users', {
        guildId,
        users: onlineUsers
      });

    } catch (error) {
      console.error('Get online users error:', error);
      socket.emit('error', { message: 'オンラインユーザーの取得に失敗しました' });
    }
  }

  // ハートビートハンドラー
  async handleHeartbeat(socket) {
    try {
      if (!socket.user) {
        return;
      }

      // プレゼンス更新
      if (presenceManager) {
        await presenceManager.refreshPresence(socket.user.id);
      }

      socket.emit('heartbeat_ack');
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  }

  // 切断時のクリーンアップ
  handleDisconnection(socket) {
    if (!socket.user) {
      return;
    }

    const userId = socket.user.id;

    // 全チャンネルからタイピング状態を削除
    for (const [channelId, typingSet] of this.typingUsers.entries()) {
      if (typingSet.has(userId)) {
        this.stopUserTyping(userId, channelId);
      }
    }

    // ユーザーのタイマーをクリア
    for (const [key, timeout] of this.typingTimeouts.entries()) {
      if (key.startsWith(`${userId}_`)) {
        clearTimeout(timeout);
        this.typingTimeouts.delete(key);
      }
    }
  }

  // チャンネルアクセス権限チェック（MessageHandlerと同じ）
  async checkChannelAccess(userId, channelId) {
    try {
      const db = require('../../config/database');
      const query = `
        SELECT c.*, gm.role_id 
        FROM channels c
        LEFT JOIN guild_members gm ON c.guild_id = gm.guild_id AND gm.user_id = $1
        WHERE c.id = $2
      `;
      const result = await db.query(query, [userId, channelId]);
      
      if (result.length === 0) {
        return false;
      }

      const channel = result[0];
      return channel.type === 'dm' || channel.role_id !== null;
    } catch (error) {
      console.error('Channel access check error:', error);
      return false;
    }
  }

  // 現在のタイピングユーザー取得
  getTypingUsers(channelId) {
    return Array.from(this.typingUsers.get(channelId) || []);
  }

  // 統計情報取得
  getPresenceStats() {
    const totalTypingChannels = this.typingUsers.size;
    const totalTypingUsers = Array.from(this.typingUsers.values())
      .reduce((sum, userSet) => sum + userSet.size, 0);
    
    return {
      typingChannels: totalTypingChannels,
      typingUsers: totalTypingUsers,
      activeTimeouts: this.typingTimeouts.size
    };
  }
}

module.exports = PresenceHandler;
