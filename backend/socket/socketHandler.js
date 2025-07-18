// 最適化されたSocket.ioハンドラー（モジュラー構造）
const ConnectionHandler = require('./handlers/ConnectionHandler');
const MessageHandler = require('./handlers/MessageHandler');
const PresenceHandler = require('./handlers/PresenceHandler');

let redisAdapter = null;
// Redis Adapterは条件付きで読み込み
if (process.env.REDIS_HOST || process.env.NODE_ENV === 'production') {
  try {
    redisAdapter = require('socket.io-redis');
  } catch (error) {
    console.warn('⚠️  socket.io-redis not available:', error.message);
  }
}

// Redis Adapterの設定（スケーリング対応）
const setupSocketRedisAdapter = (io) => {
  // テスト環境ではRedis Adapterを無効化
  if (process.env.NODE_ENV === 'test') {
    console.log('🧪 Test environment - Redis adapter disabled');
    return;
  }
  
  if (!redisAdapter) {
    console.warn('⚠️  Redis adapter not available - using memory adapter');
    return;
  }
  
  try {
    const { redisClient } = require('../config/cache');
    
    if (!redisClient) {
      throw new Error('Redis client not available');
    }
    
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    
    io.adapter(redisAdapter({
      pubClient,
      subClient
    }));
    
    console.log('✅ Socket.io Redis Adapter configured');
  } catch (error) {
    console.warn('⚠️  Socket.io Redis Adapter setup failed - using memory adapter:', error.message);
  }
};

class OptimizedSocketHandler {
  constructor(io) {
    this.io = io;
    this.connectionHandler = new ConnectionHandler(io);
    this.messageHandler = new MessageHandler(io, this.connectionHandler);
    this.presenceHandler = new PresenceHandler(io, this.connectionHandler);
    
    // Redis Adapterを設定
    setupSocketRedisAdapter(io);
    
    this.setupSocketHandlers();
    this.setupHealthMonitoring();
  }

  setupSocketHandlers() {
    this.io.on('connection', async (socket) => {
      console.log(`New socket connection: ${socket.id}`);
      
      // 接続処理
      await this.connectionHandler.handleConnection(socket);
      
      // 各ハンドラーのイベント設定
      this.messageHandler.setupHandlers(socket);
      this.presenceHandler.setupHandlers(socket);
      
      // 切断処理
      socket.on('disconnect', async (reason) => {
        console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        
        // 各ハンドラーの切断処理
        this.presenceHandler.handleDisconnection(socket);
        await this.connectionHandler.handleDisconnection(socket);
      });
      
      // エラーハンドリング
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  setupHealthMonitoring() {
    // テスト環境では統計情報の定期出力をスキップ
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    
    // 5分ごとに統計情報をログ出力
    this.healthInterval = setInterval(() => {
      const connectionStats = this.connectionHandler.getConnectionStats();
      const presenceStats = this.presenceHandler.getPresenceStats();
      
      console.log('📊 Socket.io Statistics:', {
        connections: connectionStats.totalConnections,
        authenticatedUsers: connectionStats.authenticatedUsers,
        uniqueIPs: connectionStats.uniqueIPs,
        typingUsers: presenceStats.typingUsers,
        typingChannels: presenceStats.typingChannels
      });
    }, 300000); // 5分
  }

  // 管理API用のメソッド
  getStats() {
    return {
      connections: this.connectionHandler.getConnectionStats(),
      presence: this.presenceHandler.getPresenceStats(),
      io: {
        connectedSockets: this.io.engine.clientsCount,
        rooms: Object.keys(this.io.sockets.adapter.rooms).length
      }
    };
  }

  // 特定ユーザーにメッセージ送信
  emitToUser(userId, event, data) {
    this.connectionHandler.emitToUser(userId, event, data);
  }

  // 特定チャンネルにメッセージ送信
  emitToChannel(channelId, event, data) {
    this.connectionHandler.emitToChannel(channelId, event, data);
  }

  // 全ユーザーにブロードキャスト
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // 緊急時の全接続切断
  emergencyDisconnectAll(reason = 'Server maintenance') {
    this.io.emit('server_shutdown', { reason });
    setTimeout(() => {
      this.io.disconnectSockets(true);
    }, 5000); // 5秒の猶予
  }
  
  // クリーンアップ
  cleanup() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }
}

// 互換性のためのラッパー関数
module.exports = (io) => {
  return new OptimizedSocketHandler(io);
};

// クラス自体をexportしたい場合
module.exports.OptimizedSocketHandler = OptimizedSocketHandler;
