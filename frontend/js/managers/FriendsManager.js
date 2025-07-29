// フレンド管理クラス
class FriendsManager {
    constructor() {
        this.friends = [];
        this.friendRequests = { incoming: [], outgoing: [] };
        this.apiBase = 'api/friends';
        
        console.log('FriendsManager初期化完了');
    }

    // フレンドリストを取得
    async loadFriends() {
        try {
            console.log('🔄 FriendsManager: フレンドリスト取得開始');
            
            const response = await apiClient.request('/friends', {
                method: 'GET'
            });

            console.log('📡 FriendsManager: API応答:', response);

            if (response.success) {
                this.friends = response.friends || [];
                console.log('✅ フレンドリスト読み込み成功:', this.friends.length, '人のフレンド');
                return this.friends;
            } else {
                console.error('❌ フレンドリスト読み込みエラー:', response.message);
                this.friends = [];
                return [];
            }
        } catch (error) {
            console.error('❌ フレンドリスト読み込み例外:', {
                message: error.message,
                status: error.status,
                response: error.response,
                stack: error.stack
            });
            
            // エラー時は空配列で初期化
            this.friends = [];
            
            // エラーを再スローして上位で詳細エラー処理ができるようにする
            throw error;
        }
    }

    // フレンド申請リストを取得
    async loadFriendRequests() {
        try {
            const response = await apiClient.request('/friends/requests', {
                method: 'GET'
            });

            if (response.success) {
                this.friendRequests = {
                    incoming: response.incoming || [],
                    outgoing: response.outgoing || []
                };
                console.log('✅ フレンド申請リスト読み込み成功:', this.friendRequests);
                return this.friendRequests;
            } else {
                console.error('フレンド申請リスト読み込みエラー:', response.message);
                this.friendRequests = { incoming: [], outgoing: [] };
                return this.friendRequests;
            }
        } catch (error) {
            console.error('フレンド申請リスト読み込みエラー:', error);
            this.friendRequests = { incoming: [], outgoing: [] };
            return this.friendRequests;
        }
    }

    // フレンド申請を送信
    async sendFriendRequest(userid) {
        try {
            const response = await apiClient.request('/friends/request', {
                method: 'POST',
                body: { userid: userid.trim() }
            });

            if (response.success) {
                console.log('✅ フレンド申請送信成功');
                // 申請リストを更新
                await this.loadFriendRequests();
                return { success: true, message: response.message };
            } else {
                console.error('フレンド申請送信エラー:', response.message);
                return { success: false, message: response.message };
            }
        } catch (error) {
            console.error('フレンド申請送信エラー:', error);
            return { success: false, message: 'フレンド申請の送信に失敗しました' };
        }
    }

    // フレンド申請を承認
    async acceptFriendRequest(requestId) {
        try {
            const response = await apiClient.request(`/friends/accept/${requestId}`, {
                method: 'POST'
            });

            if (response.success) {
                console.log('✅ フレンド申請承認成功');
                // フレンドリストと申請リストを更新
                await Promise.all([
                    this.loadFriends(),
                    this.loadFriendRequests()
                ]);
                return { success: true, message: response.message };
            } else {
                console.error('フレンド申請承認エラー:', response.message);
                return { success: false, message: response.message };
            }
        } catch (error) {
            console.error('フレンド申請承認エラー:', error);
            return { success: false, message: 'フレンド申請の承認に失敗しました' };
        }
    }

    // フレンド申請を拒否
    async rejectFriendRequest(requestId) {
        try {
            const response = await apiClient.request(`/friends/decline/${requestId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                console.log('✅ フレンド申請拒否成功');
                // 申請リストを更新
                await this.loadFriendRequests();
                return { success: true, message: response.message };
            } else {
                console.error('フレンド申請拒否エラー:', response.message);
                return { success: false, message: response.message };
            }
        } catch (error) {
            console.error('フレンド申請拒否エラー:', error);
            return { success: false, message: 'フレンド申請の拒否に失敗しました' };
        }
    }

    // フレンドを削除
    async removeFriend(friendId) {
        try {
            const response = await apiClient.request(`/friends/${friendId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                console.log('✅ フレンド削除成功');
                // フレンドリストを更新
                await this.loadFriends();
                return { success: true, message: response.message };
            } else {
                console.error('フレンド削除エラー:', response.message);
                return { success: false, message: response.message };
            }
        } catch (error) {
            console.error('フレンド削除エラー:', error);
            return { success: false, message: 'フレンドの削除に失敗しました' };
        }
    }

    // フレンドリストを検索
    searchFriends(query) {
        if (!query.trim()) {
            return this.friends;
        }

        const searchTerm = query.toLowerCase().trim();
        return this.friends.filter(friend => 
            friend.userid.toLowerCase().includes(searchTerm) ||
            (friend.nickname && friend.nickname.toLowerCase().includes(searchTerm))
        );
    }

    // フレンドのオンライン状態を取得
    getFriendStatus(friendId) {
        const friend = this.friends.find(f => f.friend_id === friendId);
        return friend ? friend.status || 'offline' : 'offline';
    }

    // 未読フレンド申請数を取得
    getUnreadRequestCount() {
        if (!this.friendRequests || !this.friendRequests.incoming) {
            console.warn('フレンドリクエストが初期化されていません');
            return 0;
        }
        return this.friendRequests.incoming.length;
    }
}

// グローバルに登録
window.FriendsManager = FriendsManager;
