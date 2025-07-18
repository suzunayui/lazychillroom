/**
 * 設定チャンネル機能
 */

class SettingsChannel {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        try {
            await this.loadUserInfo();
            this.setupEventListeners();
        } catch (error) {
            console.error('Settings channel initialization failed:', error);
        }
    }

    async loadUserInfo() {
        try {
            const response = await fetch('/api/users/profile');
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
                this.renderSettingsUI();
            } else {
                throw new Error(data.error || 'ユーザー情報の取得に失敗しました');
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
            this.showError('ユーザー情報の読み込みに失敗しました');
        }
    }

    renderSettingsUI() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        const settingsHTML = `
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
                        アバター画像
                    </h3>
                    <p class="settings-section-description">
                        プロフィール画像をアップロードして、あなたのアカウントをカスタマイズしましょう。
                    </p>
                    
                    <div class="profile-settings">
                        <div class="avatar-upload-section">
                            <div class="current-avatar" id="currentAvatar">
                                ${this.currentUser.avatar_url ? 
                                    `<img src="${this.currentUser.avatar_url}" alt="現在のアバター">` : 
                                    '📷'
                                }
                            </div>
                            
                            <label class="avatar-upload-button">
                                <input type="file" id="avatarUpload" accept="image/jpeg,image/png,image/gif,image/webp">
                                📸 画像をアップロード
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
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <span>ℹ️</span>
                        アカウント情報
                    </h3>
                    <p class="settings-section-description">
                        あなたのアカウントの基本情報です。
                    </p>
                    
                    <div class="user-info-grid">
                        <div class="user-info-item">
                            <div class="user-info-label">ユーザー名</div>
                            <div class="user-info-value">${this.currentUser.userid}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">表示名</div>
                            <div class="user-info-value">${this.currentUser.display_name || 'なし'}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">ステータス</div>
                            <div class="user-info-value">${this.getStatusLabel(this.currentUser.status)}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">登録日</div>
                            <div class="user-info-value">${this.formatDate(this.currentUser.created_at)}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">最終更新</div>
                            <div class="user-info-value">${this.formatDate(this.currentUser.updated_at)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        messagesContainer.innerHTML = settingsHTML;
    }

    setupEventListeners() {
        // アバターアップロードのイベントリスナーは動的に追加されるため、
        // イベント委譲を使用
        document.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'avatarUpload') {
                this.handleAvatarUpload(e);
            }
        });
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
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        this.handleUploadSuccess(response);
                    } else {
                        this.showError(response.error || 'アップロードに失敗しました');
                    }
                } catch (error) {
                    this.showError('レスポンスの解析に失敗しました');
                }
            });

            // エラー処理
            xhr.addEventListener('error', () => {
                this.showError('ネットワークエラーが発生しました');
            });

            xhr.open('POST', '/api/users/avatar');
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
        this.currentUser.avatar_url = response.avatar_url;
        
        // localStorageの currentUser も更新してリロード後も維持
        const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUserData) {
            currentUserData.avatar_url = response.avatar_url;
            localStorage.setItem('currentUser', JSON.stringify(currentUserData));
            console.log('localStorageのユーザー情報を更新しました:', currentUserData);
        }
    }

    updateSidebarAvatar(avatarUrl) {
        // サイドバーのユーザーアバターを更新
        const sidebarAvatars = document.querySelectorAll('.user-avatar, .current-user-avatar');
        sidebarAvatars.forEach(avatar => {
            if (avatar.tagName === 'IMG') {
                avatar.src = avatarUrl + '?t=' + Date.now();
            } else {
                avatar.style.backgroundImage = `url(${avatarUrl}?t=${Date.now()})`;
            }
        });
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

    getStatusLabel(status) {
        const statusMap = {
            'online': '🟢 オンライン',
            'away': '🟡 退席中',
            'busy': '🔴 取り込み中',
            'offline': '⚫ オフライン'
        };
        return statusMap[status] || '⚫ 不明';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// チャンネル切り替え時の処理を拡張
function extendChannelSwitching() {
    const originalSwitchChannel = window.switchChannel;
    
    window.switchChannel = function(channelId, channelName) {
        // 元の関数を実行
        if (originalSwitchChannel) {
            originalSwitchChannel(channelId, channelName);
        }
        
        // 設定チャンネルの場合、特別な処理を実行
        if (channelName === '設定') {
            // メッセージ入力エリアを非表示
            const messageInputContainer = document.querySelector('.message-input-container');
            if (messageInputContainer) {
                messageInputContainer.style.display = 'none';
            }
            
            // 設定チャンネルのUIを初期化
            const settingsChannel = new SettingsChannel();
        } else {
            // 他のチャンネルの場合、メッセージ入力エリアを表示
            const messageInputContainer = document.querySelector('.message-input-container');
            if (messageInputContainer) {
                messageInputContainer.style.display = 'flex';
            }
        }
    };
}

// DOM読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', () => {
    extendChannelSwitching();
});

// エクスポート
window.SettingsChannel = SettingsChannel;
