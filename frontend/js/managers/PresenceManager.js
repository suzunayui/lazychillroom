// ユーザープレゼンス（オンライン状態）管理クラス
class PresenceManager {
    constructor() {
        this.apiBase = 'api/presence';
        this.currentStatus = 'online';
        this.userSetStatus = 'online'; // ユーザーが明示的に設定したステータス
        this.heartbeatInterval = null;
        this.onlineUsers = new Map(); // guildId -> users array
        this.statusChangeCallbacks = [];
    }

    // 初期化
    async init() {
        this.startHeartbeat();
        this.bindEvents();
        await this.loadCurrentStatus(); // awaitを追加
        
        // ページ非表示時にawayに変更
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // ユーザーが意図的にofflineやinvisibleに設定している場合は変更しない
                if (this.currentStatus === 'online' || this.currentStatus === 'busy') {
                    this.updateStatus('away');
                }
            } else {
                // 戻ってきたときはaway状態の場合のみ元のステータスに戻す
                if (this.currentStatus === 'away') {
                    this.updateStatus(this.userSetStatus);
                }
            }
        });

        // ウィンドウ閉じる前にofflineに変更
        window.addEventListener('beforeunload', () => {
            this.updateStatus('offline', false);
        });
    }

    // ハートビート開始（30秒間隔）
    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            try {
                await fetch(`${this.apiBase}/heartbeat`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
            } catch (error) {
                console.error('Heartbeat error:', error);
            }
        }, 30000);
    }

    // ハートビート停止
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // イベント設定
    bindEvents() {
        // ステータス変更ボタンがあれば設定
        const statusButtons = document.querySelectorAll('.status-button');
        statusButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const status = e.target.dataset.status;
                if (status) {
                    this.updateStatus(status, true, true); // ユーザーが明示的に設定
                }
            });
        });
    }

    // 現在のステータス読み込み
    async loadCurrentStatus() {
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            
            // ユーザーが設定したステータスを復元（invisibleやbusyなど）
            const savedUserStatus = currentUser.userSetStatus;
            
            // ページリロード時は基本的にオンラインに設定
            // ただし、ユーザーが明示的にinvisibleやofflineに設定していた場合は保持
            let initialStatus = 'online';
            if (savedUserStatus === 'invisible' || savedUserStatus === 'offline') {
                initialStatus = savedUserStatus;
                console.log('📥 特別なステータスを復元:', initialStatus);
            } else if (savedUserStatus && savedUserStatus !== 'away') {
                // busy等のユーザー設定ステータスは復元するが、awayは無視
                initialStatus = savedUserStatus;
                console.log('📥 ユーザー設定ステータス復元:', initialStatus);
            } else {
                console.log('🔄 ページリロード時にオンラインに設定');
            }
            
            this.userSetStatus = savedUserStatus || 'online';
            await this.updateStatus(initialStatus, true, false);
            
        } catch (error) {
            console.error('Current status load error:', error);
            // エラーが発生した場合はデフォルトでオンラインに設定
            await this.updateStatus('online', true, true);
        }
    }

    // ステータス更新
    async updateStatus(status, sendToServer = true, isUserSet = false) {
        try {
            this.currentStatus = status;
            
            // ユーザーが明示的に設定した場合は記憶
            if (isUserSet || (status !== 'away' && sendToServer)) {
                this.userSetStatus = status;
            }
            
            if (sendToServer) {
                const response = await fetch(`${this.apiBase}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ status })
                });

                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.message);
                }
            }

            // ローカルストレージ更新
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            currentUser.status = status;
            if (isUserSet) {
                currentUser.userSetStatus = status;
            }
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // UI更新
            this.updateStatusUI(status);

            // コールバック実行
            this.statusChangeCallbacks.forEach(callback => {
                try {
                    callback(status);
                } catch (error) {
                    console.error('Status change callback error:', error);
                }
            });

            console.log('✅ Status updated:', status);

        } catch (error) {
            console.error('❌ Status update error:', error);
        }
    }

    // サーバーとステータスを同期
    async syncStatusWithServer(status) {
        try {
            console.log('🔄 サーバーとステータス同期開始:', status);
            
            const response = await fetch(`${this.apiBase}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ status })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    console.log('✅ サーバーとステータス同期完了:', status);
                } else {
                    console.error('❌ ステータス同期エラー:', data.message);
                }
            } else {
                // エラーレスポンスの詳細を取得
                const errorData = await response.json().catch(() => ({ message: 'Response parsing failed' }));
                console.error('❌ ステータス同期HTTPエラー:', response.status, errorData);
            }
        } catch (error) {
            console.error('❌ ステータス同期例外:', error);
        }
    }

    // 現在のステータスをサーバーと同期
    async syncCurrentStatusWithServer() {
        if (this.currentStatus) {
            console.log('🔄 Socket接続後にステータス再同期:', this.currentStatus);
            await this.syncStatusWithServer(this.currentStatus);
        }
    }

    // ステータスUI更新
    updateStatusUI(status) {
        // ユーザー情報エリアのステータス更新
        const statusElement = document.querySelector('.user-status');
        if (statusElement) {
            statusElement.textContent = this.getStatusLabel(status);
            statusElement.className = `user-status status-${status}`;
        }

        // ステータスインジケーター更新
        const statusIndicators = document.querySelectorAll('.status-indicator');
        statusIndicators.forEach(indicator => {
            indicator.className = `status-indicator status-${status}`;
        });

        // ステータス選択ボタンの状態更新
        const statusButtons = document.querySelectorAll('.status-button');
        statusButtons.forEach(button => {
            if (button.dataset.status === status) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // オンラインユーザー取得
    async getOnlineUsers(guildId) {
        try {
            const response = await fetch(`${this.apiBase}/online/${guildId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.onlineUsers.set(guildId, data.online_users);
                return data.online_users;
            } else {
                console.error('❌ Online users fetch error:', data.message);
                return [];
            }
        } catch (error) {
            console.error('❌ Online users fetch error:', error);
            return [];
        }
    }

    // ユーザープレゼンス情報取得
    async getUserPresence(userId) {
        try {
            const response = await fetch(`${this.apiBase}/presence/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                return data.user;
            } else {
                console.error('❌ User presence fetch error:', data.message);
                return null;
            }
        } catch (error) {
            console.error('❌ User presence fetch error:', error);
            return null;
        }
    }

    // メンバーリスト更新
    updateMembersList(guildId) {
        const membersList = document.querySelector('.members-list');
        if (!membersList) return;

        const users = this.onlineUsers.get(guildId) || [];
        
        const onlineUsersHTML = users
            .filter(user => user.status !== 'offline')
            .map(user => `
                <div class="member-item" data-user-id="${user.id}">
                    <div class="member-avatar">
                        ${user.avatar_url ? 
                            `<img src="${user.avatar_url}" alt="${user.userid}">` :
                            `<span>${user.userid.charAt(0).toUpperCase()}</span>`
                        }
                        <div class="status-indicator status-${user.status}"></div>
                    </div>
                    <div class="member-info">
                        <div class="member-name">${user.userid}</div>
                        <div class="member-status">${this.getStatusLabel(user.status)}</div>
                    </div>
                </div>
            `).join('');

        membersList.innerHTML = `
            <div class="members-section">
                <div class="members-header">オンライン — ${users.filter(u => u.status !== 'offline').length}</div>
                ${onlineUsersHTML}
            </div>
        `;
    }

    // ステータス変更時のコールバック登録
    onStatusChange(callback) {
        this.statusChangeCallbacks.push(callback);
    }

    // ステータスラベル取得
    getStatusLabel(status) {
        const statusMap = {
            'online': '🟢 オンライン',
            'away': '🟡 退席中',
            'busy': '🔴 取り込み中',
            'invisible': '⚫ オフライン',
            'offline': '⚫ オフライン'
        };
        return statusMap[status] || '⚫ 不明';
    }

    // ステータス色取得
    getStatusColor(status) {
        const colorMap = {
            'online': '#43b581',
            'away': '#faa61a',
            'busy': '#f04747',
            'invisible': '#747f8d',
            'offline': '#747f8d'
        };
        return colorMap[status] || '#747f8d';
    }

    // クリーンアップ
    cleanup() {
        this.stopHeartbeat();
        this.updateStatus('offline', true);
    }
}

// グローバルスコープに登録
window.PresenceManager = PresenceManager;
