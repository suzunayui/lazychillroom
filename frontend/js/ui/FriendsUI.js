// DM・フレンド関連のUIコンポーネント
class FriendsUI {
    constructor(chatUI) {
        this.chatUI = chatUI;
        this.friendsManager = null;
        this.dmManager = null;
        this.currentView = 'friends'; // 'friends', 'dm', 'requests'
        this.searchQuery = '';
        
        console.log('FriendsUI初期化完了');
    }

    // マネージャーを設定
    setManagers(friendsManager, dmManager) {
        this.friendsManager = friendsManager;
        this.dmManager = dmManager;
    }

    // メイン画面を表示
    async showFriendsView() {
        try {
            // メイン画面を先に作成してローディング表示
            const html = this.createFriendsMainHTML();
            
            // メインコンテンツエリアに表示
            const mainContent = document.getElementById('chatMessages') || document.getElementById('mainContent') || document.getElementById('channelContent');
            if (mainContent) {
                mainContent.innerHTML = html;
                this.bindFriendsEvents();
                
                // ローディング表示
                const contentArea = document.getElementById('friendsContent');
                if (contentArea) {
                    contentArea.innerHTML = '<div class="loading-message">フレンド情報を読み込み中...</div>';
                }
            } else {
                console.error('メインコンテンツエリアが見つかりません');
                return;
            }

            // フレンドリストとDMチャンネルを読み込み
            await Promise.all([
                this.friendsManager.loadFriends(),
                this.friendsManager.loadFriendRequests(),
                this.dmManager.loadDMChannels()
            ]);

            // データ読み込み後にコンテンツを更新
            this.updateFriendsContent();
            
            console.log('✅ フレンド画面表示完了');
        } catch (error) {
            console.error('フレンド画面表示エラー:', error);
            this.chatUI.uiUtils.showNotification('フレンド画面の表示に失敗しました', 'error');
        }
    }

    // フレンドメイン画面のHTML
    createFriendsMainHTML() {
        return `
            <div class="friends-container">
                <div class="friends-header">
                    <div class="friends-navigation">
                        <button class="nav-btn ${this.currentView === 'friends' ? 'active' : ''}" data-view="friends">
                            <i class="fas fa-user-friends"></i>
                            フレンド
                        </button>
                        <button class="nav-btn ${this.currentView === 'dm' ? 'active' : ''}" data-view="dm">
                            <i class="fas fa-envelope"></i>
                            DM
                        </button>
                        <button class="nav-btn ${this.currentView === 'requests' ? 'active' : ''}" data-view="requests">
                            <i class="fas fa-user-plus"></i>
                            申請
                            <span class="request-badge" style="display: none;">0</span>
                        </button>
                    </div>
                    <div class="friends-actions">
                        <div class="search-container">
                            <input type="text" id="friendsSearch" placeholder="フレンドを検索..." class="search-input">
                            <i class="fas fa-search search-icon"></i>
                        </div>
                        <button class="add-friend-btn" id="addFriendBtn">
                            <i class="fas fa-user-plus"></i>
                            フレンド追加
                        </button>
                    </div>
                </div>
                <div class="friends-content" id="friendsContent">
                    <!-- コンテンツはJavaScriptで動的に生成 -->
                </div>
            </div>
        `;
    }

