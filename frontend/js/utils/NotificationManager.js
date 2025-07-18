// 通知管理クラス
class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.notificationId = 0;
        this.init();
    }

    init() {
        // 通知コンテナを作成
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    // 通知を表示
    show(message, type = 'info', title = null, duration = 4000) {
        const id = ++this.notificationId;
        const notification = this.createNotification(id, message, type, title);
        
        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // 自動削除
        if (duration > 0) {
            setTimeout(() => {
                this.hide(id);
            }, duration);
        }

        return id;
    }

    // 成功通知
    success(message, title = '成功', duration = 3000) {
        return this.show(message, 'success', title, duration);
    }

    // エラー通知
    error(message, title = 'エラー', duration = 5000) {
        return this.show(message, 'error', title, duration);
    }

    // 警告通知
    warning(message, title = '警告', duration = 4000) {
        return this.show(message, 'warning', title, duration);
    }

    // 情報通知
    info(message, title = '情報', duration = 4000) {
        return this.show(message, 'info', title, duration);
    }

    // 通知要素を作成
    createNotification(id, message, type, title) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.notificationId = id;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const icon = icons[type] || icons.info;

        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                ${title ? `<div class="notification-title">${title}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" data-notification-id="${id}">&times;</button>
        `;

        // イベントリスナーを追加
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide(id);
            });
        }

        return notification;
    }

    // 通知を非表示
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        notification.classList.add('hiding');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications.delete(id);
        }, 300);
    }

    // 全ての通知をクリア
    clearAll() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }

    // 確認ダイアログ（通知風）
    confirm(message, title = '確認', okText = 'OK', cancelText = 'キャンセル') {
        return new Promise((resolve) => {
            const id = ++this.notificationId;
            const notification = document.createElement('div');
            notification.className = 'notification warning';
            notification.dataset.notificationId = id;

            notification.innerHTML = `
                <div class="notification-icon">❓</div>
                <div class="notification-content">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                    <div style="margin-top: 10px; display: flex; gap: 8px;">
                        <button class="confirm-btn ok-btn" style="padding: 6px 12px; background: #43b581; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">${okText}</button>
                        <button class="confirm-btn cancel-btn" style="padding: 6px 12px; background: #ed4245; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">${cancelText}</button>
                    </div>
                </div>
            `;

            const okBtn = notification.querySelector('.ok-btn');
            const cancelBtn = notification.querySelector('.cancel-btn');

            okBtn.onclick = () => {
                this.hide(id);
                resolve(true);
            };

            cancelBtn.onclick = () => {
                this.hide(id);
                resolve(false);
            };

            this.container.appendChild(notification);
            this.notifications.set(id, notification);
        });
    }
}

// グローバルインスタンス
window.NotificationManager = NotificationManager;

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    if (!window.notificationManager) {
        window.notificationManager = new NotificationManager();
    }
});
