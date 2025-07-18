// DM（ダイレクトメッセージ）管理クラス
class DMManager {
    constructor() {
        this.dmChannels = [];
        this.currentDM = null;
        
        console.log('DMManager初期化完了');
    }

    // DMチャンネルリストを取得
    async loadDMChannels() {
        try {
            const response = await apiClient.request('/dm', {
                method: 'GET'
            });

            if (response.success) {
                this.dmChannels = response.channels;
                console.log('✅ DMチャンネル読み込み成功:', this.dmChannels);
                return this.dmChannels;
            } else {
                console.error('DMチャンネル読み込みエラー:', response.message);
                return [];
            }
        } catch (error) {
            console.error('DMチャンネル読み込みエラー:', error);
            return [];
        }
    }

    // 新しいDMチャンネルを作成または既存のものを取得
    async createOrGetDMChannel(userId) {
        try {
            const response = await apiClient.request('/dm', {
                method: 'POST',
                body: {
                    user_id: userId
                }
            });

            if (response.success) {
                console.log('✅ DMチャンネル作成/取得成功:', response.channel);
                
                // ローカルリストを更新
                const existingIndex = this.dmChannels.findIndex(dm => dm.id === response.channel.id);
                if (existingIndex >= 0) {
                    this.dmChannels[existingIndex] = response.channel;
                } else {
                    this.dmChannels.unshift(response.channel);
                }
                
                return response.channel;
            } else {
                console.error('DMチャンネル作成エラー:', response.message);
                return null;
            }
        } catch (error) {
            console.error('DMチャンネル作成エラー:', error);
            return null;
        }
    }

    // DMチャンネルの詳細を取得
    async getDMChannel(channelId) {
        try {
            const response = await apiClient.request(`/api/dm/${channelId}`, {
                method: 'GET'
            });

            if (response.success) {
                return response.channel;
            } else {
                console.error('DMチャンネル取得エラー:', response.message);
                return null;
            }
        } catch (error) {
            console.error('DMチャンネル取得エラー:', error);
            return null;
        }
    }

    // 特定のユーザーとのDMチャンネルを検索
    findDMChannelWithUser(userId) {
        return this.dmChannels.find(dm => 
            dm.participants.some(participant => participant.id === userId)
        );
    }

    // DMチャンネルをIDで検索
    findDMChannelById(channelId) {
        return this.dmChannels.find(dm => dm.id === parseInt(channelId));
    }

    // フレンドリストからDMを開始
    async startDMFromFriend(friend) {
        try {
            // 既存のDMチャンネルを確認
            let dmChannel = this.findDMChannelWithUser(friend.friend_id || friend.id);
            
            if (!dmChannel) {
                // 新しいDMチャンネルを作成
                dmChannel = await this.createOrGetDMChannel(friend.friend_id || friend.id);
            }

            if (dmChannel) {
                // DMチャンネルに切り替え
                await this.switchToDMChannel(dmChannel);
                return dmChannel;
            }
        } catch (error) {
            console.error('フレンドからのDM開始エラー:', error);
        }
        return null;
    }

    // DMチャンネルに切り替え
    async switchToDMChannel(dmChannel) {
        this.currentDM = dmChannel;
        
        // UIを更新（ChatUIのメソッドを呼び出し）
        if (window.chatUI) {
            window.chatUI.currentChannel = dmChannel;
            window.chatUI.updateChatHeader(dmChannel);
            await window.chatUI.loadAndRenderMessages(dmChannel.id);
            
            // メンバーリストを非表示
            window.chatUI.uiUtils.hideMembersList();
            
            // アクティブ状態を更新
            document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const dmItem = document.querySelector(`[data-dm="${dmChannel.id}"]`);
            if (dmItem) {
                dmItem.classList.add('active');
            }
            
            console.log(`DMチャンネルに切り替え: ${dmChannel.display_name}`);
        }
    }

    // ユーザー検索からDMを開始
    async startDMFromSearch(userid) {
        try {
            // ユーザーを検索
            const response = await apiClient.request(`/api/users/search?q=${encodeURIComponent(userid)}&limit=1`, {
                method: 'GET'
            });

            if (response.success && response.users.length > 0) {
                const user = response.users[0];
                const dmChannel = await this.createOrGetDMChannel(user.id);
                
                if (dmChannel) {
                    await this.switchToDMChannel(dmChannel);
                    return dmChannel;
                }
            } else {
                throw new Error('ユーザーが見つかりません');
            }
        } catch (error) {
            console.error('検索からのDM開始エラー:', error);
            throw error;
        }
    }

    // DMチャンネルリストのHTML生成
    generateDMListHTML() {
        let html = '';
        
        this.dmChannels.forEach(dm => {
            const participant = dm.participants[0];
            if (participant) {
                html += `
                    <div class="dm-user-item" data-dm="${dm.id}">
                        <div class="dm-avatar">
                            ${participant.avatar_url ? 
                                `<img src="${participant.avatar_url}" alt="${participant.userid}">` : 
                                participant.userid.charAt(0).toUpperCase()
                            }
                        </div>
                        <span class="dm-name">${UIUtils.escapeHtml(participant.userid)}</span>
                        <div class="dm-status online"></div>
                    </div>
                `;
            }
        });
        
        // フレンド追加ボタン
        html += `
            <div class="dm-user-item add-friend" id="addFriendBtn">
                <div class="dm-avatar plus">+</div>
                <span class="dm-name">フレンドを追加</span>
            </div>
        `;
        
        return html;
    }

    // DM機能の初期化
    async init() {
        await this.loadDMChannels();
    }

    // DMチャンネルを削除
    async deleteDMChannel(channelId) {
        try {
            const response = await apiClient.request(`/dm/${channelId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                // ローカルリストから削除
                this.dmChannels = this.dmChannels.filter(dm => dm.id !== parseInt(channelId));
                console.log('✅ DMチャンネル削除成功');
                return true;
            } else {
                console.error('DMチャンネル削除エラー:', response.message);
                return false;
            }
        } catch (error) {
            console.error('DMチャンネル削除エラー:', error);
            return false;
        }
    }
}

// グローバルスコープに登録
window.DMManager = DMManager;
