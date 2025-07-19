// 認証管理クラス
class AuthManager {
    constructor() {
        this.apiClient = window.apiClient;
        this.currentUser = null;
        this.isAuthenticated = false;
        this._isLoggingOut = false; // ログアウト重複実行防止フラグ
        this._isVerifyingInBackground = false; // バックグラウンド検証実行中フラグ
        this._lastBackgroundVerifyTime = 0; // 最後のバックグラウンド検証実行時刻
        this._backgroundVerifyInterval = 30000; // バックグラウンド検証の最小間隔（30秒）
        this._isRedirectingToAuth = false; // 認証画面リダイレクト中フラグ
        
        // 定期的な接続チェック（5分毎）
        this.connectionCheckInterval = null;
        this.startConnectionCheck();
        
        console.log('AuthManager初期化');
    }

    // 定期的な接続チェックを開始
    startConnectionCheck() {
        // 既存のインターバルをクリア
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        
        // 5分毎にサーバーとの接続をチェック
        this.connectionCheckInterval = setInterval(async () => {
            if (this.isAuthenticated && navigator.onLine) {
                try {
                    console.log('🔄 定期接続チェック実行中...');
                    const response = await this.apiClient.request('/auth/verify', {
                        method: 'GET'
                    });
                    
                    if (response.success) {
                        console.log('✅ 定期接続チェック: 認証状態良好');
                        // ユーザー情報を更新
                        if (response.user) {
                            this.currentUser = response.user;
                            localStorage.setItem('currentUser', JSON.stringify(response.user));
                        }
                    } else {
                        console.warn('⚠️ 定期接続チェック: トークンが無効になっています');
                        if (response.status === 401) {
                            this.clearAuthData();
                            // ログイン画面にリダイレクト
                            if (window.appLoader) {
                                window.appLoader.showAuthScreen();
                            }
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ 定期接続チェックエラー（一時的な問題の可能性）:', error.message);
                    // ネットワークエラーの場合は何もしない（認証状態を保持）
                }
            }
        }, 5 * 60 * 1000); // 5分
    }

    // 接続チェックを停止
    stopConnectionCheck() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }

    // ログイン
    async login(userId, password) {
        try {
            console.log('🔐 ログイン試行中...', userId);
            const response = await this.apiClient.post('/auth/login', {
                userid: userId,  // useridとして送信
                password: password
            });

            console.log('🔐 ログインレスポンス:', response);
            if (response.success) {
                this.currentUser = response.user;
                this.isAuthenticated = true;
                
                // トークンを保存（重要：localStorageにも保存）
                this.apiClient.setToken(response.token);
                
                // 複数のストレージに保存
                try {
                    localStorage.setItem('authToken', response.token);
                    localStorage.setItem('currentUser', JSON.stringify(response.user));
                    if (response.sessionId) {
                        localStorage.setItem('sessionId', response.sessionId);
                        sessionStorage.setItem('sessionId', response.sessionId);
                    }
                    sessionStorage.setItem('authToken', response.token);
                    sessionStorage.setItem('currentUser', JSON.stringify(response.user));
                } catch (error) {
                    console.warn('⚠️ ストレージへの保存に失敗:', error);
                }
                
                console.log('✅ ログイン成功 - 認証情報を保存しました');
                console.log('🔑 保存されたトークン:', response.token.substring(0, 10) + '...');
                console.log('👤 保存されたユーザー:', response.user.nickname);
                
                // 定期接続チェックを開始
                this.startConnectionCheck();
                
                return { success: true, user: response.user };
            } else {
                console.log('❌ ログイン失敗:', response.message);
                return { success: false, error: response.message };
            }
        } catch (error) {
            console.error('❌ ログインエラー:', error);
            
            // APIからのエラーレスポンスがある場合、そのメッセージを使用
            if (error.response && error.response.message) {
                return { success: false, error: error.response.message };
            }
            
            return { success: false, error: 'ネットワークエラーが発生しました' };
        }
    }

    // 新規登録
    async register(userId, password, nickname) {
        try {
            console.log('📝 新規登録試行中...', userId, nickname);
            const response = await this.apiClient.post('/auth/register', {
                userid: userId,  // useridとして送信
                password: password,
                nickname: nickname
            });

            console.log('📝 新規登録レスポンス:', response);
            if (response.success) {
                this.currentUser = response.user;
                this.isAuthenticated = true;
                
                // トークンを保存（重要：localStorageにも保存）
                this.apiClient.setToken(response.token);
                localStorage.setItem('authToken', response.token);
                localStorage.setItem('currentUser', JSON.stringify(response.user));
                
                console.log('✅ 新規登録成功 - 認証情報を保存しました');
                console.log('🔑 保存されたトークン:', response.token.substring(0, 10) + '...');
                console.log('👤 保存されたユーザー:', response.user.nickname);
                
                // 定期接続チェックを開始
                this.startConnectionCheck();
                
                return { success: true, user: response.user };
            } else {
                console.log('❌ 新規登録失敗:', response.message);
                return { success: false, error: response.message };
            }
        } catch (error) {
            console.error('❌ 登録エラー:', error);
            
            // APIからのエラーレスポンスがある場合、そのメッセージを使用
            if (error.response && error.response.message) {
                return { success: false, error: error.response.message };
            }
            
            // エラーメッセージから特定のエラーを判定
            if (error.message && error.message.includes('このユーザーIDは既に使用されています')) {
                return { success: false, error: 'このユーザーIDは既に使用されています' };
            }
            
            return { success: false, error: 'ネットワークエラーが発生しました' };
        }
    }

    // ログアウト
    async logout() {
        // 重複実行防止
        if (this._isLoggingOut) {
            return;
        }
        this._isLoggingOut = true;
        
        try {
            // サーバー側でセッション削除
            const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
            if (sessionId) {
                try {
                    await this.apiClient.request('/auth/logout', {
                        method: 'POST',
                        body: JSON.stringify({ sessionId })
                    });
                    console.log('✅ サーバー側セッション削除完了');
                } catch (error) {
                    console.warn('⚠️ サーバー側セッション削除に失敗:', error);
                }
            }
            
            this.currentUser = null;
            this.isAuthenticated = false;
            
            // APIクライアントのトークンを削除
            if (this.apiClient && this.apiClient.removeToken) {
                this.apiClient.removeToken();
            }
            
            // ローカルストレージをクリア
            localStorage.removeItem('authToken');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('sessionId');
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('sessionId');
            
            console.log('✅ ログアウト処理完了。ページを再読み込みします...');
            
            // 少し遅延してからリロード（他の処理を完了させるため）
            setTimeout(() => {
                window.location.reload();
            }, 100);
            
        } catch (error) {
            console.error('❌ ログアウト処理でエラー:', error);
            this._isLoggingOut = false; // エラー時はフラグをリセット
            // エラーがあってもリロード
            window.location.reload();
        }
    }

    // バックグラウンドでトークンを検証（非同期、エラーでも認証状態に影響しない）
    async verifyTokenInBackground() {
        // 既に実行中の場合はスキップ
        if (this._isVerifyingInBackground) {
            console.log('⏳ バックグラウンド認証検証は既に実行中です。スキップします。');
            return;
        }
        
        // 最小間隔チェック
        const now = Date.now();
        const timeSinceLastVerify = now - this._lastBackgroundVerifyTime;
        if (timeSinceLastVerify < this._backgroundVerifyInterval) {
            console.log(`⏰ バックグラウンド認証検証の間隔が短すぎます（${timeSinceLastVerify}ms < ${this._backgroundVerifyInterval}ms）。スキップします。`);
            return;
        }
        
        this._isVerifyingInBackground = true;
        this._lastBackgroundVerifyTime = now;
        
        try {
            console.log('🔍 バックグラウンド認証検証開始...');
            console.log('🔍 APIクライアントトークン:', this.apiClient?.token ? `存在 (${this.apiClient.token.substring(0, 10)}...)` : 'なし');
            console.log('🔍 認証リクエスト送信...');
            
            const response = await this.apiClient.request('/auth/verify', {
                method: 'GET'
            });

            console.log('🔍 バックグラウンド認証チェック結果:', response);
            if (response.success) {
                console.log('✅ バックグラウンド検証: トークンが有効です');
                // サーバーから最新のユーザー情報で更新
                if (response.user) {
                    this.currentUser = response.user;
                    localStorage.setItem('currentUser', JSON.stringify(response.user));
                    console.log('✅ ユーザー情報を最新に更新しました');
                }
            } else {
                console.log('❌ バックグラウンド検証: トークンが無効です:', response.message);
                // 401エラーまたは「ユーザーが見つかりません」の場合は認証データをクリア
                if (response.status === 401 || 
                    (response.message && 
                     (response.message.includes('無効') || 
                      response.message.includes('expired') || 
                      response.message.includes('invalid') ||
                      response.message.includes('ユーザーが見つかりません')))) {
                    console.log('🗑️ トークンが無効またはユーザーが見つからないため、認証データをクリアします');
                    this.clearAuthData();
                    
                    // 認証画面にリダイレクト（重複実行防止）
                    if (!this._isRedirectingToAuth && window.appLoader && typeof window.appLoader.showAuthScreen === 'function') {
                        // 既に認証画面が表示されている場合はスキップ
                        const app = document.getElementById('app');
                        if (app && app.innerHTML.includes('auth-container')) {
                            console.log('🔍 既に認証画面が表示されているため、リダイレクトをスキップします');
                            return;
                        }
                        
                        this._isRedirectingToAuth = true;
                        setTimeout(() => {
                            window.appLoader.showAuthScreen();
                            // 3秒後にフラグをリセット
                            setTimeout(() => {
                                this._isRedirectingToAuth = false;
                            }, 3000);
                        }, 1000);
                    }
                } else {
                    console.log('⚠️ バックグラウンド検証失敗ですが、認証状態は保持します');
                }
            }
        } catch (error) {
            console.warn('⚠️ バックグラウンド認証検証エラー:', error.message);
            console.warn('⚠️ エラー詳細:', { 
                name: error.constructor.name, 
                status: error.status, 
                isAuthError: error.isAuthError,
                isNetworkError: error.isNetworkError 
            });
            
            // 401エラーまたは「ユーザーが見つかりません」の場合は認証データをクリア
            if (error.status === 401 || 
                (error.message && error.message.includes('ユーザーが見つかりません'))) {
                console.log('🗑️ 認証エラーまたはユーザーが見つからないため、認証データをクリアします');
                this.clearAuthData();
                
                // 認証画面にリダイレクト（重複実行防止）
                if (!this._isRedirectingToAuth && window.appLoader && typeof window.appLoader.showAuthScreen === 'function') {
                    // 既に認証画面が表示されている場合はスキップ
                    const app = document.getElementById('app');
                    if (app && app.innerHTML.includes('auth-container')) {
                        console.log('🔍 既に認証画面が表示されているため、リダイレクトをスキップします');
                        return;
                    }
                    
                    this._isRedirectingToAuth = true;
                    setTimeout(() => {
                        window.appLoader.showAuthScreen();
                        // 3秒後にフラグをリセット
                        setTimeout(() => {
                            this._isRedirectingToAuth = false;
                        }, 3000);
                    }, 1000);
                }
            } else {
                console.log('⚠️ 一時的なエラーと判断し、認証状態は保持します');
            }
        } finally {
            this._isVerifyingInBackground = false;
        }
    }

    // 認証状態チェック
    async checkAuthStatus() {
        console.log('🔍 認証状態チェック開始...');
        
        // デバッグ: 現在のストレージ状況を詳細表示
        console.log('🔍 === ストレージデバッグ情報 ===');
        console.log('🔍 localStorage keys:', Object.keys(localStorage));
        console.log('🔍 sessionStorage keys:', Object.keys(sessionStorage));
        console.log('🔍 authToken (localStorage):', localStorage.getItem('authToken'));
        console.log('🔍 authToken (sessionStorage):', sessionStorage.getItem('authToken'));
        console.log('🔍 currentUser (localStorage):', localStorage.getItem('currentUser'));
        console.log('🔍 currentUser (sessionStorage):', sessionStorage.getItem('currentUser'));
        console.log('🔍 apiClient.token:', this.apiClient?.token);
        
        // APIクライアントのトークンを強制的に再読み込み
        if (this.apiClient && this.apiClient.reloadToken) {
            this.apiClient.reloadToken();
        }
        
        console.log('🔍 ストレージデバッグ開始...');
        console.log('🔍 localStorage.length:', localStorage.length);
        console.log('🔍 sessionStorage.length:', sessionStorage.length);
        
        // 複数のソースからトークンとユーザー情報を取得
        const token = localStorage.getItem('authToken') || 
                     sessionStorage.getItem('authToken') ||
                     (this.apiClient && this.apiClient.token);
                     
        const currentUser = localStorage.getItem('currentUser') || 
                           sessionStorage.getItem('currentUser');

        console.log('🔍 保存されたトークン:', token ? `存在 (${token.substring(0, 10)}...)` : '不在');
        console.log('🔍 保存されたユーザー:', currentUser ? '存在' : '不在');

        if (token && currentUser) {
            try {
                console.log('✓ ローカルストレージに認証情報があります');
                // APIクライアントにトークンを設定
                this.apiClient.setToken(token);
                
                // 保存されたユーザー情報を復元
                this.currentUser = JSON.parse(currentUser);
                this.isAuthenticated = true;
                
                // 定期接続チェックを開始
                this.startConnectionCheck();
                
                // まず認証状態を有効と仮定（オフライン状態やネットワークエラーに対応）
                console.log('✓ ローカル認証情報が存在するため、まず認証済みとして処理します');
                
                // バックグラウンドでトークンの有効性を確認（非同期）
                console.log('🔍 バックグラウンドでサーバーの認証状態を確認中...');
                this.verifyTokenInBackground();
                
                return true;
            } catch (error) {
                console.error('❌ 認証状態確認エラー:', error);
                
                // ネットワークエラーや一時的なサーバーエラーの場合は認証状態を保持
                if (error.isNetworkError ||
                    error.message.includes('ネットワーク') || 
                    error.message.includes('Failed to fetch') ||
                    error.message.includes('NetworkError') ||
                    error.message.includes('インターネット接続') ||
                    error.status >= 500 || // サーバーエラー
                    error.status === 0 ||   // ネットワークエラー
                    !navigator.onLine) { // オフライン
                    console.log('⚠️ 一時的なエラーのため、既存の認証状態を保持');
                    console.log('⚠️ エラータイプ:', error.constructor.name);
                    console.log('⚠️ エラーステータス:', error.status);
                    console.log('⚠️ オンライン状態:', navigator.onLine);
                    return true;
                }
                
                // 401 Unauthorizedの場合のみトークンをクリア
                if (error.status === 401 || error.isAuthError) {
                    console.log('🗑️ 認証エラー(401)のため認証データをクリアします');
                    this.clearAuthData();
                    return false;
                }
                
                // その他のエラーでも認証状態を保持（より寛容に）
                console.log('⚠️ 不明なエラーですが、認証状態を保持します');
                console.log('⚠️ エラー詳細:', {
                    message: error.message,
                    status: error.status,
                    name: error.constructor.name
                });
                return true;
            }
        } else {
            console.log('❌ 認証情報が見つかりません（初回ログインまたはログアウト済み）');
        }

        return false;
    }

    // 認証データをクリア（ページリロードなし）
    clearAuthData() {
        console.log('🗑️ 認証データをクリアします');
        this.currentUser = null;
        this.isAuthenticated = false;
        
        // 定期接続チェックを停止
        this.stopConnectionCheck();
        
        // APIクライアントのトークンを削除
        if (this.apiClient && this.apiClient.removeToken) {
            this.apiClient.removeToken();
        }
        
        // ローカルストレージをクリア
        localStorage.removeItem('authToken');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        
        console.log('✅ 認証データクリア完了');
    }

    // 現在のユーザー取得
    getCurrentUser() {
        return this.currentUser;
    }

    // 認証状態取得
    isLoggedIn() {
        return this.isAuthenticated;
    }
}

// 認証UI管理クラス
class AuthUI {
    constructor() {
        // 既存のAuthManagerを再利用するか、新しく作成
        this.authManager = window.globalAuthManager || new AuthManager();
        if (!window.globalAuthManager) {
            window.globalAuthManager = this.authManager;
        }
        this.currentMode = 'login'; // 'login' or 'register'
        
        console.log('AuthUI初期化');
    }

