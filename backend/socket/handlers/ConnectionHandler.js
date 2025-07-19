// Socket.io接続・認証管理
const { sessionManager, presenceManager } = require('../../config/cache');

class ConnectionHandler {
  constructor(io) {
    this.io = io;
    this.connectionCounts = new Map(); // IP別接続数追跡
    this.userSockets = new Map(); // ユーザーID -> Set<socketId>
    // 開発環境では接続数制限を大幅に緩和（実質無制限）
    this.maxConnectionsPerIP = process.env.NODE_ENV === 'production' ? 10 : 1000;
  }

  // 接続時の処理
  async handleConnection(socket) {
    const clientIP = socket.handshake.address;
    
    // 開発環境では接続数制限を完全に無効化
    if (process.env.NODE_ENV !== 'production') {
      console.log(`⚡ Development mode: Connection limit disabled for ${clientIP}`);
    } else {
      // IP別接続数制限（本番環境のみ）
      const currentConnections = this.connectionCounts.get(clientIP) || 0;
      console.log(`Connection attempt from ${clientIP}: ${currentConnections}/${this.maxConnectionsPerIP} connections`);
      
      if (currentConnections >= this.maxConnectionsPerIP) {
        console.log(`❌ Connection limit exceeded for ${clientIP}: ${currentConnections}/${this.maxConnectionsPerIP}`);
        socket.emit('error', { message: '接続数が上限に達しています' });
        socket.disconnect(true);
        return;
      }

      // 接続数をカウント
      this.connectionCounts.set(clientIP, currentConnections + 1);
    }

    console.log(`New connection: ${socket.id} from ${clientIP}`);

    // 認証チェック
    const user = await this.authenticateSocket(socket);
    if (!user) {
      socket.emit('auth_required');
      socket.disconnect(true);
      return;
    }

    // ユーザー情報をソケットに設定
    socket.user = user;
    socket.join(`user:${user.id}`);

    // ユーザーソケットマップに追加
    if (!this.userSockets.has(user.id)) {
      this.userSockets.set(user.id, new Set());
    }
    this.userSockets.get(user.id).add(socket.id);

    // プレゼンス設定
    if (presenceManager) {
      await presenceManager.setUserOnline(user.id, socket.id);
    }

    // ユーザーのチャンネルに参加
    await this.joinUserChannels(socket, user.id);

    // 接続成功通知
    socket.emit('authenticated', {
      user: {
        id: user.id,
        userid: user.userid,
        nickname: user.nickname,
        avatar_url: user.avatar_url
      }
    });

    console.log(`User authenticated: ${user.userid} (${user.id})`);
  }

  // 切断時の処理
  async handleDisconnection(socket) {
    const clientIP = socket.handshake.address;
    
    // 本番環境のみで接続数を管理
    if (process.env.NODE_ENV === 'production') {
      // 接続数を減らす
      const currentConnections = this.connectionCounts.get(clientIP) || 0;
      console.log(`Disconnection from ${clientIP}: ${currentConnections} -> ${Math.max(0, currentConnections - 1)}`);
      
      if (currentConnections > 1) {
        this.connectionCounts.set(clientIP, currentConnections - 1);
      } else {
        this.connectionCounts.delete(clientIP);
      }
    }

    if (socket.user) {
      const userId = socket.user.id;
      
      // ユーザーソケットマップから削除
      if (this.userSockets.has(userId)) {
        this.userSockets.get(userId).delete(socket.id);
        if (this.userSockets.get(userId).size === 0) {
          this.userSockets.delete(userId);
          
          // 最後の接続の場合はオフライン設定
          if (presenceManager) {
            await presenceManager.setUserOffline(userId);
          }
        }
      }

      console.log(`User disconnected: ${socket.user.userid} (${userId})`);
    }

    console.log(`Connection closed: ${socket.id}`);
  }

