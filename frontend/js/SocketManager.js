// Socket.ioを使用したリアルタイム通信管理クラス
class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        console.log('SocketManager初期化');
    }

    // Socket.io接続を初期化
    async connect(token) {
        try {
            console.log('🔌 Socket.io接続を開始...');
            console.log('🔌 トークン確認:', token ? 'あり' : 'なし');
            console.log('🔌 接続先URL:', window.location.origin);
            
            // 既存の接続がある場合は切断
            if (this.socket) {
                console.log('🔌 既存接続を切断中...');
                this.disconnect();
            }

            // Socket.io接続を作成
            console.log('🔌 Socket.IOクライアント作成中...');
            this.socket = io({
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true
            });

            // 接続イベントの設定
            this.setupConnectionEvents();
            
            // 接続完了を待機
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Socket.io接続がタイムアウトしました'));
                }, 10000);

                this.socket.on('connect', () => {
                    clearTimeout(timeout);
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log('✓ Socket.io接続成功');
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    clearTimeout(timeout);
                    console.error('Socket.io接続エラー:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Socket.io接続の初期化に失敗:', error);
            throw error;
        }
    }

    // 接続関連イベントの設定
    setupConnectionEvents() {
        this.socket.on('connect', () => {
            console.log('Socket.io接続完了');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // 接続成功をアプリに通知
            this.emit('socket_connected');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket.io切断:', reason);
            this.isConnected = false;
            
            // 切断をアプリに通知
            this.emit('socket_disconnected', reason);
            
            // 自動再接続（サーバー側の問題の場合）
            if (reason === 'io server disconnect') {
                this.attemptReconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket.io接続エラー:', error);
            this.isConnected = false;
            this.attemptReconnect();
        });

        this.socket.on('error', (error) => {
            console.error('Socket.ioエラー:', error);
        });

        // 認証エラー
        this.socket.on('auth_error', (error) => {
            console.error('Socket.io認証エラー:', error);
            this.emit('auth_error', error);
        });
    }

    // 自動再接続の試行
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Socket.io再接続の最大試行回数に到達しました');
            this.emit('max_reconnect_attempts_reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Socket.io再接続を試行します (${this.reconnectAttempts}/${this.maxReconnectAttempts}) - ${delay}ms後`);
        
        setTimeout(() => {
            if (!this.isConnected && this.socket) {
                this.socket.connect();
            }
        }, delay);
    }

    // メッセージ関連イベントの設定
    setupMessageEvents() {
        // 新しいメッセージを受信
        this.socket.on('new_message', (message) => {
            console.log('新しいメッセージを受信:', message);
            this.emit('new_message', message);
        });

        // メッセージ削除
        this.socket.on('message_deleted', (data) => {
            console.log('メッセージが削除されました:', data);
            this.emit('message_deleted', data);
        });

        // メッセージ編集
        this.socket.on('message_edited', (message) => {
            console.log('メッセージが編集されました:', message);
            this.emit('message_edited', message);
        });

        // タイピング状態の更新
        this.socket.on('user_typing', (data) => {
            this.emit('user_typing', data);
        });

        this.socket.on('user_stop_typing', (data) => {
            this.emit('user_stop_typing', data);
        });
    }

    // チャネル/ギルド関連イベントの設定
    setupChannelEvents() {
        // チャネル参加
        this.socket.on('channel_joined', (data) => {
            console.log('チャネルに参加しました:', data);
            this.emit('channel_joined', data);
        });

        // チャネル退出
        this.socket.on('channel_left', (data) => {
            console.log('チャネルから退出しました:', data);
            this.emit('channel_left', data);
        });

        // 新しいチャネル作成
        this.socket.on('channel_created', (channel) => {
            console.log('新しいチャネルが作成されました:', channel);
            this.emit('channel_created', channel);
        });

        // チャネル更新
        this.socket.on('channel_updated', (channel) => {
            console.log('チャネルが更新されました:', channel);
            this.emit('channel_updated', channel);
        });

        // チャネル削除
        this.socket.on('channel_deleted', (data) => {
            console.log('チャネルが削除されました:', data);
            this.emit('channel_deleted', data);
        });
    }

    // ユーザー関連イベントの設定
    setupUserEvents() {
        // ユーザーのオンライン状態更新
        this.socket.on('user_online', (user) => {
            this.emit('user_online', user);
        });

        this.socket.on('user_offline', (user) => {
            this.emit('user_offline', user);
        });

        // ユーザーがギルドに参加
        this.socket.on('user_joined_guild', (data) => {
            console.log('ユーザーがギルドに参加:', data);
            this.emit('user_joined_guild', data);
        });

        // ユーザーがギルドから退出
        this.socket.on('user_left_guild', (data) => {
            console.log('ユーザーがギルドから退出:', data);
            this.emit('user_left_guild', data);
        });
    }

    // チャネルに参加
    joinChannel(channelId) {
        if (this.socket && this.isConnected) {
            console.log('チャネルに参加:', channelId);
            this.socket.emit('join_channel', { channelId });
        }
    }

    // チャネルから退出
    leaveChannel(channelId) {
        if (this.socket && this.isConnected) {
            console.log('チャネルから退出:', channelId);
            this.socket.emit('leave_channel', { channelId });
        }
    }

    // メッセージを送信
    sendMessage(channelId, content, type = 'text') {
        if (this.socket && this.isConnected) {
            const messageData = {
                channelId,
                content,
                type,
                timestamp: Date.now()
            };
            
            console.log('メッセージを送信:', messageData);
            this.socket.emit('send_message', messageData);
        }
    }

    // タイピング状態を送信
    sendTyping(channelId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('typing', { channelId });
        }
    }

    // タイピング停止を送信
    stopTyping(channelId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('stop_typing', { channelId });
        }
    }

    // カスタムイベントの送信
    emit(event, data) {
        if (this.socket && this.isConnected) {
            this.socket.emit(event, data);
        }
    }

    // イベントハンドラーの登録
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);

        // Socket.ioイベントも登録
        if (this.socket) {
            this.socket.on(event, handler);
        }
    }

    // イベントハンドラーの削除
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }

        // Socket.ioイベントも削除
        if (this.socket) {
            this.socket.off(event, handler);
        }
    }

    // 全ての初期イベントを設定
    setupAllEvents() {
        this.setupMessageEvents();
        this.setupChannelEvents();
        this.setupUserEvents();
    }

    // 接続状態の取得
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            socketId: this.socket?.id
        };
    }

    // 切断
    disconnect() {
        if (this.socket) {
            console.log('Socket.io接続を切断します...');
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    // イベントエミッター（内部用）
    emit(eventName, data) {
        if (this.eventHandlers.has(eventName)) {
            this.eventHandlers.get(eventName).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`イベントハンドラーエラー (${eventName}):`, error);
                }
            });
        }
    }
}

// グローバルインスタンス
window.socketManager = new SocketManager();