    // フレンドリスト表示
    renderFriendsList() {
        const friends = this.searchQuery ? 
            this.friendsManager.searchFriends(this.searchQuery) : 
            this.friendsManager.friends;

        if (friends.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-user-friends empty-icon"></i>
                    <h3>フレンドがいません</h3>
                    <p>${this.searchQuery ? '検索条件に一致するフレンドが見つかりません' : 'フレンドを追加して会話を始めましょう！'}</p>
                </div>
            `;
        }

        const friendsHTML = friends.map(friend => {
            const avatarUrl = friend.avatar_url;
            const displayName = friend.nickname || friend.userid;
            const statusClass = `status-${friend.status || 'offline'}`;
            
            return `
                <div class="friend-item" data-friend-id="${friend.friend_id}">
                    <div class="friend-avatar">
                        ${avatarUrl ? 
                            `<img src="${avatarUrl}" alt="${displayName}" class="avatar-img">` :
                            `<div class="avatar-placeholder">${displayName.charAt(0).toUpperCase()}</div>`
                        }
                        <div class="status-indicator ${statusClass}"></div>
                    </div>
                    <div class="friend-info">
                        <div class="friend-name">${displayName}</div>
                        <div class="friend-status">${this.getStatusText(friend.status || 'offline')}</div>
                    </div>
                    <div class="friend-actions">
                        <button class="action-btn dm-btn" data-friend-id="${friend.friend_id}" title="DMを送信">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button class="action-btn remove-btn" data-friend-id="${friend.friend_id}" title="フレンドを削除">
                            <i class="fas fa-user-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="friends-list">
                <div class="section-header">
                    <h3>フレンド — ${friends.length}人</h3>
                </div>
                ${friendsHTML}
            </div>
        `;
    }

    // DMリスト表示
    renderDMList() {
        const dmChannels = this.dmManager.dmChannels;

        if (dmChannels.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-envelope empty-icon"></i>
                    <h3>DMがありません</h3>
                    <p>フレンドとダイレクトメッセージを始めましょう！</p>
                </div>
            `;
        }

        const dmHTML = dmChannels.map(dm => {
            const participants = dm.participants || [];
            const otherUser = participants.find(p => p.id !== this.chatUI.currentUser.id);
            
            if (!otherUser) return '';

            const displayName = otherUser.nickname || otherUser.userid;
            const avatarUrl = otherUser.avatar_url;
            
            return `
                <div class="dm-item" data-dm-id="${dm.id}" data-user-id="${otherUser.id}">
                    <div class="dm-avatar">
                        ${avatarUrl ? 
                            `<img src="${avatarUrl}" alt="${displayName}" class="avatar-img">` :
                            `<div class="avatar-placeholder">${displayName.charAt(0).toUpperCase()}</div>`
                        }
                        <div class="status-indicator status-${otherUser.status || 'offline'}"></div>
                    </div>
                    <div class="dm-info">
                        <div class="dm-name">${displayName}</div>
                        <div class="dm-last-message">${dm.lastMessage || '新しいメッセージを送信'}</div>
                    </div>
                    <div class="dm-actions">
                        <button class="action-btn close-dm-btn" data-dm-id="${dm.id}" title="DMを閉じる">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="dm-list">
                <div class="section-header">
                    <h3>ダイレクトメッセージ</h3>
                </div>
                ${dmHTML}
            </div>
        `;
    }

    // フレンド申請リスト表示
    renderRequestsList() {
        const { incoming, outgoing } = this.friendsManager.friendRequests;

        const incomingHTML = incoming.map(request => `
            <div class="request-item incoming">
                <div class="request-avatar">
                    ${request.avatar_url ? 
                        `<img src="${request.avatar_url}" alt="${request.userid}" class="avatar-img">` :
                        `<div class="avatar-placeholder">${request.userid.charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <div class="request-info">
                    <div class="request-name">${request.nickname || request.userid}</div>
                    <div class="request-type">受信した申請</div>
                </div>
                <div class="request-actions">
                    <button class="action-btn accept-btn" data-request-id="${request.id}">
                        <i class="fas fa-check"></i>
                        承認
                    </button>
                    <button class="action-btn reject-btn" data-request-id="${request.id}">
                        <i class="fas fa-times"></i>
                        拒否
                    </button>
                </div>
            </div>
        `).join('');

        const outgoingHTML = outgoing.map(request => `
            <div class="request-item outgoing">
                <div class="request-avatar">
                    ${request.avatar_url ? 
                        `<img src="${request.avatar_url}" alt="${request.userid}" class="avatar-img">` :
                        `<div class="avatar-placeholder">${request.userid.charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <div class="request-info">
                    <div class="request-name">${request.nickname || request.userid}</div>
                    <div class="request-type">送信した申請</div>
                </div>
                <div class="request-actions">
                    <button class="action-btn cancel-btn" data-request-id="${request.id}">
                        <i class="fas fa-times"></i>
                        キャンセル
                    </button>
                </div>
            </div>
        `).join('');

        if (!incomingHTML && !outgoingHTML) {
            return `
                <div class="empty-state">
                    <i class="fas fa-user-plus empty-icon"></i>
                    <h3>申請がありません</h3>
                    <p>新しいフレンド申請がここに表示されます。</p>
                </div>
            `;
        }

        return `
            <div class="requests-list">
                ${incomingHTML ? `
                    <div class="section-header">
                        <h3>受信した申請 — ${incoming.length}件</h3>
                    </div>
                    ${incomingHTML}
                ` : ''}
                ${outgoingHTML ? `
                    <div class="section-header">
                        <h3>送信した申請 — ${outgoing.length}件</h3>
                    </div>
                    ${outgoingHTML}
                ` : ''}
            </div>
        `;
    }

    // コンテンツを更新
    updateFriendsContent() {
        const contentArea = document.getElementById('friendsContent');
        if (!contentArea) return;

        let html = '';
        switch (this.currentView) {
            case 'friends':
                html = this.renderFriendsList();
                break;
            case 'dm':
                html = this.renderDMList();
                break;
            case 'requests':
                html = this.renderRequestsList();
                break;
        }

        contentArea.innerHTML = html;
        this.updateRequestBadge();
    }

    // 申請バッジを更新
    updateRequestBadge() {
        try {
            const badge = document.querySelector('.request-badge');
            if (badge) {
                const count = this.friendsManager.getUnreadRequestCount();
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        } catch (error) {
            console.error('申請バッジ更新エラー:', error);
            // エラーが発生してもバッジを非表示にして継続
            const badge = document.querySelector('.request-badge');
            if (badge) {
                badge.style.display = 'none';
            }
        }
    }

    // イベントをバインド
    bindFriendsEvents() {
        // ナビゲーションボタン
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // 検索
        const searchInput = document.getElementById('friendsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                if (this.currentView === 'friends') {
                    this.updateFriendsContent();
                }
            });
        }

        // フレンド追加ボタン
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', () => {
                this.showAddFriendModal();
            });
        }

