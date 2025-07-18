// Socket.io リアルタイム通信テスト
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const TestHelper = require('../helpers/TestHelper');

function createTestSocketServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket.ioハンドラーを設定
  const socketHandler = require('../../socket/socketHandler')(io);

  return { httpServer, io, socketHandler };
}

describe('Socket.io リアルタイム通信テスト', () => {
  let httpServer;
  let io;
  let socketHandler;
  let testHelper;
  let serverSocket;
  let clientSocket;
  let testUser;
  let testGuild;
  let testChannel;

  // 各テストのタイムアウトを10秒に設定
  jest.setTimeout(10000);

  beforeAll(async () => {
    testHelper = new TestHelper();
    const { httpServer: server, io: ioServer, socketHandler: handler } = createTestSocketServer();
    httpServer = server;
    io = ioServer;
    socketHandler = handler;

    // テストデータをセットアップ
    testUser = await testHelper.createTestUser();
    testGuild = await testHelper.createTestGuild(testUser.id);
    testChannel = await testHelper.createTestChannel(testGuild.id);
  });

  afterAll(async () => {
    await testHelper.cleanup();
    if (socketHandler && socketHandler.cleanup) {
      socketHandler.cleanup();
    }
    io.close();
    httpServer.close();
  });

  beforeEach((done) => {
    const timeout = setTimeout(() => {
      done(new Error('Socket connection timeout'));
    }, 5000);

    httpServer.listen(async () => {
      const port = httpServer.address().port;
      
      // テスト用セッションを生成
      const sessionId = await testHelper.generateSession(testUser);
      
      // サーバー側のSocket接続を取得
      io.on('connection', (socket) => {
        serverSocket = socket;
      });

      // クライアント側のSocket接続を作成
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: {
          sessionId: sessionId
        },
        timeout: 3000,
        forceNew: true
      });

      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        clearTimeout(timeout);
        done(error);
      });
    });
  });

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (httpServer && httpServer.listening) {
      httpServer.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  describe('接続テスト', () => {
    test('Socket.io 接続成功', () => {
      expect(clientSocket.connected).toBe(true);
    });

    test('認証済みユーザー情報の設定', () => {
      expect(serverSocket.userId).toBe(testUser.id);
      expect(serverSocket.userid).toBe(testUser.userid);
    });
  });

  describe('ギルド参加テスト', () => {
    test('ギルドルームへの参加', (done) => {
      clientSocket.emit('join_guilds');
      
      setTimeout(() => {
        // サーバー側でギルドルームに参加していることを確認
        const rooms = Array.from(serverSocket.rooms);
        expect(rooms).toContain(`guild_${testGuild.id}`);
        done();
      }, 100);
    });
  });

  describe('チャンネル参加テスト', () => {
    test('チャンネルルームへの参加', (done) => {
      clientSocket.emit('join_channel', { channelId: testChannel.id });
      
      setTimeout(() => {
        const rooms = Array.from(serverSocket.rooms);
        expect(rooms).toContain(`channel_${testChannel.id}`);
        done();
      }, 100);
    });

    test('チャンネルルームからの離脱', (done) => {
      // まず参加
      clientSocket.emit('join_channel', { channelId: testChannel.id });
      
      setTimeout(() => {
        // 離脱
        clientSocket.emit('leave_channel', { channelId: testChannel.id });
        
        setTimeout(() => {
          const rooms = Array.from(serverSocket.rooms);
          expect(rooms).not.toContain(`channel_${testChannel.id}`);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('メッセージ配信テスト', () => {
    test('新しいメッセージの配信', (done) => {
      let messageReceived = false;

      // メッセージを受信するリスナーを設定
      clientSocket.on('new_message', (data) => {
        expect(data.message.content).toBe('Test message');
        expect(data.message.user_id).toBe(testUser.id);
        messageReceived = true;
      });

      // チャンネルに参加
      clientSocket.emit('join_channel', { channelId: testChannel.id });

      setTimeout(() => {
        // メッセージを送信（サーバー側から）
        io.to(`channel_${testChannel.id}`).emit('new_message', {
          message: {
            id: 1,
            content: 'Test message',
            user_id: testUser.id,
            userid: testUser.userid,
            channel_id: testChannel.id
          }
        });

        setTimeout(() => {
          expect(messageReceived).toBe(true);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('タイピング状況テスト', () => {
    test('タイピング開始の配信', (done) => {
      let typingReceived = false;

      // タイピング開始を受信するリスナーを設定
      clientSocket.on('user_typing', (data) => {
        expect(data.userId).toBe(testUser.id);
        expect(data.userid).toBe(testUser.userid);
        expect(data.channelId).toBe(testChannel.id);
        typingReceived = true;
      });

      // チャンネルに参加
      clientSocket.emit('join_channel', { channelId: testChannel.id });

      setTimeout(() => {
        // タイピング開始を送信
        clientSocket.emit('typing_start', { channelId: testChannel.id });

        setTimeout(() => {
          expect(typingReceived).toBe(true);
          done();
        }, 100);
      }, 100);
    });

    test('タイピング停止の配信', (done) => {
      let typingStoppedReceived = false;

      // タイピング停止を受信するリスナーを設定
      clientSocket.on('user_typing_stop', (data) => {
        expect(data.userId).toBe(testUser.id);
        expect(data.channelId).toBe(testChannel.id);
        typingStoppedReceived = true;
      });

      // チャンネルに参加
      clientSocket.emit('join_channel', { channelId: testChannel.id });

      setTimeout(() => {
        // タイピング停止を送信
        clientSocket.emit('typing_stop', { channelId: testChannel.id });

        setTimeout(() => {
          expect(typingStoppedReceived).toBe(true);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('エラーハンドリングテスト', () => {
    test('無効なチャンネルIDでの参加失敗', (done) => {
      let errorReceived = false;

      clientSocket.on('error', (data) => {
        expect(data.message).toContain('チャンネル');
        errorReceived = true;
      });

      clientSocket.emit('join_channel', { channelId: 99999 });

      setTimeout(() => {
        expect(errorReceived).toBe(true);
        done();
      }, 100);
    });
  });
});
