// チャット機能管理クラス
class ChatManager {
    constructor(currentUser) {
        this.apiBase = 'api';
        this.currentChannel = null;
        this.currentGuild = null;
        this.channels = [];
        this.guilds = [];
        this.dmChannels = [];
        
        this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
        this.messageManager = new MessageManager();
        
        console.log('Current User:', this.currentUser);
        
        // ユーザー情報の検証と修正
        if (!this.currentUser) {
            console.error('ユーザー情報が見つかりません。ログイン画面に戻ります。');
            window.location.reload();
            return;
        }
        
        // usernameが存在しない場合の対応
        if (!this.currentUser.username) {
            console.warn('ユーザー名が見つかりません。再認証を試みます...');
            this.refreshUserInfo();
            return;
        }
        
        this.isDMMode = false; // DMモードかどうかを管理
        this.currentGuild = null;
        this.currentChannel = null;
        // init()はChatUIから呼び出される
    }

    async refreshUserInfo() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.error('認証トークンが見つかりません');
                window.location.reload();
                return;
            }

            const response = await fetch('api/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'verify' })
            });

            const data = await response.json();
            
            if (data.success && data.user) {
                this.currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                console.log('ユーザー情報が更新されました:', this.currentUser);
                // ユーザー情報更新後の初期化は、必要に応じてChatUIから呼び出される
            } else {
                console.error('ユーザー情報の取得に失敗しました');
                window.location.reload();
            }
        } catch (error) {
            console.error('ユーザー情報の更新エラー:', error);
            window.location.reload();
        }
    }

    async loadChannels(guildId = null) {
        try {
            let url = `${this.apiBase}/channels.php`;
            if (guildId) {
                url += `?guild_id=${guildId}`;
            } else {
                url += `?type=dm`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (guildId) {
                    this.channels = data.channels;
                } else {
                    this.dmChannels = data.channels;
                }
                return data.channels;
            } else {
                console.error('チャンネル読み込みエラー:', data.message);
                return [];
            }
        } catch (error) {
            console.error('チャンネル読み込みエラー:', error);
            return [];
        }
    }

    async loadGuilds() {
        try {
            console.log('loadGuilds メソッド開始');
            
            // 一時的にダミーデータを返す（後でAPIと連携）
            const dummyGuilds = [
                {
                    id: 1,
                    name: 'LazyChillRoom',
                    description: 'メインサーバー',
                    icon_url: null
                }
            ];
            
            console.log('ダミーギルドデータ:', dummyGuilds);
            
            this.guilds = dummyGuilds;
            console.log('this.guilds に設定:', this.guilds);
            
            return this.guilds;
            
            // 将来のAPI実装用のコード（コメントアウト）
            /*
            const response = await fetch(`${this.apiBase}/guilds.php`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.guilds = data.guilds;
                return this.guilds;
            } else {
                console.error('ギルド読み込みエラー:', data.message);
                return [];
            }
            */
        } catch (error) {
            console.error('ギルド読み込みエラー:', error);
            return [];
        }
    }

    async loadGuildDetails(guildId) {
        try {
            const response = await fetch(`${this.apiBase}/guilds.php?guild_id=${guildId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                return data.guild;
            } else {
                console.error('ギルド詳細読み込みエラー:', data.message);
                return null;
            }
        } catch (error) {
            console.error('ギルド詳細読み込みエラー:', error);
            return null;
        }
    }

    // MessageManagerのメソッドをプロキシ
    async loadMessages(channelId, limit = 50, before = null) {
        return await this.messageManager.loadMessages(channelId, limit, before);
    }

    async sendMessage(channelId, content, type = 'text') {
        return await this.messageManager.sendMessage(channelId, content, type);
    }

    async uploadFile(file, channelId, content = '') {
        return await this.messageManager.uploadFile(file, channelId, content);
    }

    renderMessage(message) {
        return this.messageManager.renderMessage(message, this.currentChannel);
    }

    addMessage(message) {
        this.messageManager.addMessage(message, this.currentChannel);
    }

    clearMessages() {
        this.messageManager.clearMessages();
    }

    renderMessages(messages) {
        this.messageManager.renderMessages(messages, this.currentChannel);
    }

    scrollToBottom() {
        this.messageManager.scrollToBottom();
    }

    // マイサーバー取得
    async getMyServer() {
        try {
            const response = await fetch(`${this.apiBase}/my_server.php`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                return data.server;
            } else {
                console.error('マイサーバー取得エラー:', data.message);
                return null;
            }
        } catch (error) {
            console.error('マイサーバー取得エラー:', error);
            return null;
        }
    }

    // マイサーバー作成
    async createMyServer() {
        try {
            const response = await fetch(`${this.apiBase}/my_server.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                return data;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('マイサーバー作成エラー:', error);
            throw error;
        }
    }

    // アップローダー用ファイルアップロード
    async uploadUploaderFile(file, channelId, content = '') {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('channel_id', channelId);
            formData.append('content', content);

            const response = await fetch(`${this.apiBase}/uploader.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                return { success: true, message: data.message, uploadInfo: data.upload_info };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            console.error('アップローダーファイルアップロードエラー:', error);
            return { success: false, error: 'ファイルアップロードに失敗しました' };
        }
    }

    // 初期化メソッド
    async init() {
        try {
            // 初期データを読み込み
            await this.loadGuilds();
            await this.loadChannels();
            
            // デフォルトのギルドとチャンネルを設定
            if (this.guilds.length > 0) {
                this.currentGuild = this.guilds[0];
                if (this.channels.length > 0) {
                    this.currentChannel = this.channels[0];
                    await this.loadMessages(this.currentChannel.id);
                }
            }
            
            console.log('ChatManager初期化完了');
        } catch (error) {
            console.error('ChatManager初期化エラー:', error);
        }
    }
}

// グローバルスコープに登録
window.ChatManager = ChatManager;