    // 認証画面を表示
    showAuthScreen() {
        const app = document.getElementById('app');
        const html = this.getAuthHTML();
        console.log('Generated HTML length:', html.length);
        console.log('Generated HTML preview:', html.substring(0, 200) + '...');
        app.innerHTML = html;
        this.bindEvents();
        
        console.log('認証画面を表示');
        console.log('App element content after update:', app.innerHTML.length);
    }

    // 認証画面のHTML
    getAuthHTML() {
        return `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-header">
                        <h1 style="color: #333; margin-bottom: 10px;">LazyChillRoom</h1>
                        <p style="color: #666; font-size: 16px; margin: 0;">だらだらまったりチャットアプリ</p>
                    </div>
                    
                    <div class="auth-tabs">
                        <button class="auth-tab ${this.currentMode === 'login' ? 'active' : ''}" data-mode="login">
                            ログイン
                        </button>
                        <button class="auth-tab ${this.currentMode === 'register' ? 'active' : ''}" data-mode="register">
                            新規登録
                        </button>
                    </div>
                    
                    <form id="authForm" class="auth-form" name="authForm" style="display: block; margin-top: 20px;">
                        ${this.currentMode === 'register' ? `
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="userId" style="display: block; margin-bottom: 5px;">ユーザーID（半角英数字・アンダーバー・ハイフン、3文字以上）</label>
                                <input type="text" id="userId" name="userId" required autocomplete="username" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;" placeholder="shadow_knight">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="password" style="display: block; margin-bottom: 5px;">パスワード</label>
                                <div style="position: relative;">
                                    <input type="password" id="password" name="password" required autocomplete="new-password" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; padding-right: 45px;">
                                    <button type="button" id="generatePassword" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #007bff; color: white; border: none; border-radius: 3px; padding: 5px 8px; font-size: 12px; cursor: pointer;" title="パスワード自動生成">🎲</button>
                                </div>
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="confirmPassword" style="display: block; margin-bottom: 5px;">パスワード確認</label>
                                <input type="password" id="confirmPassword" name="confirmPassword" required autocomplete="new-password" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="nickname" style="display: block; margin-bottom: 5px;">ニックネーム（日本語入力可）</label>
                                <input type="text" id="nickname" name="nickname" required autocomplete="given-name" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;" placeholder="夜空の騎士">
                            </div>
                        ` : `
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="loginId" style="display: block; margin-bottom: 5px;">ユーザーID</label>
                                <input type="text" id="loginId" name="loginId" required autocomplete="username" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="password" style="display: block; margin-bottom: 5px;">パスワード</label>
                                <input type="password" id="password" name="password" required autocomplete="current-password" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                        `}
                        
                        <button type="submit" class="auth-submit" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 5px; cursor: pointer;">
                            ${this.currentMode === 'login' ? 'ログイン' : '新規登録'}
                        </button>
                    </form>
                    
                    <div id="authError" class="auth-error" style="display: none;"></div>
                </div>
            </div>
        `;
    }

