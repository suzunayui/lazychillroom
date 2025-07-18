// リアクション管理クラス
class ReactionManager {
    constructor() {
        this.commonEmojis = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉', '🔥'];
        
        // Socket.ioイベントのリスニング
        this.bindSocketEvents();
        
        console.log('ReactionManager初期化完了');
    }

    // Socket.ioイベントをバインド
    bindSocketEvents() {
        if (window.socket) {
            window.socket.on('reaction_added', (data) => {
                this.handleReactionAdded(data);
            });

            window.socket.on('reaction_removed', (data) => {
                this.handleReactionRemoved(data);
            });
        }
    }

    // メッセージにリアクションを追加
    async addReaction(messageId, emoji) {
        try {
            const response = await apiClient.request('/reactions', {
                method: 'POST',
                body: {
                    message_id: messageId,
                    emoji_unicode: emoji
                }
            });

            if (response.success) {
                console.log(`✅ リアクション${response.action}:`, emoji);
                return response;
            } else {
                console.error('リアクション追加エラー:', response.message);
                return null;
            }
        } catch (error) {
            console.error('リアクション追加エラー:', error);
            return null;
        }
    }

    // メッセージのリアクションを取得
    async getReactions(messageId) {
        try {
            const response = await apiClient.request(`/reactions/${messageId}`, {
                method: 'GET'
            });

            if (response.success) {
                return response.reactions;
            } else {
                console.error('リアクション取得エラー:', response.message);
                return [];
            }
        } catch (error) {
            console.error('リアクション取得エラー:', error);
            return [];
        }
    }

    // リアクションを削除
    async removeReaction(messageId, emoji) {
        try {
            const response = await apiClient.request('/reactions', {
                method: 'DELETE',
                body: {
                    message_id: messageId,
                    emoji_unicode: emoji
                }
            });

            if (response.success) {
                console.log('✅ リアクション削除:', emoji);
                return response;
            } else {
                console.error('リアクション削除エラー:', response.message);
                return null;
            }
        } catch (error) {
            console.error('リアクション削除エラー:', error);
            return null;
        }
    }

    // Socket.ioからのリアクション追加イベント処理
    handleReactionAdded(data) {
        const { messageId, reactions } = data;
        this.updateMessageReactions(messageId, reactions);
    }

    // Socket.ioからのリアクション削除イベント処理
    handleReactionRemoved(data) {
        const { messageId, reactions } = data;
        this.updateMessageReactions(messageId, reactions);
    }

    // メッセージのリアクション表示を更新
    updateMessageReactions(messageId, reactions) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        let reactionsContainer = messageElement.querySelector('.message-reactions');
        
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'message-reactions';
            messageElement.appendChild(reactionsContainer);
        }

        // リアクションHTMLを生成
        let reactionsHTML = '';
        
        if (reactions && reactions.length > 0) {
            reactions.forEach(reaction => {
                const userReacted = reaction.user_reacted || reaction.user_ids.includes(window.currentUser?.id);
                reactionsHTML += `
                    <div class="reaction-item ${userReacted ? 'user-reacted' : ''}" 
                         data-emoji="${reaction.emoji}" 
                         data-message-id="${messageId}"
                         title="${reaction.users.join(', ')}">
                        <span class="reaction-emoji">${reaction.emoji}</span>
                        <span class="reaction-count">${reaction.count}</span>
                    </div>
                `;
            });
        }

        reactionsContainer.innerHTML = reactionsHTML;

        // リアクションクリックイベントをバインド
        this.bindReactionClickEvents(reactionsContainer);
    }

    // リアクションクリックイベントをバインド
    bindReactionClickEvents(container) {
        const reactionItems = container.querySelectorAll('.reaction-item');
        
        reactionItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const emoji = item.dataset.emoji;
                const messageId = parseInt(item.dataset.messageId);
                
                await this.addReaction(messageId, emoji);
            });
        });
    }

    // メッセージにリアクションピッカーを表示
    showReactionPicker(messageElement, messageId) {
        // 既存のピッカーを削除
        this.hideReactionPicker();

        const picker = document.createElement('div');
        picker.className = 'reaction-picker';
        picker.innerHTML = `
            <div class="reaction-picker-content">
                <div class="emoji-grid">
                    ${this.commonEmojis.map(emoji => 
                        `<div class="emoji-option" data-emoji="${emoji}">${emoji}</div>`
                    ).join('')}
                </div>
            </div>
        `;

        // メッセージ要素に追加
        messageElement.appendChild(picker);

        // 絵文字クリックイベント
        picker.querySelectorAll('.emoji-option').forEach(option => {
            option.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const emoji = option.dataset.emoji;
                await this.addReaction(messageId, emoji);
                this.hideReactionPicker();
            });
        });

        // 外側クリックで閉じる
        setTimeout(() => {
            document.addEventListener('click', this.hideReactionPicker.bind(this), { once: true });
        }, 10);
    }

    // リアクションピッカーを非表示
    hideReactionPicker() {
        const existing = document.querySelector('.reaction-picker');
        if (existing) {
            existing.remove();
        }
    }

    // メッセージ要素にリアクションボタンを追加
    addReactionButton(messageElement, messageId) {
        const existingButton = messageElement.querySelector('.add-reaction-btn');
        if (existingButton) return; // 既に存在する場合はスキップ

        const button = document.createElement('button');
        button.className = 'add-reaction-btn';
        button.innerHTML = '😀';
        button.title = 'リアクションを追加';
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showReactionPicker(messageElement, messageId);
        });

        // メッセージコンテンツの後に追加
        const messageContent = messageElement.querySelector('.message-content');
        if (messageContent) {
            messageContent.appendChild(button);
        }
    }

    // メッセージ全体にリアクション機能を初期化
    initializeMessageReactions(messageElement, messageData) {
        const messageId = messageData.id;
        
        // リアクションボタンを追加
        this.addReactionButton(messageElement, messageId);
        
        // 既存のリアクションを読み込み
        this.loadMessageReactions(messageId);
    }

    // メッセージのリアクションを読み込み
    async loadMessageReactions(messageId) {
        try {
            const reactions = await this.getReactions(messageId);
            this.updateMessageReactions(messageId, reactions);
        } catch (error) {
            console.error('リアクション読み込みエラー:', error);
        }
    }

    // 絵文字が有効かチェック
    isValidEmoji(emoji) {
        return this.commonEmojis.includes(emoji) || /\p{Emoji}/u.test(emoji);
    }
}

// グローバルスコープに登録
window.ReactionManager = ReactionManager;
