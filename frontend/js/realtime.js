// Socket.ioリアルタイム通信マネージャー（旧ポーリングマネージャーを置き換え）
class RealtimeManager {
    constructor() {
        this.currentChannelId = null;
        this.messageHandlers = new Map();
        this.socketManager = window.socketManager;
        this.setupEventHandlers();
    }

    // Socket.ioイベントハンドラーの設定
    setupEventHandlers() {
        if (!this.socketManager) {
            console.error('SocketManager が利用できません');
            return;
        }

        // 新しいメッセージを受信
        this.socketManager.on('new_message', (message) => {
            console.log('新しいメッセージを受信:', message);
            this.handleNewMessage(message);
        });

        // メッセージ削除
        this.socketManager.on('message_deleted', (data) => {
            this.handleMessageDeleted(data);
        });

        // メッセージ編集
        this.socketManager.on('message_edited', (message) => {
            this.handleMessageEdited(message);
        });

        // タイピング状態
        this.socketManager.on('user_typing', (data) => {
            this.handleUserTyping(data);
        });

        this.socketManager.on('user_stop_typing', (data) => {
            this.handleUserStopTyping(data);
        });

        // チャネル関連イベント
        this.socketManager.on('channel_joined', (data) => {
            this.emit('channelJoined', data);
        });

        this.socketManager.on('channel_left', (data) => {
            this.emit('channelLeft', data);
        });

        // ユーザーオンライン状態
        this.socketManager.on('user_online', (user) => {
            this.emit('userOnline', user);
        });

        this.socketManager.on('user_offline', (user) => {
            this.emit('userOffline', user);
        });
    }

    // チャネルに参加（ポーリング開始の代替）
    joinChannel(channelId) {
        console.log('🔗 RealtimeManager: チャネル参加要求:', {
            requestedChannelId: channelId,
            currentChannelId: this.currentChannelId,
            isAlreadyJoined: this.currentChannelId === channelId
        });
        
        if (this.currentChannelId === channelId) {
            console.log('✅ 既に同じチャネルに参加済み');
            return;
        }
        
        // 前のチャネルから退出
        if (this.currentChannelId) {
            console.log('🚪 前のチャネルから退出:', this.currentChannelId);
            this.leaveChannel(this.currentChannelId);
        }

        this.currentChannelId = channelId;
        console.log(`🎯 チャネル${channelId}に参加します`);
        
        if (this.socketManager && this.socketManager.isConnected) {
            console.log('📡 SocketManagerでチャネル参加');
            this.socketManager.joinChannel(channelId);
        } else {
            console.warn('⚠️ SocketManager接続なし - チャネル参加をスキップ');
        }
        
        this.emit('channelJoined', { channelId });
    }

    // チャネルから退出（ポーリング停止の代替）
    leaveChannel(channelId = null) {
        const targetChannelId = channelId || this.currentChannelId;
        
        if (targetChannelId) {
            console.log(`チャンネル${targetChannelId}から退出します`);
            
            if (this.socketManager && this.socketManager.isConnected) {
                this.socketManager.leaveChannel(targetChannelId);
            }
            
            this.emit('channelLeft', { channelId: targetChannelId });
        }

        if (!channelId) {
            this.currentChannelId = null;
        }
    }

    // メッセージ送信（Socket.io経由）
    sendMessage(channelId, content, type = 'text') {
        if (this.socketManager && this.socketManager.isConnected) {
            this.socketManager.sendMessage(channelId, content, type);
        } else {
            console.error('Socket.io接続が利用できません');
            // フォールバック: HTTP API経由で送信
            this.sendMessageViaHttp(channelId, content, type);
        }
    }

    // HTTP API経由でのメッセージ送信（フォールバック）
    async sendMessageViaHttp(channelId, content, type = 'text') {
        try {
            const response = await apiClient.request('/messages', {
                method: 'POST',
                body: JSON.stringify({
                    channel_id: channelId,
                    content: content
                    // type フィールドを削除（サーバー側でサポートされていない）
                })
            });

            if (response.success) {
                console.log('メッセージが送信されました (HTTP):', response.message);
                // 送信成功時は Socket.io 経由で他のクライアントに通知される
            }
        } catch (error) {
            console.error('メッセージ送信エラー (HTTP):', error);
            this.emit('messageSendError', { error, channelId, content });
        }
    }

    // タイピング状態の送信
    sendTyping(channelId) {
        if (this.socketManager && this.socketManager.isConnected) {
            this.socketManager.sendTyping(channelId);
        }
    }

    // タイピング停止の送信
    stopTyping(channelId) {
        if (this.socketManager && this.socketManager.isConnected) {
            this.socketManager.stopTyping(channelId);
        }
    }

    // 新しいメッセージの処理
    handleNewMessage(message) {
        console.log('📨 新しいメッセージ受信詳細:', {
            message,
            currentChannelId: this.currentChannelId,
            messageChannelId: message.channel_id,
            isMatch: message.channel_id == this.currentChannelId
        });
        
        // 現在のチャネルのメッセージのみ処理
        if (message.channel_id == this.currentChannelId) {
            console.log('✅ チャネルIDが一致 - メッセージを表示します');
            this.emit('newMessage', message);
        } else {
            console.log('❌ チャネルIDが不一致 - メッセージを表示しません');
        }
    }

    // メッセージ削除の処理
    handleMessageDeleted(data) {
        if (data.channel_id == this.currentChannelId) {
            this.emit('messageDeleted', data);
        }
    }

    // メッセージ編集の処理
    handleMessageEdited(message) {
        if (message.channel_id == this.currentChannelId) {
            this.emit('messageEdited', message);
        }
    }

    // タイピング状態の処理
    handleUserTyping(data) {
        if (data.channel_id == this.currentChannelId) {
            this.emit('userTyping', data);
        }
    }

    // タイピング停止の処理
    handleUserStopTyping(data) {
        if (data.channel_id == this.currentChannelId) {
            this.emit('userStopTyping', data);
        }
    }

    // イベントハンドラーの登録
    on(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
    }

    // イベントハンドラーの削除
    off(event, handler) {
        if (this.messageHandlers.has(event)) {
            const handlers = this.messageHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    // イベントの発火
    emit(event, data) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`イベントハンドラーエラー (${event}):`, error);
                }
            });
        }
    }

    // 接続状態の取得
    getConnectionStatus() {
        return this.socketManager ? this.socketManager.getConnectionStatus() : { isConnected: false };
    }

    // 現在のチャネルIDを取得
    getCurrentChannelId() {
        return this.currentChannelId;
    }

    // チャネル設定のリセット
    reset() {
        if (this.currentChannelId) {
            this.leaveChannel();
        }
        this.messageHandlers.clear();
    }
}

// グローバルインスタンス
const realtimeManagerInstance = new RealtimeManager();
window.realtimeManager = realtimeManagerInstance;
