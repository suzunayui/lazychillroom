// 通知とUI補助機能クラス
class UIUtils {
    constructor(chatUI) {
        this.chatUI = chatUI;
    }

    // HTMLエスケープ（静的メソッド）
    static escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') {
            return '';
        }
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 通知表示
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#43b581' : type === 'error' ? '#f04747' : '#7289da'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 500;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // アニメーション
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // 自動削除
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 画像モーダル表示
    showImageModal(imageElement) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('imageModalImage');
        const modalFilename = document.getElementById('imageModalFilename');
        const modalSize = document.getElementById('imageModalSize');
        
        if (!modal || !modalImage) return;
        
        // 画像情報を設定
        modalImage.src = imageElement.src;
        modalImage.alt = imageElement.alt;
        
        // ファイル名とサイズを設定
        const filename = imageElement.dataset.filename || 'image';
        const fileSize = parseInt(imageElement.dataset.fileSize) || 0;
        
        modalFilename.textContent = filename;
        modalSize.textContent = fileSize > 0 ? this.chatUI.fileUploadHandler.formatFileSize(fileSize) : '';
        
        // モーダル表示
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // イベントリスナーを一度だけ追加
        this.bindImageModalEvents();
    }

    // 画像モーダルを閉じる
    hideImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // 画像モーダルのイベントバインド
    bindImageModalEvents() {
        const modal = document.getElementById('imageModal');
        const closeBtn = document.getElementById('imageModalClose');
        const overlay = modal?.querySelector('.image-modal-overlay');
        
        if (!modal || modal.dataset.eventsbound) return;
        
        // 閉じるボタン
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideImageModal();
            });
        }
        
        // オーバーレイクリック
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.hideImageModal();
            });
        }
        
        // ESCキー
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.hideImageModal();
            }
        });
        
        // イベントが追加済みであることをマーク
        modal.dataset.eventsbound = 'true';
    }

    // ログアウト処理
    async logout() {
        let shouldLogout;
        if (window.notificationManager) {
            shouldLogout = await window.notificationManager.confirm(
                'ログアウトしますか？', 
                'ログアウト確認', 
                'ログアウト', 
                'キャンセル'
            );
        } else {
            shouldLogout = confirm('ログアウトしますか？');
        }
        
        if (shouldLogout) {
            // AuthManagerの統一されたログアウト処理を使用
            if (window.AuthManager) {
                const authManager = new window.AuthManager();
                authManager.logout();
            } else {
                // フォールバック処理
                console.log('⚠️ AuthManagerが見つかりません。フォールバックログアウト処理を実行します。');
                localStorage.removeItem('authToken');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('currentUser');
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('currentUser');
                window.location.reload();
            }
        }
    }

    // アクティブ要素の設定
    setActiveServer(serverId) {
        document.querySelectorAll('.server-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const serverItem = document.querySelector(`[data-server="${serverId}"]`);
        if (serverItem) {
            serverItem.classList.add('active');
        }
    }

    setActiveChannel(channelId) {
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const channelItem = document.querySelector(`[data-channel="${channelId}"]`);
        if (channelItem) {
            channelItem.classList.add('active');
        }
    }

    setActiveDM(dmId) {
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const dmItem = document.querySelector(`[data-dm="${dmId}"]`);
        if (dmItem) {
            dmItem.classList.add('active');
        }
    }

    // メンバーリスト管理
    showMembersList() {
        const membersSidebar = document.getElementById('membersSidebar');
        if (membersSidebar) {
            membersSidebar.style.display = 'flex';
            membersSidebar.classList.add('show');
        }
    }

    hideMembersList() {
        const membersSidebar = document.getElementById('membersSidebar');
        if (membersSidebar) {
            membersSidebar.style.display = 'none';
            membersSidebar.classList.remove('show');
        }
    }

    updateMembersList(members) {
        const onlineMembers = document.getElementById('onlineMembers');
        const offlineMembers = document.getElementById('offlineMembers');
        const membersCount = document.getElementById('membersCount');
        
        if (!onlineMembers || !offlineMembers || !membersCount) return;

        const online = members.filter(member => member.status === 'online');
        const offline = members.filter(member => member.status === 'offline');

        onlineMembers.innerHTML = UIComponents.createMemberListHTML(online, 'online');
        offlineMembers.innerHTML = UIComponents.createMemberListHTML(offline, 'offline');

        const totalMembers = members.length;
        membersCount.textContent = `メンバー - ${totalMembers}`;

        const onlineSection = document.querySelector('.members-section:first-child .section-title');
        const offlineSection = document.querySelector('.members-section:last-child .section-title');
        
        if (onlineSection) {
            onlineSection.textContent = `オンライン - ${online.length}`;
        }
        if (offlineSection) {
            offlineSection.textContent = `オフライン - ${offline.length}`;
        }
    }

    // 一時的なメッセージ追加
    addTemporaryMessage(content) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = UIComponents.createTemporaryMessage(this.chatUI.currentUser, content);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 入力ダイアログ表示
    showInput(options = {}) {
        return new Promise((resolve) => {
            const {
                title = '入力',
                message = '',
                placeholder = '',
                confirmText = 'OK',
                cancelText = 'キャンセル',
                inputType = 'text'
            } = options;

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal input-modal">
                    <div class="modal-header">
                        <h3>${UIUtils.escapeHtml(title)}</h3>
                    </div>
                    <div class="modal-body">
                        ${message ? `<p>${UIUtils.escapeHtml(message)}</p>` : ''}
                        <input type="${inputType}" class="input-field" placeholder="${UIUtils.escapeHtml(placeholder)}" autocomplete="off">
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">${UIUtils.escapeHtml(cancelText)}</button>
                        <button class="btn btn-primary confirm-btn">${UIUtils.escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const inputField = modal.querySelector('.input-field');
            const confirmBtn = modal.querySelector('.confirm-btn');
            const cancelBtn = modal.querySelector('.cancel-btn');

            // フォーカス
            setTimeout(() => inputField.focus(), 100);

            // イベントリスナー
            const cleanup = () => {
                document.body.removeChild(modal);
            };

            const handleConfirm = () => {
                const value = inputField.value.trim();
                cleanup();
                resolve(value);
            };

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);

            // Enterキーで確認
            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                }
            });

            // 背景クリックで閉じる
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            });
        });
    }

    // 確認ダイアログ表示
    showConfirm(options = {}) {
        return new Promise((resolve) => {
            const {
                title = '確認',
                message = '',
                confirmText = 'OK',
                cancelText = 'キャンセル',
                type = 'default'
            } = options;

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal confirm-modal">
                    <div class="modal-header">
                        <h3>${UIUtils.escapeHtml(title)}</h3>
                    </div>
                    <div class="modal-body">
                        <p>${UIUtils.escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">${UIUtils.escapeHtml(cancelText)}</button>
                        <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'} confirm-btn">${UIUtils.escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const confirmBtn = modal.querySelector('.confirm-btn');
            const cancelBtn = modal.querySelector('.cancel-btn');

            // イベントリスナー
            const cleanup = () => {
                document.body.removeChild(modal);
            };

            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);

            // Enterキーで確認、Escapeキーでキャンセル
            document.addEventListener('keydown', function keyHandler(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('keydown', keyHandler);
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    document.removeEventListener('keydown', keyHandler);
                    handleCancel();
                }
            });

            // 背景クリックで閉じる
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            });

            // フォーカス
            setTimeout(() => confirmBtn.focus(), 100);
        });
    }
}

// グローバルスコープに登録
window.UIUtils = UIUtils;