        // 動的イベント（イベント委譲）
        const contentArea = document.getElementById('friendsContent');
        if (contentArea) {
            contentArea.addEventListener('click', (e) => {
                this.handleContentClick(e);
            });
        }
    }

    // コンテンツクリックハンドラ
    async handleContentClick(e) {
        const target = e.target.closest('button');
        if (!target) return;

        const friendId = target.dataset.friendId;
        const dmId = target.dataset.dmId;
        const requestId = target.dataset.requestId;
        const userId = target.dataset.userId;

        try {
            if (target.classList.contains('dm-btn') && friendId) {
                // DMを開始
                await this.startDMWithFriend(friendId);
            } else if (target.classList.contains('remove-btn') && friendId) {
                // フレンド削除
                await this.removeFriend(friendId);
            } else if (target.classList.contains('accept-btn') && requestId) {
                // 申請承認
                await this.acceptRequest(requestId);
            } else if (target.classList.contains('reject-btn') && requestId) {
                // 申請拒否
                await this.rejectRequest(requestId);
            } else if (target.classList.contains('cancel-btn') && requestId) {
                // 申請キャンセル
                await this.cancelRequest(requestId);
            } else if (target.classList.contains('close-dm-btn') && dmId) {
                // DM削除
                await this.closeDM(dmId);
            } else if (target.closest('.dm-item') && dmId) {
                // DMチャンネルを開く
                await this.openDMChannel(dmId);
            }
        } catch (error) {
            console.error('操作エラー:', error);
        }
    }

    // ビュー切り替え
    switchView(view) {
        this.currentView = view;
        
        // ナビゲーションボタンの状態更新
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // 検索をリセット
        this.searchQuery = '';
        const searchInput = document.getElementById('friendsSearch');
        if (searchInput) {
            searchInput.value = '';
        }

        // コンテンツ更新
        this.updateFriendsContent();
    }

    // フレンド追加モーダル
    async showAddFriendModal() {
        const result = await this.chatUI.uiUtils.showInput({
            title: 'フレンド追加',
            message: 'フレンドのユーザー名を入力してください:',
            placeholder: 'ユーザー名',
            confirmText: '送信',
            cancelText: 'キャンセル'
        });

        if (result && result.trim()) {
            const response = await this.friendsManager.sendFriendRequest(result);
            this.chatUI.uiUtils.showNotification(response.message, response.success ? 'success' : 'error');
            
            if (response.success) {
                this.updateFriendsContent();
            }
        }
    }

    // フレンドとDM開始
    async startDMWithFriend(friendId) {
        const dmChannel = await this.dmManager.createOrGetDMChannel(parseInt(friendId));
        if (dmChannel) {
            // DMチャンネルを開く
            await this.openDMChannel(dmChannel.id);
        }
    }

    // DMチャンネルを開く
    async openDMChannel(dmId) {
        // チャットUIでDMチャンネルを表示
        if (this.chatUI.channelManager) {
            await this.chatUI.channelManager.switchToChannel(dmId, 'dm');
        }
    }

    // フレンド削除
    async removeFriend(friendId) {
        const confirmed = await this.chatUI.uiUtils.showConfirm({
            title: 'フレンド削除',
            message: 'このフレンドを削除しますか？',
            confirmText: '削除',
            cancelText: 'キャンセル',
            type: 'danger'
        });

        if (confirmed) {
            const response = await this.friendsManager.removeFriend(friendId);
            this.chatUI.uiUtils.showNotification(response.message, response.success ? 'success' : 'error');
            
            if (response.success) {
                this.updateFriendsContent();
            }
        }
    }

    // 申請承認
    async acceptRequest(requestId) {
        const response = await this.friendsManager.acceptFriendRequest(requestId);
        this.chatUI.uiUtils.showNotification(response.message, response.success ? 'success' : 'error');
        
        if (response.success) {
            this.updateFriendsContent();
        }
    }

    // 申請拒否
    async rejectRequest(requestId) {
        const response = await this.friendsManager.rejectFriendRequest(requestId);
        this.chatUI.uiUtils.showNotification(response.message, response.success ? 'success' : 'error');
        
        if (response.success) {
            this.updateFriendsContent();
        }
    }

    // 申請キャンセル
    async cancelRequest(requestId) {
        const response = await this.friendsManager.rejectFriendRequest(requestId);
        this.chatUI.uiUtils.showNotification(response.message, response.success ? 'success' : 'error');
        
        if (response.success) {
            this.updateFriendsContent();
        }
    }

    // DM削除
    async closeDM(dmId) {
        const confirmed = await this.chatUI.uiUtils.showConfirm({
            title: 'DM削除',
            message: 'このDMを削除しますか？',
            confirmText: '削除',
            cancelText: 'キャンセル'
        });

        if (confirmed) {
            // DMManager経由で削除
            const success = await this.dmManager.deleteDMChannel(dmId);
            if (success) {
                this.chatUI.uiUtils.showNotification('DMを削除しました', 'success');
                this.updateFriendsContent();
            } else {
                this.chatUI.uiUtils.showNotification('DMの削除に失敗しました', 'error');
            }
        }
    }

    // ステータステキスト取得
    getStatusText(status) {
        const statusMap = {
            'online': 'オンライン',
            'away': '離席中',
            'busy': '取り込み中',
            'invisible': 'オフライン',
            'offline': 'オフライン'
        };
        return statusMap[status] || 'オフライン';
    }
}

// グローバルに登録
window.FriendsUI = FriendsUI;