    // イベントバインド
    bindEvents() {
        // タブ切り替え
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentMode = e.target.dataset.mode;
                this.showAuthScreen();
            });
        });

        // フォーム送信
        document.getElementById('authForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });

        // パスワード自動生成ボタンのイベントリスナー
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'generatePassword') {
                this.generatePassword();
            }
        });
    }

    // フォーム送信処理
    async handleFormSubmit() {
        const form = document.getElementById('authForm');
        const formData = new FormData(form);
        
        let loginId, userId, password, confirmPassword, nickname;
        
        if (this.currentMode === 'register') {
            userId = formData.get('userId');
            password = formData.get('password');
            confirmPassword = formData.get('confirmPassword');
            nickname = formData.get('nickname');
            
            // ユーザーIDのバリデーション
            if (!userId || userId.length < 3) {
                this.showError('ユーザーIDは3文字以上で入力してください');
                return;
            }
            
            if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
                this.showError('ユーザーIDは半角英数字・アンダーバー・ハイフンのみで入力してください');
                return;
            }
            
            // パスワード確認
            if (password !== confirmPassword) {
                this.showError('パスワードが一致しません');
                return;
            }
            
            if (password.length < 6) {
                this.showError('パスワードは6文字以上で入力してください');
                return;
            }
            
            // ニックネームのバリデーション
            if (!nickname || nickname.trim().length === 0) {
                this.showError('ニックネームを入力してください');
                return;
            }
        } else {
            loginId = formData.get('loginId');
            password = formData.get('password');
            
            if (!loginId || !password) {
                this.showError('ユーザーIDとパスワードを入力してください');
                return;
            }
        }

        this.showLoading(true);
        this.hideError();

        let result;
        if (this.currentMode === 'login') {
            result = await this.authManager.login(loginId, password);
        } else {
            result = await this.authManager.register(userId, password, nickname);
        }

        this.showLoading(false);

        if (result.success) {
            console.log('認証成功:', result.user);
            // チャット画面へ遷移
            if (window.appLoader) {
                await window.appLoader.showChatView();
            }
        } else {
            this.showError(result.error);
        }
    }

    // エラー表示
    showError(message, type = 'error') {
        const errorElement = document.getElementById('authError');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // タイプに応じて色を変更
        if (type === 'success') {
            errorElement.style.backgroundColor = '#d4edda';
            errorElement.style.color = '#155724';
            errorElement.style.border = '1px solid #c3e6cb';
        } else {
            errorElement.style.backgroundColor = '#f8d7da';
            errorElement.style.color = '#721c24';
            errorElement.style.border = '1px solid #f5c6cb';
        }
    }

    // エラー非表示
    hideError() {
        const errorElement = document.getElementById('authError');
        errorElement.style.display = 'none';
    }

    // ローディング表示
    showLoading(show) {
        const submitButton = document.querySelector('.auth-submit');
        if (show) {
            submitButton.disabled = true;
            submitButton.textContent = '処理中...';
        } else {
            submitButton.disabled = false;
            submitButton.textContent = this.currentMode === 'login' ? 'ログイン' : '新規登録';
        }
    }

    // パスワード自動生成
    generatePassword() {
        const length = 12; // パスワード長
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        
        // 必須文字を含める（小文字、大文字、数字、記号を最低1文字ずつ）
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*';
        
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += symbols[Math.floor(Math.random() * symbols.length)];
        
        // 残りの文字をランダムに生成
        for (let i = 4; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }
        
        // パスワードをシャッフル
        password = password.split('').sort(() => 0.5 - Math.random()).join('');
        
        // フォームに設定
        const passwordField = document.getElementById('password');
        const confirmPasswordField = document.getElementById('confirmPassword');
        
        if (passwordField && confirmPasswordField) {
            passwordField.value = password;
            confirmPasswordField.value = password;
            
            // 生成されたパスワードを一時的に表示（コピーしやすいように）
            passwordField.type = 'text';
            setTimeout(() => {
                passwordField.type = 'password';
            }, 3000); // 3秒後に非表示に戻す
            
            // 成功メッセージ
            this.showError('パスワードが生成されました（3秒後に非表示になります）', 'success');
            setTimeout(() => {
                this.hideError();
            }, 3000);
        }
    }
}

// グローバルインスタンス
window.AuthManager = AuthManager;
window.AuthUI = AuthUI;
