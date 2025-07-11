// ポーリングマネージャー（WebSocketの代替）
class PollingManager {
    constructor() {
        this.isPolling = false;
        this.pollingInterval = null;
        this.pollFrequency = 5000; // 5秒間隔
        this.messageHandlers = new Map();
        this.lastMessageId = 0;
        this.currentChannelId = null;
        this.authToken = null;
    }

    // ポーリング開始
    startPolling(channelId) {
        this.currentChannelId = channelId;
        this.stopPolling(); // 既存のポーリングを停止
        
        console.log(`チャンネル${channelId}のポーリングを開始します（${this.pollFrequency}ms間隔）`);
        this.isPolling = true;
        
        // 初回実行
        this.pollMessages();
        
        // 定期実行
        this.pollingInterval = setInterval(() => {
            this.pollMessages();
        }, this.pollFrequency);
        
        this.emit('pollingStarted', { channelId });
    }

    // ポーリング停止
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
        console.log('ポーリングを停止しました');
        this.emit('pollingStopped');
    }

    // メッセージをポーリング
    async pollMessages() {
        if (!this.currentChannelId) return;

        try {
            const response = await fetch('/api/messages.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'get_messages',
                    channel_id: this.currentChannelId,
                    since_message_id: this.lastMessageId,
                    limit: 50
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.messages && data.messages.length > 0) {
                // 新しいメッセージがある場合
                this.handleNewMessages(data.messages);
                
                // 最新メッセージIDを更新
                const latestMessage = data.messages[data.messages.length - 1];
                this.lastMessageId = latestMessage.message_id;
            }

        } catch (error) {
            console.error('メッセージポーリングエラー:', error);
            this.emit('pollingError', error);
            
            // エラーが続く場合は少し間隔を空ける
            if (this.isPolling) {
                this.stopPolling();
                setTimeout(() => {
                    if (this.currentChannelId) {
                        this.startPolling(this.currentChannelId);
                    }
                }, 10000); // 10秒後に再開
            }
        }
    }

    // 新しいメッセージの処理
    handleNewMessages(messages) {
        messages.forEach(message => {
            this.emit('newMessage', message);
        });
        
        this.emit('messagesUpdated', messages);
    }

    // オンラインユーザーの取得
    async pollOnlineUsers() {
        if (!this.currentChannelId) return;

        try {
            const response = await fetch('/api/users.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'get_online_users',
                    channel_id: this.currentChannelId
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.emit('onlineUsersUpdated', data.users);
                }
            }

        } catch (error) {
            console.error('オンラインユーザー取得エラー:', error);
        }
    }

    // メッセージ送信
    async sendMessage(channelId, content, messageType = 'text') {
        try {
            const response = await fetch('/api/messages.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'send_message',
                    channel_id: channelId,
                    content: content,
                    message_type: messageType
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.emit('messageSent', data.message);
                // 送信後すぐにポーリング実行
                setTimeout(() => this.pollMessages(), 100);
            } else {
                throw new Error(data.error || 'メッセージ送信に失敗しました');
            }

            return data;

        } catch (error) {
            console.error('メッセージ送信エラー:', error);
            this.emit('messageSendError', error);
            throw error;
        }
    }

    // イベントハンドラー管理
    on(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }

    off(type, handler) {
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(type, data) {
        if (this.messageHandlers.has(type)) {
            this.messageHandlers.get(type).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('イベントハンドラーエラー:', error);
                }
            });
        }
    }

    // チャンネル変更
    changeChannel(channelId) {
        if (this.currentChannelId !== channelId) {
            this.lastMessageId = 0; // リセット
            this.startPolling(channelId);
        }
    }

    // ポーリング頻度の変更
    setPollingFrequency(milliseconds) {
        this.pollFrequency = Math.max(1000, milliseconds); // 最低1秒
        if (this.isPolling) {
            // 現在のポーリングを再開
            const channelId = this.currentChannelId;
            this.startPolling(channelId);
        }
    }

    // 接続状態チェック
    checkConnection() {
        return this.isPolling;
    }

    // チャンネル参加（WebSocket API互換）
    joinChannel(channelId) {
        this.changeChannel(channelId);
    }

    // チャンネル離脱（WebSocket API互換）
    leaveChannel(channelId) {
        if (this.currentChannelId === channelId) {
            this.stopPolling();
        }
    }
}

// タイピングインジケーター管理（ポーリング版）
class TypingIndicator {
    constructor() {
        this.typingUsers = new Map(); // チャンネルID -> ユーザーIDのMap
        this.typingTimeouts = new Map(); // ユーザーID -> タイムアウトID
        this.typingTimer = null;
        this.isTyping = false;
        this.currentChannelId = null;
    }

    // タイピング開始
    startTyping(channelId, userId) {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        if (!this.isTyping) {
            this.isTyping = true;
            this.currentChannelId = channelId;
            
            // サーバーにタイピング状態を送信
            this.sendTypingStatus(channelId, true);
        }

        // 3秒後に自動停止
        this.typingTimer = setTimeout(() => {
            this.stopTyping(channelId, userId);
        }, 3000);
    }

    // タイピング停止
    stopTyping(channelId, userId) {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }

        if (this.isTyping) {
            this.isTyping = false;
            this.sendTypingStatus(channelId, false);
        }
    }

    // タイピング状態をサーバーに送信
    async sendTypingStatus(channelId, isTyping) {
        try {
            await fetch('/api/typing.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: isTyping ? 'start_typing' : 'stop_typing',
                    channel_id: channelId
                })
            });
        } catch (error) {
            console.error('タイピング状態送信エラー:', error);
        }
    }

    // タイピング中のユーザーを取得
    async pollTypingUsers(channelId) {
        try {
            const response = await fetch('/api/typing.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'get_typing_users',
                    channel_id: channelId
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateTypingDisplay(channelId, data.users);
                }
            }

        } catch (error) {
            console.error('タイピングユーザー取得エラー:', error);
        }
    }

    // タイピングインジケーターの表示を更新
    updateTypingDisplay(channelId, typingUsers) {
        const typingContainer = document.getElementById('typingIndicator');
        if (!typingContainer) return;

        if (typingUsers && typingUsers.length > 0) {
            const usernames = typingUsers.map(user => user.username);
            let text = '';
            
            if (usernames.length === 1) {
                text = `${usernames[0]}が入力中...`;
            } else if (usernames.length === 2) {
                text = `${usernames[0]}と${usernames[1]}が入力中...`;
            } else {
                text = `${usernames.slice(0, 2).join(', ')}と他${usernames.length - 2}人が入力中...`;
            }
            
            typingContainer.textContent = text;
            typingContainer.style.display = 'block';
        } else {
            typingContainer.style.display = 'none';
        }
    }
}

// グローバルなポーリングマネージャー
window.pollingManager = new PollingManager();
window.typingIndicator = new TypingIndicator();
