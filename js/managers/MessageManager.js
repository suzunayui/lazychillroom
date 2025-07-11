// メッセージ関連の機能管理クラス
class MessageManager {
    constructor() {
        this.apiBase = 'api';
        this.messages = new Map(); // チャンネルIDをキーとしたメッセージ配列のマップ
    }

    async loadMessages(channelId, limit = 50, before = null) {
        try {
            let url = `${this.apiBase}/messages.php?channel_id=${channelId}&limit=${limit}`;
            if (before) {
                url += `&before=${before}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.messages.set(channelId, data.messages);
                return data.messages;
            } else {
                console.error('メッセージ読み込みエラー:', data.message);
                return [];
            }
        } catch (error) {
            console.error('メッセージ読み込みエラー:', error);
            return [];
        }
    }

    async sendMessage(channelId, content, type = 'text') {
        try {
            const response = await fetch(`${this.apiBase}/messages.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    channel_id: channelId,
                    content: content,
                    type: type
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // ローカルメッセージリストに追加
                if (!this.messages.has(channelId)) {
                    this.messages.set(channelId, []);
                }
                this.messages.get(channelId).push(data.message);
                
                return { success: true, message: data.message };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            console.error('メッセージ送信エラー:', error);
            return { success: false, error: 'ネットワークエラーが発生しました' };
        }
    }

    async uploadFile(file, channelId, content = '') {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('channel_id', channelId);
            formData.append('content', content);

            const response = await fetch(`${this.apiBase}/upload.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                // ローカルメッセージリストに追加
                if (!this.messages.has(channelId)) {
                    this.messages.set(channelId, []);
                }
                this.messages.get(channelId).push(data.message);
                
                return { success: true, message: data.message, fileInfo: data.file_info };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            console.error('ファイルアップロードエラー:', error);
            return { success: false, error: 'ファイルアップロードに失敗しました' };
        }
    }

    renderMessage(message, currentChannel = null) {
        const timestamp = TimeUtils.formatTimestamp(message.created_at);
        const isImage = message.type === 'image';
        const isFile = message.type === 'file';
        const isUploaderChannel = currentChannel && (currentChannel.type === 'uploader_public' || currentChannel.type === 'uploader_private');
        
        // デバッグ情報（開発時のみ）
        if (isUploaderChannel && (isImage || isFile)) {
            console.log('Message render debug:', {
                messageId: message.id,
                messageType: message.type,
                fileUrl: message.file_url,
                fileName: message.file_name,
                channelType: currentChannel?.type,
                isImage,
                isFile
            });
        }
        
        let contentHTML = '';
        let messageTypeIndicator = '';
        
        // アップローダーチャンネルでのメッセージタイプ表示
        if (isUploaderChannel) {
            if (isImage) {
                messageTypeIndicator = '<div class="message-type-indicator">画像ファイル</div>';
            } else if (isFile) {
                messageTypeIndicator = '<div class="message-type-indicator">ファイル</div>';
            } else {
                messageTypeIndicator = '<div class="message-type-indicator">メモ</div>';
            }
        }
        
        if (isImage) {
            const copyButtonHTML = isUploaderChannel && currentChannel.type === 'uploader_public' ? 
                `<button class="copy-url-btn" data-url="${message.file_url}" title="URLをコピー">📋 URLをコピー</button>` : '';
            
            // 画像URLの修正 - 相対パスの場合は絶対パスに変換
            let imageUrl = message.file_url;
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
            }
            
            contentHTML = `
                ${messageTypeIndicator}
                <div class="message-text">${message.content}</div>
                <div class="message-attachment">
                    <img src="${imageUrl}" 
                         alt="画像" 
                         class="message-image clickable-image"
                         data-filename="${message.file_name || 'image'}"
                         data-file-size="${message.file_size || 0}"
                         onerror="this.style.display='none'; this.nextElementSibling?.style.display='block';"
                         onload="console.log('Image loaded:', '${imageUrl}');"
                         loading="lazy">>
                    <div class="image-load-error" style="display: none; padding: 20px; background: #f04747; color: white; border-radius: 8px; text-align: center;">
                        <span>画像を読み込めませんでした</span><br>
                        <small>URL: ${imageUrl}</small>
                    </div>
                    ${copyButtonHTML}
                </div>
            `;
        } else if (isFile) {
            const copyButtonHTML = isUploaderChannel && currentChannel.type === 'uploader_public' ? 
                `<button class="copy-url-btn" data-url="${message.file_url}" title="URLをコピー">📋 URLをコピー</button>` : '';
            
            contentHTML = `
                ${messageTypeIndicator}
                <div class="message-text">${message.content}</div>
                <div class="message-attachment">
                    <a href="${message.file_url}" target="_blank" class="file-attachment">
                        📎 ${message.file_name} (${this.formatFileSize(message.file_size)})
                    </a>
                    ${copyButtonHTML}
                </div>
            `;
        } else {
            contentHTML = `${messageTypeIndicator}<div class="message-text">${this.formatMessageContent(message.content)}</div>`;
        }

        const messageClass = isUploaderChannel ? 
            `message uploader-channel-message ${isImage ? 'image-message' : isFile ? 'file-message' : 'text-message'}` :
            'message';

        return `
            <div class="${messageClass}" data-message-id="${message.id}">
                <div class="message-avatar" style="background-color: ${this.getAvatarColor(message.user_id)};">
                    ${message.username.charAt(0).toUpperCase()}
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">${message.username}</span>
                        <span class="message-timestamp">${timestamp}</span>
                    </div>
                    ${contentHTML}
                </div>
            </div>
        `;
    }

    formatMessageContent(content) {
        // URLをリンクに変換
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        content = content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // 改行を<br>に変換
        content = content.replace(/\n/g, '<br>');
        
        // メンション（@username）のハイライト
        const mentionRegex = /@(\w+)/g;
        content = content.replace(mentionRegex, '<span class="mention">@$1</span>');
        
        return content;
    }

    getAvatarColor(userId) {
        const colors = [
            '#7289da', '#43b581', '#faa61a', '#f04747', 
            '#9c84ef', '#f47fff', '#00d9ff', '#7289da'
        ];
        return colors[userId % colors.length];
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    addMessage(message, currentChannel = null) {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.insertAdjacentHTML('beforeend', this.renderMessage(message, currentChannel));
            this.scrollToBottom();
        }
    }

    clearMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
    }

    renderMessages(messages, currentChannel = null) {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer && messages) {
            messagesContainer.innerHTML = messages.map(msg => this.renderMessage(msg, currentChannel)).join('');
            this.scrollToBottom();
        }
    }
}

// グローバルスコープに登録
window.MessageManager = MessageManager;
