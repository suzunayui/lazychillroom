// チャンネル管理機能クラス
class ChannelManager {
    constructor() {
        this.apiBase = 'api';
    }

    // チャンネル作成
    async createChannel(guildId, channelData) {
        try {
            const response = await fetch(`${this.apiBase}/manage_channels.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    guild_id: guildId,
                    category_id: channelData.categoryId,
                    name: channelData.name,
                    topic: channelData.topic || '',
                    type: channelData.type || 'text'
                })
            });

            const data = await response.json();
            
            if (data.success) {
                return data.channel;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('チャンネル作成エラー:', error);
            throw error;
        }
    }

    // チャンネル更新
    async updateChannel(channelId, channelData) {
        try {
            const response = await fetch(`${this.apiBase}/manage_channels.php`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    channel_id: channelId,
                    name: channelData.name,
                    topic: channelData.topic || ''
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message);
            }
            
            return data;
        } catch (error) {
            console.error('チャンネル更新エラー:', error);
            throw error;
        }
    }

    // チャンネル削除
    async deleteChannel(channelId) {
        try {
            const response = await fetch(`${this.apiBase}/manage_channels.php`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    channel_id: channelId
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message);
            }
            
            return data;
        } catch (error) {
            console.error('チャンネル削除エラー:', error);
            throw error;
        }
    }

    // チャンネル一覧取得
    async getChannels(guildId) {
        try {
            const response = await fetch(`${this.apiBase}/manage_channels.php?guild_id=${guildId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                return data.channels;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('チャンネル一覧取得エラー:', error);
            throw error;
        }
    }

    // チャンネル作成モーダルを表示
    showCreateChannelModal(guildId, categoryId = null) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content channel-create-modal">
                <div class="modal-header">
                    <h3>テキストチャンネルを作成</h3>
                    <button class="modal-close" id="closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="createChannelForm">
                        <div class="form-group">
                            <label for="channelName">チャンネル名 *</label>
                            <input type="text" id="channelName" name="name" required 
                                   placeholder="新しいチャンネル" maxlength="100">
                            <small class="form-hint">英数字、日本語、ハイフン、アンダースコアが使用できます</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="channelTopic">チャンネルの説明</label>
                            <textarea id="channelTopic" name="topic" 
                                    placeholder="このチャンネルの用途を説明してください" 
                                    maxlength="1024" rows="3"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="channelCategory">カテゴリ</label>
                            <select id="channelCategory" name="category_id">
                                <option value="">カテゴリなし</option>
                            </select>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="cancelCreate">キャンセル</button>
                            <button type="submit" class="btn btn-primary">チャンネルを作成</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // カテゴリ一覧を読み込み
        this.loadCategories(guildId, categoryId);

        // イベントリスナー
        const form = modal.querySelector('#createChannelForm');
        const closeBtn = modal.querySelector('#closeModal');
        const cancelBtn = modal.querySelector('#cancelCreate');

        const closeModal = () => {
            document.body.removeChild(modal);
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const channelData = {
                name: formData.get('name').trim(),
                topic: formData.get('topic').trim(),
                categoryId: formData.get('category_id') || null,
                type: 'text'
            };

            try {
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = '作成中...';

                const newChannel = await this.createChannel(guildId, channelData);
                
                // 成功通知
                this.showNotification('チャンネルが正常に作成されました', 'success');
                
                // チャンネルリストを更新
                if (window.chatUI) {
                    await window.chatUI.loadGuildChannels(guildId);
                }
                
                closeModal();
            } catch (error) {
                this.showNotification(error.message, 'error');
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.textContent = 'チャンネルを作成';
            }
        });
    }

    // カテゴリ一覧をロード
    async loadCategories(guildId, selectedCategoryId = null) {
        try {
            // 簡単な実装：固定のカテゴリを使用
            const categorySelect = document.querySelector('#channelCategory');
            if (categorySelect) {
                // デフォルトではテキストチャンネルカテゴリ（ID: 1）を選択
                categorySelect.innerHTML = `
                    <option value="">カテゴリなし</option>
                    <option value="1" ${selectedCategoryId === 1 ? 'selected' : ''}>テキストチャンネル</option>
                    <option value="2" ${selectedCategoryId === 2 ? 'selected' : ''}>ボイスチャンネル</option>
                `;
                
                if (selectedCategoryId) {
                    categorySelect.value = selectedCategoryId;
                } else {
                    categorySelect.value = "1"; // デフォルトでテキストチャンネルカテゴリを選択
                }
            }
        } catch (error) {
            console.error('カテゴリ読み込みエラー:', error);
        }
    }

    // 通知表示
    showNotification(message, type = 'info') {
        // 既存の通知を削除
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        // 自動削除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // 閉じるボタン
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }
}

// グローバルスコープに登録
window.ChannelManager = ChannelManager;
