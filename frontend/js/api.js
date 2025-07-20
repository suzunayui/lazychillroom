// API設定とクライアント
class ApiClient {
    constructor() {
        this.baseURL = window.location.origin;
        
        // トークンを複数のソースから読み込み
        this.token = localStorage.getItem('authToken') || 
                     sessionStorage.getItem('authToken') || 
                     null;
        
        this.socket = null;
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.requestDelay = 50; // リクエスト間の遅延を短縮（50ms）
        this.cache = new Map(); // リクエストキャッシュ
        this.cacheTimeout = 30000; // 30秒のキャッシュ
        
        console.log('🔧 ApiClient初期化 - トークン状態:', this.token ? 'あり' : 'なし');
    }

    // Socket.io接続を初期化
    initSocket() {
        if (!this.token) return null;

        this.socket = io({
            auth: {
                token: this.token
            }
        });

        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.socket.emit('join_guilds');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        return this.socket;
    }

    // HTTPリクエストのヘルパー（レート制限対応）
    async request(endpoint, options = {}) {
        // GETリクエストでキャッシュをチェック
        if (!options.method || options.method === 'GET') {
            const cacheKey = `${endpoint}${JSON.stringify(options)}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`📋 Cache hit for: ${endpoint}`);
                return cached.data;
            }
        }
        
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ endpoint, options, resolve, reject });
            this.processQueue();
        });
    }

    // リクエストキューを処理
    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const { endpoint, options, resolve, reject } = this.requestQueue.shift();
            
            try {
                const result = await this.makeRequest(endpoint, options);
                resolve(result);
            } catch (error) {
                reject(error);
            }

            // リクエスト間に遅延を追加
            if (this.requestQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.requestDelay));
            }
        }

        this.isProcessingQueue = false;
    }

    // 実際のHTTPリクエストを実行
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}/api${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            console.log('🌐 API Request:', options.method || 'GET', url, config.body ? JSON.parse(config.body) : 'no body');
            
            // ネットワーク接続チェック
            if (!navigator.onLine) {
                const error = new Error('インターネット接続がありません（オフライン状態）');
                error.status = 0;
                error.isNetworkError = true;
                throw error;
            }
            
            const response = await fetch(url, config);
            
            console.log('📨 API Response status:', response.status);
            
            let data;
            let responseText = '';
            try {
                responseText = await response.text();
                data = JSON.parse(responseText);
                console.log('📄 API Response data:', data);
            } catch (parseError) {
                console.error('❌ JSON parse error:', parseError);
                console.error('Raw response:', responseText);
                throw new Error(`サーバーからの応答を解析できませんでした: ${responseText.substring(0, 100)}`);
            }

            // ステータスが正常でない場合も、レスポンスデータを返す
            // エラーメッセージはdataに含まれている
            if (!response.ok) {
                // データにエラー情報があればそれを使用、なければデフォルトメッセージ
                const errorMessage = data.message || `HTTP error! status: ${response.status}`;
                console.error('❌ API Error:', errorMessage, data);
                // エラーオブジェクトにレスポンスデータを含める
                const error = new Error(errorMessage);
                error.response = data;
                error.status = response.status;
                
                // 認証関連のエラーをマーク
                if (response.status === 401) {
                    error.isAuthError = true;
                }
                
                throw error;
            }

            // 成功したGETリクエストの結果をキャッシュ
            if ((!options.method || options.method === 'GET') && response.ok) {
                const cacheKey = `${endpoint}${JSON.stringify(options)}`;
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                console.log(`📝 Cached response for: ${endpoint}`);
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            
            // ネットワークエラーの詳細分類
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                error.isNetworkError = true;
                error.message = 'ネットワークエラー: サーバーに接続できません';
            }
            
            throw error;
        }
    }

    // GET request
    async get(endpoint, options = {}) {
        return this.request(endpoint, { method: 'GET', ...options });
    }

    // POST request
    async post(endpoint, body, options = {}) {
        return this.request(endpoint, { method: 'POST', body, ...options });
    }

    // PUT request
    async put(endpoint, body, options = {}) {
        return this.request(endpoint, { method: 'PUT', body, ...options });
    }

    // DELETE request
    async delete(endpoint, options = {}) {
        return this.request(endpoint, { method: 'DELETE', ...options });
    }

    // トークンの有効性をチェック
    async verifyToken() {
        try {
            console.log('🔍 Verifying token...');
            const response = await this.request('/auth/verify', { method: 'GET' });
            console.log('✅ Token verification result:', response);
            return response.success;
        } catch (error) {
            console.error('❌ Token verification failed:', error);
            return false;
        }
    }

    // ファイルアップロード
    async uploadFile(endpoint, file, additionalData = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        const config = {
            method: 'POST',
            headers: {},
            body: formData
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${this.baseURL}/api${endpoint}`, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    // 認証関連メソッド
    setToken(token) {
        this.token = token;
        
        try {
            // localStorage と sessionStorage の両方に保存を試行
            localStorage.setItem('authToken', token);
            sessionStorage.setItem('authToken', token);
            console.log('Token set: あり (localStorage + sessionStorage)');
        } catch (error) {
            console.warn('ストレージへの保存に失敗:', error);
            // ストレージが使用できない場合でも、メモリ上のトークンは保持
            console.log('Token set: あり (メモリのみ)');
        }
    }

    removeToken() {
        this.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // トークンを再読み込み
    reloadToken() {
        console.log('🔄 トークン再読み込み開始...');
        console.log('🔄 localStorage の全キー:', Object.keys(localStorage));
        
        // localStorage、sessionStorage、メモリの順で確認
        let token = localStorage.getItem('authToken');
        if (!token) {
            console.log('🔄 localStorage にトークンなし、sessionStorageを確認...');
            token = sessionStorage.getItem('authToken');
        }
        if (!token && this.token) {
            console.log('🔄 ストレージにトークンなし、メモリ上のトークンを使用...');
            token = this.token;
        }
        
        console.log('🔄 最終的に取得されたトークン:', token ? `存在 (${token.substring(0, 10)}...)` : 'なし');
        console.log('🔄 トークンタイプ:', typeof token);
        console.log('🔄 トークン長:', token ? token.length : 'null');
        
        this.token = token;
        console.log('Token reloaded:', this.token ? 'あり' : 'なし');
        return this.token;
    }

    // 認証API
    async login(userid, password) {
        const response = await this.post('/auth/login', { userid, password });
        if (response.success && response.token) {
            this.setToken(response.token);
        }
        return response;
    }

    async register(userid, password) {
        const response = await this.post('/auth/register', { userid, password });
        if (response.success && response.token) {
            this.setToken(response.token);
        }
        return response;
    }

    async verifyToken() {
        return this.get('/auth/verify');
    }

    // メッセージAPI
    async getMessages(channelId, limit = 50, before = null) {
        const params = new URLSearchParams({ channel_id: channelId, limit });
        if (before) params.append('before', before);
        return this.get(`/messages?${params}`);
    }

    async sendMessage(channelId, content, replyTo = null) {
        return this.post('/messages', { channel_id: channelId, content, reply_to: replyTo });
    }

    async deleteMessage(messageId) {
        return this.delete(`/messages/${messageId}`);
    }

    // ギルドAPI
    async getGuilds() {
        return this.get('/guilds');
    }

    async getGuild(guildId) {
        return this.get(`/guilds/${guildId}`);
    }

    async createGuild(name, description = '', isPublic = false) {
        return this.post('/guilds', { name, description, is_public: isPublic });
    }

    async joinGuild(inviteCode) {
        return this.post(`/guilds/join/${inviteCode}`);
    }

    async leaveGuild(guildId) {
        return this.delete(`/guilds/${guildId}/leave`);
    }

    // チャンネルAPI
    async getChannels(guildId) {
        return this.get(`/channels/guild/${guildId}`);
    }

    async createChannel(guildId, name, type = 'text', position = null) {
        return this.post('/channels', { guild_id: guildId, name, type, position });
    }

    async updateChannel(channelId, updates) {
        return this.put(`/channels/${channelId}`, updates);
    }

    async deleteChannel(channelId) {
        return this.delete(`/channels/${channelId}`);
    }

    // ユーザーAPI
    async getUserProfile() {
        return this.get('/users/profile');
    }

    async updateProfile(userid) {
        return this.put('/users/profile', { userid });
    }

    async uploadAvatar(file) {
        return this.uploadFile('/users/avatar', file);
    }

    async searchUsers(query, limit = 10) {
        const params = new URLSearchParams({ q: query, limit });
        return this.get(`/users/search?${params}`);
    }

    // ファイルAPI
    async uploadFileToChannel(file, channelId) {
        return this.uploadFile('/files/upload', file, { channel_id: channelId });
    }

    async getChannelFiles(channelId, limit = 20, offset = 0) {
        const params = new URLSearchParams({ limit, offset });
        return this.get(`/files/channel/${channelId}?${params}`);
    }

    async deleteFile(fileId) {
        return this.delete(`/files/${fileId}`);
    }
}

// グローバルAPIクライアントインスタンス
window.apiClient = new ApiClient();
