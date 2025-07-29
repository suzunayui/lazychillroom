// 設定チャンネル管理クラス
class SettingsHandler {
    constructor(chatUI) {
        this.chatUI = chatUI;
        // グローバルアクセス用
        window.settingsHandler = this;
    }

    showSettingsChannel() {
        // メッセージ入力エリアを非表示
        const messageInputContainer = document.querySelector('.message-input-container');
        if (messageInputContainer) {
            messageInputContainer.style.display = 'none';
        }
        
        // 設定チャンネル専用UIを表示
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = this.createSettingsChannelHTML();
            // メッセージコンテナの高さを調整
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                messagesContainer.style.height = 'calc(100vh - 48px)';
                messagesContainer.style.paddingBottom = '0';
            }
        }
        
        // 設定チャンネル用のイベントリスナーを設定
        this.bindSettingsEvents();
    }
    
    createSettingsChannelHTML() {
        // ユーザー情報を複数のソースから取得
        let user = this.chatUI.currentUser || this.chatUI.chatManager.currentUser;
        
        // localStorageからも確認して最新の情報を使用
        try {
            const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (storedUser && storedUser.id) {
                // avatar_urlがlocalStorageに新しい情報があれば優先
                if (storedUser.avatar_url && (!user || !user.avatar_url)) {
                    user = { ...user, ...storedUser };
                } else if (storedUser.avatar_url) {
                    user.avatar_url = storedUser.avatar_url;
                }
            }
        } catch (error) {
            console.error('localStorageからユーザー情報を取得できませんでした:', error);
        }
        
        if (!user) {
            return '<div class="settings-channel"><p>ユーザー情報を読み込めませんでした。</p></div>';
        }
        return `
            <div class="settings-channel">
                <div class="settings-header">
                    <h2 class="settings-title">
                        <span class="settings-icon">⚙️</span>
                        プロフィール設定
                    </h2>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <span>👤</span>
                        プロフィール情報
                    </h3>
                    <div class="profile-info">
                        <div class="profile-avatar-section">
                            <div class="current-avatar" id="currentAvatar">
                                ${user.avatar_url ? 
                                    `<img src="${user.avatar_url}" alt="現在のアバター">` : 
                                    '<span class="default-avatar">👤</span>'
                                }
                            </div>
                            <div class="profile-userid">
                                ${user.avatar_url ? 
                                    `<img src="${user.avatar_url}" alt="アバター" class="userid-avatar">` : 
                                    '<span class="userid-avatar-placeholder">👤</span>'
                                }
                                <span class="userid-text">${user.userid}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <span>📸</span>
                        アバター画像
                    </h3>
                    <p class="settings-section-description">
                        プロフィール画像をアップロードして、あなたのアカウントをカスタマイズしましょう。
                    </p>
                    
                    <div class="avatar-upload-section">
                        <label class="avatar-upload-button">
                            <input type="file" id="avatarUpload" accept="image/jpeg,image/png,image/gif,image/webp">
                            📸 アバター画像をアップロード
                        </label>
                        
                        <div class="upload-progress" id="uploadProgress">
                            <div class="upload-progress-bar" id="uploadProgressBar"></div>
                        </div>
                        
                        <div class="upload-status" id="uploadStatus"></div>
                        
                        <div class="file-format-info">
                            対応形式: JPEG, PNG, GIF, WebP（最大5MB）
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <span>👥</span>
                        フレンド管理
                    </h3>
                    <p class="settings-section-description">
                        フレンドリストやフレンド申請を管理します。
                    </p>
                    <div class="friends-management">
                        <button class="settings-button" id="openFriendsView">
                            <span>👥</span>
                            フレンド管理画面を開く
                        </button>
                        <div class="friends-quick-info">
                            <p>ここからフレンドの追加、削除、フレンド申請の承認・拒否ができます。</p>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <span>ℹ️</span>
                        アカウント情報
                    </h3>
                    <div class="user-info-grid">
                        <div class="user-info-item">
                            <div class="user-info-label">ユーザー名</div>
                            <div class="user-info-value">${user.userid}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">メールアドレス</div>
                            <div class="user-info-value">${user.email || 'なし'}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">ステータス</div>
                            <div class="user-info-value status-control">
                                <div class="current-status">
                                    <span class="status-indicator status-${user.status || 'online'}"></span>
                                    <span class="status-text">${this.getStatusLabel(user.status)}</span>
                                </div>
                                <button class="status-change-btn" data-action="change-status">変更</button>
                            </div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">登録日</div>
                            <div class="user-info-value">${user.created_at ? this.formatDate(user.created_at) : 'なし'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    bindSettingsEvents() {
        // アバターアップロードのイベントリスナー
        const avatarUpload = document.getElementById('avatarUpload');
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => {
                this.handleAvatarUpload(e);
            });
        }

        // フレンド管理ボタンのイベントリスナー
        const openFriendsViewBtn = document.getElementById('openFriendsView');
        if (openFriendsViewBtn) {
            openFriendsViewBtn.addEventListener('click', () => {
                this.openFriendsManagement();
            });
        }

        // ステータス変更ボタンのイベントリスナー
        const statusChangeBtn = document.querySelector('.status-change-btn[data-action="change-status"]');
        if (statusChangeBtn) {
            statusChangeBtn.addEventListener('click', () => {
                this.showStatusModal();
            });
        }
    }
    
    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // ファイルサイズチェック
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showError('ファイルサイズが大きすぎます（最大5MB）');
            return;
        }

        // ファイル形式チェック
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('対応していないファイル形式です');
            return;
        }

        try {
            this.showProgress(0);
            this.setStatus('アップロード中...', 'uploading');

            const formData = new FormData();
            formData.append('avatar', file);

            const xhr = new XMLHttpRequest();
            
            // プログレス表示
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.showProgress(percentComplete);
                }
            });

            // 完了処理
            xhr.addEventListener('load', () => {
                console.log('users/avatar HTTPステータス:', xhr.status);
                console.log('users/avatar レスポンステキスト:', xhr.responseText);
                
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            this.handleUploadSuccess(response);
                        } else {
                            console.error('アバターアップロードエラー:', response.message);
                            this.showError(response.message || 'アップロードに失敗しました');
                        }
                    } catch (parseError) {
                        console.error('users/avatar JSONパースエラー:', parseError);
                        console.error('パース対象テキスト:', xhr.responseText);
                        this.showError('サーバーレスポンスの解析に失敗しました');
                    }
                } else {
                    console.error('users/avatar HTTPエラー:', xhr.status, xhr.statusText);
                    console.error('エラーレスポンス:', xhr.responseText);
                    
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        this.showError(errorResponse.message || `HTTPエラー: ${xhr.status}`);
                        
                        // 開発環境でのデバッグ情報表示
                        if (errorResponse.error_details) {
                            console.error('エラー詳細:', errorResponse.error_details);
                        }
                        if (errorResponse.error_file) {
                            console.error('エラーファイル:', errorResponse.error_file);
                        }
                        if (errorResponse.error_line) {
                            console.error('エラー行:', errorResponse.error_line);
                        }
                    } catch (parseError) {
                        this.showError(`HTTPエラー: ${xhr.status} - ${xhr.statusText}`);
                    }
                }
            });

            // エラー処理
            xhr.addEventListener('error', () => {
                this.showError('ネットワークエラーが発生しました');
            });

            xhr.open('POST', '/api/users/avatar');
            // Bearerトークンを設定
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
                xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
            }
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            this.showError('アップロードエラーが発生しました');
        }
    }
    
    handleUploadSuccess(response) {
        // アバター画像を更新
        const avatarElement = document.getElementById('currentAvatar');
        if (avatarElement) {
            avatarElement.innerHTML = `<img src="${response.avatar_url}?t=${Date.now()}" alt="新しいアバター">`;
            avatarElement.classList.add('upload-success-animation');
            
            // アニメーション後にクラスを削除
            setTimeout(() => {
                avatarElement.classList.remove('upload-success-animation');
            }, 600);
        }
        
        // ユーザー名横のアバターも更新（設定チャンネル内）
        const useridAvatar = document.querySelector('.userid-avatar');
        const useridAvatarPlaceholder = document.querySelector('.userid-avatar-placeholder');
        if (useridAvatarPlaceholder) {
            const newImg = document.createElement('img');
            newImg.src = response.avatar_url + '?t=' + Date.now();
            newImg.alt = 'アバター';
            newImg.className = 'userid-avatar';
            useridAvatarPlaceholder.replaceWith(newImg);
        } else if (useridAvatar) {
            useridAvatar.src = response.avatar_url + '?t=' + Date.now();
        }

        // サイドバーのアバターも更新
        this.updateSidebarAvatar(response.avatar_url);

        // ステータス表示
        this.setStatus('✅ アップロード完了！', 'success');
        this.hideProgress();

        // フォームをリセット
        const uploadInput = document.getElementById('avatarUpload');
        if (uploadInput) {
            uploadInput.value = '';
        }

        // ユーザー情報を更新
        if (this.chatUI.currentUser) {
            this.chatUI.currentUser.avatar_url = response.avatar_url;
        }
        if (this.chatUI.chatManager.currentUser) {
            this.chatUI.chatManager.currentUser.avatar_url = response.avatar_url;
        }
        
        // localStorageの currentUser も更新してリロード後も維持
        const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUserData) {
            currentUserData.avatar_url = response.avatar_url;
            localStorage.setItem('currentUser', JSON.stringify(currentUserData));
            console.log('localStorageのユーザー情報を更新しました:', currentUserData);
        }
    }

    updateSidebarAvatar(avatarUrl) {
        console.log('アバターを更新中:', avatarUrl);
        
        // 1. 左サイドバーのユーザーアバターを更新
        const sidebarAvatars = document.querySelectorAll('.user-avatar, .current-user-avatar, #useridBtn img, #useridBtn .userid-avatar');
        sidebarAvatars.forEach(avatar => {
            if (avatar.tagName === 'IMG') {
                avatar.src = avatarUrl + '?t=' + Date.now();
            } else {
                avatar.style.backgroundImage = `url(${avatarUrl}?t=${Date.now()})`;
            }
        });

        // 2. メインサイドバーの.user-avatar要素を画像に置き換え
        const userAvatar = document.querySelector('.user-info .user-avatar');
        if (userAvatar) {
            // 既存の画像があるかチェック
            const existingImg = userAvatar.querySelector('img');
            if (existingImg) {
                // 既存の画像のsrcを更新
                existingImg.src = avatarUrl + '?t=' + Date.now();
            } else {
                // spanをimgに置き換え
                userAvatar.innerHTML = `<img src="${avatarUrl}?t=${Date.now()}" alt="アバター" class="user-avatar-img">`;
            }
        }

        // 3. ユーザー名ボタン内のアバタープレースホルダーを画像に置き換え
        const useridBtn = document.getElementById('useridBtn');
        if (useridBtn) {
            const avatarPlaceholder = useridBtn.querySelector('.userid-avatar-placeholder');
            if (avatarPlaceholder) {
                const newImg = document.createElement('img');
                newImg.src = avatarUrl + '?t=' + Date.now();
                newImg.alt = 'アバター';
                newImg.className = 'userid-avatar';
                avatarPlaceholder.replaceWith(newImg);
            }
            
            // 既存のアバター画像があれば更新
            const existingAvatar = useridBtn.querySelector('.userid-avatar, img');
            if (existingAvatar && existingAvatar.tagName === 'IMG') {
                existingAvatar.src = avatarUrl + '?t=' + Date.now();
            }
        }

        // 4. メッセージエリアのアバター（中央部分）を更新 - 自分のメッセージのみ
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUser && currentUser.id) {
            const messageAvatars = document.querySelectorAll('.message-avatar img[src*="avatar"]');
            messageAvatars.forEach(avatar => {
                // 自分のユーザーIDを含むアバターのみ更新
                if (avatar.src.includes(`avatar_${currentUser.id}_`)) {
                    avatar.src = avatarUrl + '?t=' + Date.now();
                    console.log('✓ 自分のメッセージアバターを更新:', avatar.src);
                }
            });
        }

        // 5. 右サイドバーのアバター（オンラインユーザーリスト等）を更新
        const rightSidebarAvatars = document.querySelectorAll('.member-avatar, .online-user-avatar, .user-list img, .sidebar-right img[src*="avatar"]');
        rightSidebarAvatars.forEach(avatar => {
            if (avatar.tagName === 'IMG') {
                // 自分のアバターかチェック
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (currentUser && (avatar.alt === currentUser.userid || avatar.dataset.userId === currentUser.id)) {
                    avatar.src = avatarUrl + '?t=' + Date.now();
                }
            }
        });

        // 6. 全般的なアバター更新（汎用的なセレクター） - 自分のアバターのみ
        const currentUser2 = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUser2 && currentUser2.id) {
            const allAvatars = document.querySelectorAll('[class*="avatar"], [data-avatar], img[alt*="アバター"], img[alt*="avatar"]');
            allAvatars.forEach(avatar => {
                if (avatar.tagName === 'IMG' && avatar.src && avatar.src.includes(`avatar_${currentUser2.id}_`)) {
                    avatar.src = avatarUrl + '?t=' + Date.now();
                    console.log('✓ 汎用アバター更新:', avatar.src);
                }
            });
        }

        // 7. React/Dynamic content のための追加チェック - 自分のアバターのみ
        setTimeout(() => {
            // 少し遅延してから再度チェック（動的コンテンツ対応）
            const currentUser3 = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (currentUser3 && currentUser3.id) {
                const dynamicAvatars = document.querySelectorAll('img[src*="avatar"], [style*="avatar"]');
                dynamicAvatars.forEach(avatar => {
                    if (avatar.tagName === 'IMG' && avatar.src.includes(`avatar_${currentUser3.id}_`)) {
                        avatar.src = avatarUrl + '?t=' + Date.now();
                        console.log('✓ 遅延アバター更新:', avatar.src);
                    }
                });
            }
        }, 500);
        
        console.log('アバター更新完了 - 全ての箇所を更新しました');
    }

    showProgress(percent) {
        const progressContainer = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('uploadProgressBar');
        
        if (progressContainer && progressBar) {
            progressContainer.style.display = 'block';
            progressBar.style.width = percent + '%';
        }
    }

    hideProgress() {
        const progressContainer = document.getElementById('uploadProgress');
        if (progressContainer) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 1000);
        }
    }

    setStatus(message, type = '') {
        const statusElement = document.getElementById('uploadStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = 'upload-status ' + type;
        }
    }

    showError(message) {
        this.setStatus('❌ ' + message, 'error');
        this.hideProgress();
    }

    // フレンド管理画面を開く
    async openFriendsManagement() {
        try {
            console.log('🔄 フレンド管理画面を開いています...');
            
            // 設定画面を閉じて通常のチャット画面に戻る
            this.chatUI.isDMMode = false;
            
            // メッセージ入力エリアを表示
            const messageInputContainer = document.querySelector('.message-input-container');
            if (messageInputContainer) {
                messageInputContainer.style.display = 'flex';
            }
            
            // メッセージコンテナの高さを通常に戻す
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                messagesContainer.style.height = '';
                messagesContainer.style.paddingBottom = '';
            }
            
            // フレンド画面を表示
            if (this.chatUI.showFriendsView) {
                await this.chatUI.showFriendsView();
            } else {
                this.chatUI.uiUtils.showNotification('フレンド管理機能を初期化中です...', 'info');
                
                // 少し待ってからリトライ
                setTimeout(async () => {
                    if (this.chatUI.showFriendsView) {
                        await this.chatUI.showFriendsView();
                    } else {
                        console.error('フレンド管理機能が利用できません');
                        this.chatUI.uiUtils.showNotification('フレンド管理機能が利用できません', 'error');
                    }
                }, 1000);
            }
            
        } catch (error) {
            console.error('フレンド管理画面表示エラー:', error);
            this.chatUI.uiUtils.showNotification('フレンド管理画面の表示に失敗しました', 'error');
        }
    }

    getStatusLabel(status) {
        const statusMap = {
            'online': '🟢 オンライン',
            'away': '🟡 退席中',
            'busy': '🔴 取り込み中',
            'invisible': '⚫ オフライン表示',
            'offline': '⚫ オフライン'
        };
        return statusMap[status] || '⚫ 不明';
    }

    formatDate(dateString) {
        if (!dateString) return 'なし';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return 'なし';
        }
    }

    // 初期化後にアバターを更新
    updateInitialAvatar() {
        console.log('初期アバター設定を開始...');
        
        // ChatUIのcurrentUserから取得を試行
        let avatarUrl = null;
        if (this.chatUI.currentUser && this.chatUI.currentUser.avatar_url) {
            avatarUrl = this.chatUI.currentUser.avatar_url;
            console.log('ChatUI.currentUserからアバターURL取得:', avatarUrl);
        }
        
        // localStorageからも確認
        if (!avatarUrl) {
            try {
                const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (storedUser && storedUser.avatar_url) {
                    avatarUrl = storedUser.avatar_url;
                    console.log('localStorageからアバターURL取得:', avatarUrl);
                    
                    // ChatUIのcurrentUserも更新
                    if (this.chatUI.currentUser) {
                        this.chatUI.currentUser.avatar_url = avatarUrl;
                    }
                    if (this.chatUI.chatManager && this.chatUI.chatManager.currentUser) {
                        this.chatUI.chatManager.currentUser.avatar_url = avatarUrl;
                    }
                }
            } catch (error) {
                console.error('localStorageからユーザー情報を取得できませんでした:', error);
            }
        }
        
        if (avatarUrl) {
            console.log('初期アバターを設定中:', avatarUrl);
            this.updateSidebarAvatar(avatarUrl);
            
            // 遅延実行で動的コンテンツにも対応
            setTimeout(() => {
                console.log('遅延アバター更新実行中...');
                this.updateSidebarAvatar(avatarUrl);
            }, 1000);
            
            // さらに遅延実行（React等の動的コンテンツ対応）
            setTimeout(() => {
                console.log('最終アバター更新実行中...');
                this.updateSidebarAvatar(avatarUrl);
            }, 3000);
        } else {
            console.log('アバター情報が見つかりませんでした');
        }
    }

    // 招待リンク管理機能を追加
    async showInviteManager(guildId) {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="loading">招待リンクを読み込み中...</div>';
            
            try {
                const invites = await this.loadInvites(guildId);
                chatMessages.innerHTML = this.createInviteManagerHTML(invites, guildId);
                this.bindInviteEvents(guildId);
            } catch (error) {
                console.error('招待リンクの読み込みエラー:', error);
                chatMessages.innerHTML = '<div class="error">招待リンクの読み込みに失敗しました。</div>';
            }
        }
    }
    
    async loadInvites(guildId) {
        const response = await fetch(`api/guilds/${guildId}/invites`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        if (data.success) {
            return data.invites;
        } else {
            throw new Error(data.message);
        }
    }
    
    createInviteManagerHTML(invites, guildId) {
        return `
            <div class="settings-channel invite-manager">
                <div class="settings-header">
                    <h2>🔗 招待リンク管理</h2>
                    <p class="settings-description">サーバーに他のユーザーを招待するためのリンクを管理できます。</p>
                </div>
                
                <div class="invite-create-section">
                    <h3>新しい招待リンクを作成</h3>
                    <div class="invite-form">
                        <div class="form-group">
                            <label>有効期限</label>
                            <select id="inviteMaxAge">
                                <option value="0">無期限</option>
                                <option value="1800">30分</option>
                                <option value="3600">1時間</option>
                                <option value="21600">6時間</option>
                                <option value="43200">12時間</option>
                                <option value="86400">1日</option>
                                <option value="604800">7日</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>使用回数制限</label>
                            <select id="inviteMaxUses">
                                <option value="0">無制限</option>
                                <option value="1">1回</option>
                                <option value="5">5回</option>
                                <option value="10">10回</option>
                                <option value="25">25回</option>
                                <option value="50">50回</option>
                                <option value="100">100回</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="inviteTemporary">
                                一時的なメンバーシップ
                            </label>
                            <small>チェックするとユーザーがオフラインになった時に自動的にサーバーから退出します</small>
                        </div>
                        <button id="createInviteBtn" class="btn btn-primary">招待リンクを作成</button>
                    </div>
                </div>
                
                <div class="invite-list-section">
                    <h3>既存の招待リンク</h3>
                    <div class="invite-list">
                        ${this.createInviteListHTML(invites)}
                    </div>
                </div>
            </div>
        `;
    }
    
    createInviteListHTML(invites) {
        if (!invites || invites.length === 0) {
            return '<div class="no-invites">招待リンクがありません。</div>';
        }
        
        return invites.map(invite => {
            const expiresText = invite.expires_at 
                ? `${new Date(invite.expires_at).toLocaleString()}まで`
                : '無期限';
            
            const usesText = invite.max_uses > 0 
                ? `${invite.uses}/${invite.max_uses}回使用`
                : `${invite.uses}回使用`;
                
            return `
                <div class="invite-item" data-invite-id="${invite.id}">
                    <div class="invite-info">
                        <div class="invite-code-section">
                            <span class="invite-url">${invite.url}</span>
                            <button class="copy-btn" data-url="${invite.url}">📋 コピー</button>
                        </div>
                        <div class="invite-details">
                            <span class="invite-detail">作成者: ${invite.inviter_name}</span>
                            <span class="invite-detail">有効期限: ${expiresText}</span>
                            <span class="invite-detail">${usesText}</span>
                            ${invite.channel_name ? `<span class="invite-detail">チャンネル: #${invite.channel_name}</span>` : ''}
                            <span class="invite-detail">作成日時: ${new Date(invite.created_at).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="invite-actions">
                        <button class="delete-invite-btn" data-invite-id="${invite.id}">🗑️ 削除</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    bindInviteEvents(guildId) {
        // 招待リンク作成ボタン
        const createBtn = document.getElementById('createInviteBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createInvite(guildId));
        }
        
        // コピーボタン
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.target.dataset.url;
                this.copyToClipboard(url);
            });
        });
        
        // 削除ボタン
        document.querySelectorAll('.delete-invite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inviteId = e.target.dataset.inviteId;
                this.deleteInvite(inviteId, guildId);
            });
        });
    }
    
    async createInvite(guildId) {
        const maxAge = parseInt(document.getElementById('inviteMaxAge').value);
        const maxUses = parseInt(document.getElementById('inviteMaxUses').value);
        const temporary = document.getElementById('inviteTemporary').checked;
        
        // デバッグ: 認証トークンの状況を確認
        const authToken = localStorage.getItem('authToken');
        console.log('認証トークン確認:', authToken ? 'トークンあり' : 'トークンなし');
        console.log('ギルドID:', guildId);
        console.log('送信データ:', { guild_id: guildId, max_age: maxAge, max_uses: maxUses, temporary: temporary });
        
        if (!authToken) {
            this.chatUI.uiUtils.showNotification('認証トークンが見つかりません。再ログインしてください。', 'error');
            return;
        }
        
        try {
            const response = await fetch('api/guilds/invites', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    guild_id: guildId,
                    max_age: maxAge,
                    max_uses: maxUses,
                    temporary: temporary
                })
            });
            
            console.log('APIレスポンス:', response.status, response.statusText);
            
            let data;
            const responseText = await response.text();
            console.log('生のレスポンス:', responseText);
            
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON パースエラー:', parseError);
                console.error('レスポンステキスト:', responseText);
                throw new Error(`サーバーから無効なレスポンスが返されました: ${responseText.substring(0, 200)}`);
            }
            
            console.log('パース後データ:', data);
            
            if (data.success) {
                this.chatUI.uiUtils.showNotification('招待リンクが作成されました！', 'success');
                // リストを再読み込み
                this.showInviteManager(guildId);
            } else {
                console.error('API エラー:', data);
                throw new Error(data.message || `HTTPステータス: ${response.status}`);
            }
        } catch (error) {
            console.error('招待リンク作成エラー:', error);
            this.chatUI.uiUtils.showNotification(`招待リンクの作成に失敗しました: ${error.message}`, 'error');
        }
    }
    
    async deleteInvite(inviteId, guildId) {
        let shouldDelete;
        if (window.notificationManager) {
            shouldDelete = await window.notificationManager.confirm(
                'この招待リンクを削除しますか？', 
                '招待リンク削除の確認', 
                '削除', 
                'キャンセル'
            );
        } else {
            shouldDelete = confirm('この招待リンクを削除しますか？');
        }
        
        if (!shouldDelete) {
            return;
        }
        
        try {
            const response = await fetch('api/guilds/invites', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    invite_id: inviteId
                })
            });
            
            const data = await response.json();
            if (data.success) {
                this.chatUI.uiUtils.showNotification('招待リンクが削除されました', 'success');
                // リストを再読み込み
                this.showInviteManager(guildId);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('招待リンク削除エラー:', error);
            this.chatUI.uiUtils.showNotification('招待リンクの削除に失敗しました', 'error');
        }
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.chatUI.uiUtils.showNotification('URLをクリップボードにコピーしました！', 'success');
            });
        } else {
            // フォールバック
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.chatUI.uiUtils.showNotification('URLをクリップボードにコピーしました！', 'success');
        }
    }

    // ロール管理機能を表示
    async showRoleManager(guildId) {
        try {
            const response = await fetch(`api/guilds/${guildId}/roles`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            if (data.success) {
                const chatMessages = document.getElementById('chatMessages');
                chatMessages.innerHTML = this.createRoleManagerHTML(data.roles, guildId);
                this.bindRoleManagerEvents(guildId);
            } else {
                this.chatUI.uiUtils.showNotification('ロール一覧の取得に失敗しました', 'error');
            }
        } catch (error) {
            console.error('ロール一覧取得エラー:', error);
            this.chatUI.uiUtils.showNotification('ロール一覧の取得に失敗しました', 'error');
        }
    }
    
    createRoleManagerHTML(roles, guildId) {
        return `
            <div class="role-manager">
                <div class="role-manager-header">
                    <h2>🎭 ロール管理</h2>
                    <p>サーバーのロールを管理できます</p>
                </div>
                
                <div class="role-creation-section">
                    <h3>新しいロールを作成</h3>
                    <div class="role-form">
                        <div class="form-group">
                            <label for="roleNameInput">ロール名</label>
                            <input type="text" id="roleNameInput" placeholder="新しいロール" maxlength="100">
                        </div>
                        <div class="form-group">
                            <label for="roleColorInput">色</label>
                            <input type="color" id="roleColorInput" value="#99aab5">
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="roleHoistInput">
                                メンバーリストに分けて表示
                            </label>
                            <label>
                                <input type="checkbox" id="roleMentionableInput">
                                メンション可能
                            </label>
                        </div>
                        <div class="form-group">
                            <label for="rolePermissionsInput">権限値</label>
                            <input type="number" id="rolePermissionsInput" value="0" min="0">
                            <small>権限の数値（0 = 権限なし）</small>
                        </div>
                        <button id="createRoleBtn" class="btn btn-primary">ロールを作成</button>
                    </div>
                </div>
                
                <div class="roles-list-section">
                    <h3>既存のロール</h3>
                    <div class="roles-list">
                        ${this.createRoleListHTML(roles)}
                    </div>
                </div>
            </div>
        `;
    }
    
    createRoleListHTML(roles) {
        if (!roles || roles.length === 0) {
            return '<p class="no-roles">ロールがありません</p>';
        }
        
        return roles.map(role => `
            <div class="role-item" data-role-id="${role.id}">
                <div class="role-info">
                    <div class="role-header">
                        <span class="role-color" style="background-color: ${role.color}"></span>
                        <span class="role-name">${this.escapeHtml(role.name)}</span>
                        ${role.is_default ? '<span class="role-badge default">デフォルト</span>' : ''}
                        ${role.hoist ? '<span class="role-badge hoist">分離表示</span>' : ''}
                        ${role.mentionable ? '<span class="role-badge mentionable">メンション可</span>' : ''}
                    </div>
                    <div class="role-details">
                        <span>権限値: ${role.permissions}</span>
                        <span>メンバー数: ${role.member_count}</span>
                        <span>作成日: ${new Date(role.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                </div>
                <div class="role-actions">
                    <button class="btn btn-secondary edit-role-btn" data-role-id="${role.id}">
                        編集
                    </button>
                    ${!role.is_default ? `
                        <button class="btn btn-danger delete-role-btn" data-role-id="${role.id}">
                            削除
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }
    
    bindRoleManagerEvents(guildId) {
        // ロール作成ボタン
        const createBtn = document.getElementById('createRoleBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createRole(guildId));
        }
        
        // ロール編集ボタン
        document.querySelectorAll('.edit-role-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roleId = e.target.getAttribute('data-role-id');
                this.showRoleEditModal(roleId, guildId);
            });
        });
        
        // ロール削除ボタン
        document.querySelectorAll('.delete-role-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roleId = e.target.getAttribute('data-role-id');
                this.deleteRole(roleId, guildId);
            });
        });
    }
    
    async createRole(guildId) {
        const name = document.getElementById('roleNameInput').value.trim();
        const color = document.getElementById('roleColorInput').value;
        const permissions = parseInt(document.getElementById('rolePermissionsInput').value) || 0;
        const hoist = document.getElementById('roleHoistInput').checked;
        const mentionable = document.getElementById('roleMentionableInput').checked;
        
        if (!name) {
            this.chatUI.uiUtils.showNotification('ロール名を入力してください', 'error');
            return;
        }
        
        try {
            const response = await fetch('api/guilds/roles', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    guild_id: guildId,
                    name: name,
                    color: color,
                    permissions: permissions,
                    hoist: hoist,
                    mentionable: mentionable
                })
            });
            
            const data = await response.json();
            if (data.success) {
                this.chatUI.uiUtils.showNotification('ロールが作成されました！', 'success');
                // リストを再読み込み
                this.showRoleManager(guildId);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('ロール作成エラー:', error);
            this.chatUI.uiUtils.showNotification(`ロールの作成に失敗しました: ${error.message}`, 'error');
        }
    }
    
    showRoleEditModal(roleId, guildId) {
        // 既存のロール情報を取得
        const roleItem = document.querySelector(`[data-role-id="${roleId}"]`);
        if (!roleItem) return;
        
        const roleName = roleItem.querySelector('.role-name').textContent;
        const roleColor = roleItem.querySelector('.role-color').style.backgroundColor;
        
        // モーダルを作成
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal role-edit-modal">
                <div class="modal-header">
                    <h3>ロール編集: ${this.escapeHtml(roleName)}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="editRoleName">ロール名</label>
                        <input type="text" id="editRoleName" value="${this.escapeHtml(roleName)}" maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="editRoleColor">色</label>
                        <input type="color" id="editRoleColor" value="#99aab5">
                    </div>
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="editRoleHoist">
                            メンバーリストに分けて表示
                        </label>
                        <label>
                            <input type="checkbox" id="editRoleMentionable">
                            メンション可能
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="editRolePermissions">権限値</label>
                        <input type="number" id="editRolePermissions" value="0" min="0">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">キャンセル</button>
                    <button class="btn btn-primary save-role-btn">保存</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // イベントリスナー設定
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.save-role-btn').addEventListener('click', () => {
            this.updateRole(roleId, guildId, modal);
        });
        
        // モーダル外クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    async updateRole(roleId, guildId, modal) {
        const name = modal.querySelector('#editRoleName').value.trim();
        const color = modal.querySelector('#editRoleColor').value;
        const permissions = parseInt(modal.querySelector('#editRolePermissions').value) || 0;
        const hoist = modal.querySelector('#editRoleHoist').checked;
        const mentionable = modal.querySelector('#editRoleMentionable').checked;
        
        if (!name) {
            this.chatUI.uiUtils.showNotification('ロール名を入力してください', 'error');
            return;
        }
        
        try {
            const response = await fetch('api/guilds/roles', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role_id: roleId,
                    name: name,
                    color: color,
                    permissions: permissions,
                    hoist: hoist,
                    mentionable: mentionable
                })
            });
            
            const data = await response.json();
            if (data.success) {
                this.chatUI.uiUtils.showNotification('ロールが更新されました！', 'success');
                document.body.removeChild(modal);
                // リストを再読み込み
                this.showRoleManager(guildId);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('ロール更新エラー:', error);
            this.chatUI.uiUtils.showNotification(`ロールの更新に失敗しました: ${error.message}`, 'error');
        }
    }
    
    async deleteRole(roleId, guildId) {
        let shouldDelete;
        if (window.notificationManager) {
            shouldDelete = await window.notificationManager.confirm(
                'このロールを削除しますか？削除すると、このロールを持つ全てのメンバーからロールが取り除かれます。', 
                'ロール削除の確認', 
                '削除', 
                'キャンセル'
            );
        } else {
            shouldDelete = confirm('このロールを削除しますか？\n削除すると、このロールを持つ全てのメンバーからロールが取り除かれます。');
        }
        
        if (!shouldDelete) {
            return;
        }
        
        try {
            const response = await fetch('api/guilds/roles', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role_id: roleId
                })
            });
            
            const data = await response.json();
            if (data.success) {
                this.chatUI.uiUtils.showNotification('ロールが削除されました', 'success');
                // リストを再読み込み
                this.showRoleManager(guildId);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('ロール削除エラー:', error);
            this.chatUI.uiUtils.showNotification(`ロールの削除に失敗しました: ${error.message}`, 'error');
        }
    }

    // ステータス変更モーダルを表示
    showStatusModal() {
        // 既存のモーダルを削除
        const existingModal = document.getElementById('statusModal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        const modal = document.createElement('div');
        modal.id = 'statusModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content status-modal">
                <div class="modal-header">
                    <h2>ステータス変更</h2>
                    <button class="modal-close" data-action="close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="status-options">
                        <div class="status-option" data-status="online">
                            <div class="status-indicator status-online"></div>
                            <div class="status-info">
                                <div class="status-name">オンライン</div>
                                <div class="status-description">アクティブであることを表示</div>
                            </div>
                        </div>
                        <div class="status-option" data-status="away">
                            <div class="status-indicator status-away"></div>
                            <div class="status-info">
                                <div class="status-name">退席中</div>
                                <div class="status-description">しばらく離席していることを表示</div>
                            </div>
                        </div>
                        <div class="status-option" data-status="busy">
                            <div class="status-indicator status-busy"></div>
                            <div class="status-info">
                                <div class="status-name">取り込み中</div>
                                <div class="status-description">忙しく、邪魔されたくないことを表示</div>
                            </div>
                        </div>
                        <div class="status-option" data-status="invisible">
                            <div class="status-indicator status-invisible"></div>
                            <div class="status-info">
                                <div class="status-name">オフライン表示</div>
                                <div class="status-description">他のユーザーにはオフラインとして表示</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" data-action="close-modal">キャンセル</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.bindStatusModalEvents();
    }

    // ステータスモーダルのイベントを設定
    bindStatusModalEvents() {
        // ステータス選択オプション
        const statusOptions = document.querySelectorAll('.status-option');
        statusOptions.forEach(option => {
            option.addEventListener('click', async () => {
                const status = option.dataset.status;
                await this.changeUserStatus(status);
                document.getElementById('statusModal').remove();
            });
        });

        // モーダルを閉じるボタン
        const closeButtons = document.querySelectorAll('[data-action="close-modal"]');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                document.getElementById('statusModal').remove();
            });
        });

        // モーダルの背景クリックで閉じる
        const modal = document.getElementById('statusModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    }

    // ユーザーステータス変更
    async changeUserStatus(status) {
        try {
            console.log('🔄 ステータス変更開始:', status);
            
            // 認証トークンの確認
            const authToken = localStorage.getItem('authToken');
            console.log('🔑 認証トークン:', authToken ? 'あり' : 'なし');
            
            if (!authToken) {
                throw new Error('認証トークンが見つかりません。再ログインしてください。');
            }
            
            // PresenceManagerが利用可能な場合は使用
            if (window.presenceManager) {
                console.log('✅ PresenceManagerを使用');
                await window.presenceManager.updateStatus(status, true, true);
            } else {
                console.log('⚠️ PresenceManagerが利用できません、直接APIを呼び出し');
                // 直接APIを呼び出し
                const response = await fetch('/api/presence/status', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ status })
                });

                console.log('🌐 API レスポンス状態:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ APIレスポンスエラー:', response.status, errorText);
                    throw new Error(`HTTPエラー: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                console.log('📄 API レスポンスデータ:', data);
                
                if (!data.success) {
                    throw new Error(data.message || 'ステータスの更新に失敗しました');
                }

                // ローカルストレージ更新
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                currentUser.status = status;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }

            // 設定画面のステータス表示を更新
            this.updateStatusDisplay(status);
            this.chatUI.uiUtils.showNotification('ステータスを更新しました', 'success');
            console.log('✅ ステータス変更完了');

        } catch (error) {
            console.error('❌ ステータス変更エラー詳細:', error);
            console.error('エラースタック:', error.stack);
            this.chatUI.uiUtils.showNotification(`ステータスの変更に失敗しました: ${error.message}`, 'error');
        }
    }

    // 設定画面のステータス表示を更新
    updateStatusDisplay(status) {
        const statusIndicator = document.querySelector('.current-status .status-indicator');
        const statusText = document.querySelector('.current-status .status-text');
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator status-${status}`;
        }
        
        if (statusText) {
            statusText.textContent = this.getStatusLabel(status);
        }
    }

    // HTMLエスケープ関数（UIUtilsのラッパー）
    escapeHtml(unsafe) {
        return UIUtils.escapeHtml(unsafe);
    }
}

// グローバルスコープに登録
window.SettingsHandler = SettingsHandler;