  // ソケット認証
  async authenticateSocket(socket) {
    try {
      // セッションIDまたはJWTトークンから認証
      const sessionId = socket.handshake.auth.sessionId;
      const token = socket.handshake.auth.token;
      
      console.log(`🔐 Socket authentication attempt - Socket ID: ${socket.id}`);
      console.log(`🔐 Received sessionId: ${sessionId ? 'Yes' : 'No'}`);
      console.log(`🔐 Received token: ${token ? 'Yes' : 'No'}`);
      
      if (!sessionId && !token) {
        console.log('❌ Authentication failed: No sessionId or token provided');
        return null;
      }

      // JWTトークンによる認証
      if (token) {
        console.log(`🔑 Attempting JWT authentication...`);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          console.log(`🔑 JWT decoded successfully:`, decoded);
          
          if (decoded && decoded.userId) {
            // データベースからユーザー情報を取得
            const db = require('../../config/database');
            const query = 'SELECT id, userid, nickname, avatar_url FROM users WHERE id = $1';
            const result = await db.query(query, [decoded.userId]);
            
            if (result.length > 0) {
              console.log(`✅ JWT authentication successful for user: ${result[0].userid} (ID: ${result[0].id})`);
              return result[0];
            } else {
              console.log(`❌ User not found in database: ${decoded.userId}`);
            }
          }
        } catch (jwtError) {
          console.error('❌ JWT authentication failed:', jwtError.message);
        }
      }

      // セッションによる認証（従来の方法）
      if (sessionId) {
        // テスト環境ではグローバルセッションを確認
        if (process.env.NODE_ENV === 'test' && global.testSessions) {
          const session = global.testSessions.get(sessionId);
          if (session && session.userId) {
            return {
              id: session.userId,
              userid: session.userid,
              nickname: session.userid,
              avatar_url: null
            };
          }
        }

        // セッションからユーザー情報を取得
        if (sessionManager) {
          const session = await sessionManager.getSession(sessionId);
          if (session && session.userId) {
            // データベースからユーザー情報を取得
            const db = require('../../config/database');
            const query = 'SELECT id, userid, nickname, avatar_url FROM users WHERE id = $1';
            const result = await db.query(query, [session.userId]);
            
            if (result.length > 0) {
              console.log(`Session authentication successful for user: ${result[0].userid}`);
              return result[0];
            }
          }
        }
      }

      console.log('❌ Authentication failed: Invalid sessionId or token');
      return null;
    } catch (error) {
      console.error('❌ Socket authentication error:', error);
      return null;
    }
  }

  // ユーザーのチャンネルに参加
  async joinUserChannels(socket, userId) {
    try {
      const db = require('../../config/database');
      
      // ユーザーが参加しているギルドのチャンネルを取得
      const channelsQuery = `
        SELECT DISTINCT c.id, c.name, c.type
        FROM channels c
        JOIN guild_members gm ON c.guild_id = gm.guild_id
        WHERE gm.user_id = $1
        UNION
        SELECT dm.id, CONCAT('DM:', u1.userid, '-', u2.userid) as name, 'dm' as type
        FROM dm_channels dm
        JOIN users u1 ON dm.user1_id = u1.id
        JOIN users u2 ON dm.user2_id = u2.id
        WHERE dm.user1_id = $1 OR dm.user2_id = $1
      `;
      
      const result = await db.query(channelsQuery, [userId]);
      
      for (const channel of result.rows) {
        socket.join(`channel:${channel.id}`);
      }
      
      console.log(`User ${userId} joined ${result.rows.length} channels`);
    } catch (error) {
      console.error('Failed to join user channels:', error);
    }
  }

  // ユーザーのアクティブソケット取得
  getUserSockets(userId) {
    return this.userSockets.get(userId) || new Set();
  }

  // 特定ユーザーにイベント送信
  emitToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // チャンネルにイベント送信
  emitToChannel(channelId, event, data) {
    this.io.to(`channel:${channelId}`).emit(event, data);
  }

  // 統計情報取得
  getConnectionStats() {
    const totalConnections = Array.from(this.connectionCounts.values())
      .reduce((sum, count) => sum + count, 0);
    
    return {
      totalConnections,
      uniqueIPs: this.connectionCounts.size,
      authenticatedUsers: this.userSockets.size,
      connectionsPerIP: Object.fromEntries(this.connectionCounts)
    };
  }

  // 接続数カウンターをリセット（デバッグ用）
  resetConnectionCounts() {
    console.log('🧹 Resetting connection counts...');
    this.connectionCounts.clear();
    console.log('✅ Connection counts reset');
  }
}

module.exports = ConnectionHandler;
