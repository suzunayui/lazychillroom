// ファイルアップロード管理クラス
class FileUploadHandler {
    constructor(chatUI) {
        this.chatUI = chatUI;
        this.selectedFiles = [];
    }

    bindFileUploadEvents() {
        // ファイル選択ボタン
        const fileUploadBtn = document.getElementById('fileUploadBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (fileUploadBtn && fileInput) {
            fileUploadBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }

        // ファイルプレビューのクリアボタン
        const clearFilesBtn = document.getElementById('clearFilesBtn');
        if (clearFilesBtn) {
            clearFilesBtn.addEventListener('click', () => {
                this.clearSelectedFiles();
            });
        }

        // ドラッグ&ドロップ
        const chatContainer = document.querySelector('.main-content');
        const dragDropOverlay = document.getElementById('dragDropOverlay');
        
        if (chatContainer && dragDropOverlay) {
            chatContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                dragDropOverlay.classList.add('active');
            });

            chatContainer.addEventListener('dragleave', (e) => {
                if (!chatContainer.contains(e.relatedTarget)) {
                    dragDropOverlay.classList.remove('active');
                }
            });

            chatContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                dragDropOverlay.classList.remove('active');
                this.handleFileSelection(e.dataTransfer.files);
            });

            dragDropOverlay.addEventListener('click', () => {
                dragDropOverlay.classList.remove('active');
            });
        }
    }

    handleFileSelection(files) {
        const fileArray = Array.from(files);
        
        // ファイルサイズとタイプの検証
        const validFiles = fileArray.filter(file => {
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf', 'text/plain',
                'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (file.size > maxSize) {
                this.chatUI.uiUtils.showNotification(`${file.name} のファイルサイズが大きすぎます（最大10MB）`, 'error');
                return false;
            }

            if (!allowedTypes.includes(file.type)) {
                this.chatUI.uiUtils.showNotification(`${file.name} はサポートされていないファイルタイプです`, 'error');
                return false;
            }

            return true;
        });

        this.selectedFiles = [...this.selectedFiles, ...validFiles];
        this.updateFilePreview();
    }

    updateFilePreview() {
        const filePreviewContainer = document.getElementById('filePreviewContainer');
        const filePreviewList = document.getElementById('filePreviewList');
        
        if (!filePreviewContainer || !filePreviewList) return;

        if (this.selectedFiles.length === 0) {
            filePreviewContainer.style.display = 'none';
            return;
        }

        filePreviewContainer.style.display = 'block';
        filePreviewList.innerHTML = '';

        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-preview-item';
            
            const fileIcon = this.getFileIcon(file.type);
            const fileSize = this.formatFileSize(file.size);
            
            fileItem.innerHTML = `
                <div class="file-preview-icon">${fileIcon}</div>
                <div class="file-preview-info">
                    <div class="file-preview-name">${file.name}</div>
                    <div class="file-preview-size">${fileSize}</div>
                </div>
                <button class="file-preview-remove" data-index="${index}">×</button>
            `;

            filePreviewList.appendChild(fileItem);
        });

        // 削除ボタンのイベント
        filePreviewList.addEventListener('click', (e) => {
            if (e.target.classList.contains('file-preview-remove')) {
                const index = parseInt(e.target.dataset.index);
                this.selectedFiles.splice(index, 1);
                this.updateFilePreview();
            }
        });
    }

    clearSelectedFiles() {
        this.selectedFiles = [];
        this.updateFilePreview();
        
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType === 'application/pdf') return '📄';
        if (mimeType.includes('word')) return '📝';
        if (mimeType === 'text/plain') return '📄';
        return '📎';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async uploadFiles() {
        if (this.selectedFiles.length === 0 || !this.chatUI.currentChannel) {
            return false;
        }

        const messageInput = document.getElementById('messageInput');
        const content = messageInput ? messageInput.value.trim() : '';

        try {
            // 複数ファイルを順次アップロード
            for (const file of this.selectedFiles) {
                const result = await this.chatUI.chatManager.uploadFile(file, this.chatUI.currentChannel.id, content);
                
                if (result.success) {
                    this.chatUI.chatManager.addMessage(result.message);
                } else {
                    this.chatUI.uiUtils.showNotification(`ファイル ${file.name} のアップロードに失敗しました: ${result.error}`, 'error');
                }
            }

            // アップロード完了後、選択したファイルをクリア
            this.clearSelectedFiles();
            
            // メッセージ入力欄をクリア
            if (messageInput) {
                messageInput.value = '';
            }

            return true;
        } catch (error) {
            console.error('ファイルアップロードエラー:', error);
            this.chatUI.uiUtils.showNotification('ファイルのアップロードに失敗しました', 'error');
            return false;
        }
    }

    // アップローダー用ファイルアップロード
    async uploadUploaderFiles() {
        if (this.selectedFiles.length === 0 || !this.chatUI.currentChannel) {
            return false;
        }

        const messageInput = document.getElementById('messageInput');
        const content = messageInput ? messageInput.value.trim() : '';

        try {
            // 複数ファイルを順次アップロード
            for (const file of this.selectedFiles) {
                const result = await this.chatUI.chatManager.uploadUploaderFile(file, this.chatUI.currentChannel.id, content);
                
                if (result.success) {
                    this.chatUI.chatManager.addMessage(result.message);
                    
                    // 公開ファイルの場合、アクセスURLを表示
                    if (this.chatUI.currentChannel.type === 'uploader_public' && result.uploadInfo.access_url) {
                        const accessUrl = window.location.origin + result.uploadInfo.access_url;
                        console.log('公開URL:', accessUrl);
                        
                        // 公開URLをクリップボードにコピー
                        try {
                            await navigator.clipboard.writeText(accessUrl);
                            this.chatUI.showNotification('公開URLをクリップボードにコピーしました', 'success');
                        } catch (e) {
                            console.log('クリップボードへのコピーに失敗:', e);
                        }
                    }
                } else {
                    this.chatUI.uiUtils.showNotification(`ファイル ${file.name} のアップロードに失敗しました: ${result.error}`, 'error');
                }
            }

            // アップロード完了後、選択したファイルをクリア
            this.clearSelectedFiles();
            
            // メッセージ入力欄をクリア
            if (messageInput) {
                messageInput.value = '';
            }

            return true;
        } catch (error) {
            console.error('アップローダーファイルアップロードエラー:', error);
            this.chatUI.uiUtils.showNotification('ファイルのアップロードに失敗しました', 'error');
            return false;
        }
    }
}

// グローバルスコープに登録
window.FileUploadHandler = FileUploadHandler;
