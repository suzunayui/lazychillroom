// タイピングインジケーター管理クラス（Node.js版）
class TypingManager {
    constructor() {
        this.typingUsers = new Map(); // channelId -> Set of userIds
        this.typingTimeouts = new Map(); // userId_channelId -> timeoutId
        this.isTyping = false;
        this.currentChannelId = null;
        this.typingTimeout = null;
        
        // Socket.ioイベントのリスニング
        this.bindSocketEvents();
        
        console.log('TypingManager初期化完了');
    }

    // Socket.ioイベントをバインド
    bindSocketEvents() {
        if (window.socket) {
            window.socket.on('typing_start', (data) => {
                this.handleTypingStart(data);
            });

            window.socket.on('typing_stop', (data) => {
                this.handleTypingStop(data);
            });
        }
    }

    // タイピング開始処理
    async startTyping(channelId) {
        if (this.isTyping && this.currentChannelId === channelId) {
            return; // 既にタイピング中
        }

        try {
            // 既存のタイマーをクリア
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }

            // サーバーにタイピング開始を送信
            const response = await apiClient.request('/typing/start', {
                method: 'POST',
                body: {
                    channel_id: channelId
                }
            });

            if (response.success) {
                this.isTyping = true;
                this.currentChannelId = channelId;

                // 3秒後に自動停止
                this.typingTimeout = setTimeout(() => {
                    this.stopTyping(channelId);
                }, 3000);
            }
        } catch (error) {
            console.error('タイピング開始エラー:', error);
        }
    }

    // タイピング停止処理
    async stopTyping(channelId) {
        if (!this.isTyping || this.currentChannelId !== channelId) {
            return; // タイピング中ではない
        }

        try {
            // タイマーをクリア
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
                this.typingTimeout = null;
            }

            // サーバーにタイピング停止を送信
            const response = await apiClient.request('/typing/stop', {
                method: 'POST',
                body: {
                    channel_id: channelId
                }
            });

            if (response.success) {
                this.isTyping = false;
                this.currentChannelId = null;
            }
        } catch (error) {
            console.error('タイピング停止エラー:', error);
        }
    }

    // Socket.ioからのタイピング開始イベント処理
    handleTypingStart(data) {
        const { userId, userid, channelId } = data;
        
        if (!this.typingUsers.has(channelId)) {
            this.typingUsers.set(channelId, new Map());
        }
        
        this.typingUsers.get(channelId).set(userId, userid);
        
        // 既存のタイムアウトをクリア
        const timeoutKey = `${userId}_${channelId}`;
        if (this.typingTimeouts.has(timeoutKey)) {
            clearTimeout(this.typingTimeouts.get(timeoutKey));
        }
        
        // 5秒後に自動削除
        const timeoutId = setTimeout(() => {
            this.handleTypingStop({ userId, channelId });
        }, 5000);
        
        this.typingTimeouts.set(timeoutKey, timeoutId);
        
        // 表示を更新
        this.updateTypingDisplay(channelId);
    }

    // Socket.ioからのタイピング停止イベント処理
    handleTypingStop(data) {
        const { userId, channelId } = data;
        
        if (this.typingUsers.has(channelId)) {
            this.typingUsers.get(channelId).delete(userId);
            
            if (this.typingUsers.get(channelId).size === 0) {
                this.typingUsers.delete(channelId);
            }
        }
        
        // タイムアウトをクリア
        const timeoutKey = `${userId}_${channelId}`;
        if (this.typingTimeouts.has(timeoutKey)) {
            clearTimeout(this.typingTimeouts.get(timeoutKey));
            this.typingTimeouts.delete(timeoutKey);
        }
        
        // 表示を更新
        this.updateTypingDisplay(channelId);
    }

    // タイピング表示を更新
    updateTypingDisplay(channelId) {
        const indicator = document.getElementById('typing-indicator');
        if (!indicator) return;

        // 現在のチャンネルのタイピングユーザーのみ表示
        const currentChannelElement = document.querySelector('.channel-item.active');
        if (!currentChannelElement) return;

        const activeChannelId = currentChannelElement.dataset.channel;
        if (parseInt(activeChannelId) !== parseInt(channelId)) return;

        const typingUsers = this.typingUsers.get(channelId);
        
        if (!typingUsers || typingUsers.size === 0) {
            indicator.style.display = 'none';
            indicator.innerHTML = '';
            return;
        }

        const userids = Array.from(typingUsers.values());
        let message;

        if (userids.length === 1) {
            message = `${userids[0]}がタイピング中...`;
        } else if (userids.length === 2) {
            message = `${userids[0]}と${userids[1]}がタイピング中...`;
        } else {
            message = `${userids.length}人がタイピング中...`;
        }

        indicator.innerHTML = `
            <div class="typing-animation">
                <span class="typing-text">${UIUtils.escapeHtml(message)}</span>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        indicator.style.display = 'block';
    }

    // チャンネル切り替え時にタイピング表示をリセット
    clearTypingDisplay() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
            indicator.innerHTML = '';
        }
    }

    // 現在のチャンネルのタイピング状態を取得
    async getTypingUsers(channelId) {
        try {
            const response = await apiClient.request(`/api/typing/${channelId}`, {
                method: 'GET'
            });

            if (response.success) {
                return response.typing_users;
            }
        } catch (error) {
            console.error('タイピングユーザー取得エラー:', error);
        }
        return [];
    }

    // メッセージ入力時のタイピングイベントハンドリング
    handleMessageInput(channelId) {
        if (!channelId) return;

        this.startTyping(channelId);
    }

    // メッセージ送信時のタイピング停止
    handleMessageSent(channelId) {
        if (!channelId) return;

        this.stopTyping(channelId);
    }
}

// グローバルスコープに登録
window.TypingManager = TypingManager;
