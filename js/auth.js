// 認証関連の機能
class AuthManager {
    constructor() {
        this.apiBase = '/api';
        this.currentUser = null;
        this.token = localStorage.getItem('authToken');
        
        // 初期化時にログイン状態を確認
        this.checkAuthStatus();
    }

    // 認証状態の確認
    async checkAuthStatus() {
        if (this.token) {
            try {
                const response = await fetch(`${this.apiBase}/auth.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ action: 'check' })
                });

                const data = await response.json();
                if (data.success) {
                    this.currentUser = data.user;
                    return true;
                } else {
                    this.logout();
                    return false;
                }
            } catch (error) {
                console.error('認証確認エラー:', error);
                this.logout();
                return false;
            }
        }
        return false;
    }

    // ログイン
    async login(email, password) {
        try {
            const response = await fetch(`${this.apiBase}/auth.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'login',
                    email: email,
                    password: password
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.message || data.error };
            }
        } catch (error) {
            console.error('ログインエラー:', error);
            return { success: false, error: 'ネットワークエラーが発生しました' };
        }
    }

    // 新規登録
    async register(username, email, password) {
        try {
            const response = await fetch(`${this.apiBase}/auth.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'register',
                    username: username,
                    email: email,
                    password: password
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // 新規登録成功時にトークンがある場合は自動ログイン
                if (data.token) {
                    this.token = data.token;
                    this.currentUser = data.user;
                    localStorage.setItem('authToken', this.token);
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    return { success: true, message: 'アカウントが作成され、ログインしました', autoLogin: true };
                } else {
                    return { success: true, message: 'アカウントが作成されました' };
                }
            } else {
                return { success: false, error: data.message || data.error };
            }
        } catch (error) {
            console.error('登録エラー:', error);
            return { success: false, error: 'ネットワークエラーが発生しました' };
        }
    }

    // ログアウト
    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
    }

    // 認証済みかチェック
    isAuthenticated() {
        return this.token && this.currentUser;
    }

    // 現在のユーザー情報を取得
    getCurrentUser() {
        return this.currentUser;
    }

    // 認証トークンを取得
    getToken() {
        return this.token;
    }
}

// 認証UI管理クラス
class AuthUI {
    constructor() {
        this.authManager = new AuthManager();
        this.currentTab = 'login';
        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
    }

    // 認証画面のHTML生成
    render() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-logo">
                        <h1>LazyChillRoom</h1>
                        <p>お帰りなさい！</p>
                    </div>

                    <div class="auth-tabs">
                        <button class="auth-tab active" data-tab="login">ログイン</button>
                        <button class="auth-tab" data-tab="register">新規登録</button>
                    </div>

                    <div class="error-message" id="error-message"></div>
                    <div class="success-message" id="success-message"></div>

                    <!-- ログインフォーム -->
                    <form class="auth-form active" id="login-form" autocomplete="on">
                        <div class="form-group">
                            <label class="form-label">メールアドレス</label>
                            <input type="email" class="form-input" name="email" placeholder="user@example.com" required autocomplete="email">
                        </div>
                        <div class="form-group">
                            <label class="form-label">パスワード</label>
                            <div class="password-container">
                                <input type="password" class="form-input" name="password" placeholder="パスワードを入力" required autocomplete="current-password">
                                <button type="button" class="password-toggle" data-target="password">👁️</button>
                            </div>
                        </div>
                        <button type="submit" class="auth-button">ログイン</button>
                    </form>

                    <!-- 新規登録フォーム -->
                    <form class="auth-form" id="register-form" autocomplete="on">
                        <div class="form-group">
                            <label class="form-label">メールアドレス</label>
                            <input type="email" class="form-input" name="email" placeholder="user@example.com" required autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label class="form-label">パスワード</label>
                            <div class="password-container">
                                <input type="password" class="form-input" name="password" placeholder="パスワードを入力" required minlength="6" autocomplete="new-password">
                                <button type="button" class="password-toggle" data-target="password">👁️</button>
                            </div>
                            <div class="password-strength" id="password-strength">
                                <div class="strength-bar">
                                    <div class="strength-fill" id="strength-fill"></div>
                                </div>
                                <div class="strength-text" id="strength-text">パスワードの強度</div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">パスワード確認</label>
                            <div class="password-container">
                                <input type="password" class="form-input" name="confirmPassword" placeholder="パスワードを再入力" required minlength="6" autocomplete="new-password">
                                <button type="button" class="password-toggle" data-target="confirmPassword">👁️</button>
                            </div>
                            <div class="password-match" id="password-match" style="display: none;">
                                <div class="match-text" id="match-text"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">ユーザー名（日本語も使用できます）</label>
                            <input type="text" class="form-input" name="username" placeholder="ユーザー名" required autocomplete="name">
                        </div>
                        <button type="submit" class="auth-button">アカウント作成</button>
                    </form>

                    <div class="auth-footer">
                        <a href="#" class="auth-link">パスワードを忘れた場合</a>
                    </div>
                </div>
            </div>
        `;
    }

    // イベントバインド
    bindEvents() {
        // タブ切り替え
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // パスワード表示切り替え
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                this.togglePasswordVisibility(e.target);
            });
        });

        // フォーム送信
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e.target);
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister(e.target);
        });

        // パスワード強度チェック
        const registerPasswordInput = document.querySelector('#register-form input[name="password"]');
        if (registerPasswordInput) {
            registerPasswordInput.addEventListener('input', (e) => {
                this.checkPasswordStrength(e.target.value);
                this.checkPasswordMatch(); // パスワード確認もチェック
            });
        }

        // パスワード確認チェック
        const confirmPasswordInput = document.querySelector('#register-form input[name="confirmPassword"]');
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => {
                this.checkPasswordMatch();
            });
        }
    }

    // タブ切り替え
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // タブのアクティブ状態を更新
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // フォームの表示切り替え
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tabName}-form`);
        });

        // メッセージをクリア
        this.clearMessages();

        // ロゴのテキストを更新
        const logoText = document.querySelector('.auth-logo p');
        logoText.textContent = tabName === 'login' ? 'お帰りなさい！' : 'アカウントを作成しましょう';
    }

    // パスワード表示切り替え
    togglePasswordVisibility(button) {
        const container = button.closest('.password-container');
        const input = container.querySelector('input');
        
        if (input.type === 'password') {
            input.type = 'text';
            button.textContent = '🙈';
        } else {
            input.type = 'password';
            button.textContent = '👁️';
        }
    }

    // パスワード強度チェック
    checkPasswordStrength(password) {
        const strengthContainer = document.getElementById('password-strength');
        const strengthFill = document.getElementById('strength-fill');
        const strengthText = document.getElementById('strength-text');

        if (password.length === 0) {
            strengthContainer.classList.remove('show');
            return;
        }

        strengthContainer.classList.add('show');

        let strength = 0;
        let strengthLabel = '';

        // 長さチェック
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;

        // 文字種チェック
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        // 強度の判定
        strengthFill.className = 'strength-fill';
        if (strength <= 2) {
            strengthFill.classList.add('weak');
            strengthLabel = '弱い';
        } else if (strength <= 4) {
            strengthFill.classList.add('fair');
            strengthLabel = '普通';
        } else if (strength <= 5) {
            strengthFill.classList.add('good');
            strengthLabel = '良い';
        } else {
            strengthFill.classList.add('strong');
            strengthLabel = '強い';
        }

        strengthText.textContent = `パスワードの強度: ${strengthLabel}`;
    }

    // パスワード確認チェック
    checkPasswordMatch() {
        const passwordInput = document.querySelector('#register-form input[name="password"]');
        const confirmPasswordInput = document.querySelector('#register-form input[name="confirmPassword"]');
        const matchContainer = document.getElementById('password-match');
        const matchText = document.getElementById('match-text');

        if (!passwordInput || !confirmPasswordInput || !matchContainer || !matchText) return;

        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (confirmPassword.length === 0) {
            matchContainer.style.display = 'none';
            return;
        }

        matchContainer.style.display = 'block';

        if (password === confirmPassword) {
            matchContainer.className = 'password-match success';
            matchText.textContent = 'パスワードが一致しています';
        } else {
            matchContainer.className = 'password-match error';
            matchText.textContent = 'パスワードが一致しません';
        }
    }

    // ログイン処理
    async handleLogin(form) {
        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');

        // バリデーション
        if (!email || !password) {
            this.showError('メールアドレスとパスワードを入力してください');
            return;
        }

        // ボタンをローディング状態に
        const submitButton = form.querySelector('.auth-button');
        submitButton.classList.add('loading');
        submitButton.disabled = true;

        try {
            const result = await this.authManager.login(email, password);

            if (result.success) {
                this.showSuccess('ログインしました');
                
                // チャット画面に遷移
                setTimeout(async () => {
                    await window.app.showChatView();
                }, 1000);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('ログインに失敗しました');
        } finally {
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        }
    }

    // 新規登録処理
    async handleRegister(form) {
        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const username = formData.get('username');

        // バリデーション
        if (!email || !password || !confirmPassword || !username) {
            this.showError('すべての項目を入力してください');
            return;
        }

        if (password.length < 6) {
            this.showError('パスワードは6文字以上で入力してください');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('パスワードが一致しません');
            return;
        }

        // ユーザー名の長さチェック（日本語対応）
        if (username.length < 1 || username.length > 50) {
            this.showError('ユーザー名は1文字以上50文字以下で入力してください');
            return;
        }

        // ボタンをローディング状態に
        const submitButton = form.querySelector('.auth-button');
        submitButton.classList.add('loading');
        submitButton.disabled = true;

        try {
            const result = await this.authManager.register(username, email, password);

            if (result.success) {
                if (result.autoLogin) {
                    // 自動ログインされた場合
                    this.showSuccess('アカウントが作成され、ログインしました');
                    
                    // チャット画面に遷移
                    setTimeout(async () => {
                        await window.app.showChatView();
                    }, 1000);
                } else {
                    // 手動ログインが必要な場合
                    this.showSuccess('アカウントが作成されました。ログインしてください。');
                    
                    // ログインタブに切り替え
                    setTimeout(() => {
                        this.switchTab('login');
                        // メールアドレスを自動入力
                        document.querySelector('#login-form input[name="email"]').value = email;
                    }, 2000);
                }
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('登録に失敗しました');
        } finally {
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        }
    }

    // エラーメッセージ表示
    showError(message) {
        const errorElement = document.getElementById('error-message');
        const successElement = document.getElementById('success-message');
        
        successElement.classList.remove('show');
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }

    // 成功メッセージ表示
    showSuccess(message) {
        const errorElement = document.getElementById('error-message');
        const successElement = document.getElementById('success-message');
        
        errorElement.classList.remove('show');
        successElement.textContent = message;
        successElement.classList.add('show');
    }

    // メッセージクリア
    clearMessages() {
        document.getElementById('error-message').classList.remove('show');
        document.getElementById('success-message').classList.remove('show');
    }
}

// グローバルスコープに登録
window.AuthManager = AuthManager;
window.AuthUI = AuthUI;
