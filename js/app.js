// アプリケーションメインエントリーポイント
class AppLoader {
    constructor() {
        this.loadedScripts = new Set();
        this.loadingPromises = new Map();
        this.app = null;
    }

    // CSSファイルを動的に読み込む
    async loadCSS(href) {
        return new Promise((resolve, reject) => {
            // 既に読み込まれているかチェック
            const existingLink = document.querySelector(`link[href="${href}"]`);
            if (existingLink) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
            document.head.appendChild(link);
        });
    }

    // JavaScriptファイルを動的に読み込む
    async loadScript(src) {
        if (this.loadedScripts.has(src)) {
            return Promise.resolve();
        }

        if (this.loadingPromises.has(src)) {
            return this.loadingPromises.get(src);
        }

        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                this.loadedScripts.add(src);
                resolve();
            };
            script.onerror = () => {
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });

        this.loadingPromises.set(src, promise);
        return promise;
    }

    // 複数のスクリプトを順次読み込む
    async loadScripts(scripts) {
        for (let i = 0; i < scripts.length; i++) {
            const script = scripts[i];
            try {
                this.updateLoadingProgress(i + 1, scripts.length, `${script}を読み込み中...`);
                await this.loadScript(script);
                console.log(`✓ Loaded: ${script}`);
            } catch (error) {
                console.error(`✗ Failed to load: ${script}`, error);
                throw error;
            }
        }
        console.log('✓ すべてのJavaScriptファイルの読み込みが完了しました');
    }

    // アプリケーションの初期化
    async init() {
        try {
            // ローディング表示
            this.showLoading();

            // 必要なCSSファイルを読み込み（順序重要）
            const cssFiles = [
                'css/style.css',     // 基本スタイル（最初）
                'css/auth.css',      // 認証画面スタイル
                'css/chat.css'       // チャット画面スタイル
            ];

            console.log('CSS読み込み開始...');
            for (const css of cssFiles) {
                try {
                    await this.loadCSS(css);
                    console.log(`✓ CSS Loaded: ${css}`);
                } catch (error) {
                    console.error(`✗ Failed to load CSS: ${css}`, error);
                    // CSSの読み込み失敗は致命的でないので続行
                }
            }

            console.log('CSS読み込み完了、JavaScript読み込み開始...');

            // 必要なスクリプトを順序良く読み込み
            const scripts = [
                'js/utils/TimeUtils.js',           // ユーティリティ（最初）
                'js/managers/MessageManager.js',   // メッセージ管理
                'js/managers/ChatManager.js',      // チャット管理
                'js/managers/ChannelManager.js',   // チャンネル管理
                'js/polling.js',                   // ポーリング機能
                'js/ui/UIComponents.js',           // UI部品
                'js/ui/ChatUI.js',                 // チャット画面UI
                'js/auth.js'                       // 認証機能（最後）
            ];

            await this.loadScripts(scripts);

            // クラスの存在を確認
            this.validateRequiredClasses();

            // ログイン状態をチェックして適切な画面を表示
            await this.checkAuthAndInitialize();

            // ローディングを非表示
            this.hideLoading();

        } catch (error) {
            console.error('アプリケーションの初期化に失敗しました:', error);
            this.showError('アプリケーションの読み込みに失敗しました。ページを再読み込みしてください。');
        }
    }

    // 必要なクラスの存在を確認
    validateRequiredClasses() {
        const requiredClasses = [
            'TimeUtils',
            'MessageManager', 
            'ChatManager',
            'ChannelManager',
            'UIComponents',
            'ChatUI',
            'AuthManager',
            'AuthUI'
        ];

        // ポーリング関連のグローバルオブジェクトも確認
        const requiredGlobals = [
            'pollingManager',
            'typingIndicator'
        ];

        const missingClasses = requiredClasses.filter(className => 
            typeof window[className] === 'undefined'
        );

        const missingGlobals = requiredGlobals.filter(globalName => 
            typeof window[globalName] === 'undefined'
        );

        const allMissing = [...missingClasses, ...missingGlobals];

        if (allMissing.length > 0) {
            throw new Error(`必要なクラス/グローバル変数が見つかりません: ${allMissing.join(', ')}`);
        }

        console.log('✓ すべての必要なクラスとグローバル変数が読み込まれました');
    }

    // ログイン状態をチェックして適切な画面を初期化
    async checkAuthAndInitialize() {
        const authToken = localStorage.getItem('authToken');
        const currentUser = localStorage.getItem('currentUser');

        if (authToken && currentUser) {
            console.log('保存されたログイン情報を発見...');
            
            try {
                // トークンの有効性を確認
                const isValid = await this.validateAuthToken(authToken);
                
                if (isValid) {
                    console.log('✓ ログイン状態が有効です。チャット画面を表示します。');
                    this.showChatView();
                    return;
                } else {
                    console.log('⚠️ ログイン状態が無効です。認証画面を表示します。');
                    // 無効なトークンをクリア
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('currentUser');
                }
            } catch (error) {
                console.error('ログイン状態の確認に失敗:', error);
                // エラー時もトークンをクリア
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
            }
        }

        // ログインしていない場合は認証画面を表示
        if (typeof AuthUI !== 'undefined') {
            this.app = new AuthUI();
            console.log('✓ 認証画面が正常に初期化されました');
        } else {
            throw new Error('AuthUIクラスが見つかりません');
        }
    }

    // トークンの有効性を確認
    async validateAuthToken(token) {
        try {
            const response = await fetch('/api/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'check' })
            });

            if (response.ok) {
                const data = await response.json();
                return data.success;
            }
            return false;
        } catch (error) {
            console.error('トークン検証エラー:', error);
            return false;
        }
    }

    // ローディング画面を表示
    showLoading() {
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <div class="loading-text">LazyChillRoomを読み込み中...</div>
                <div class="loading-progress">
                    <div class="loading-bar"></div>
                </div>
            </div>
        `;

        // ローディング用のスタイルを追加
        if (!document.getElementById('loading-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-styles';
            style.textContent = `
                .loading-screen {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .loading-spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 20px;
                }

                .loading-text {
                    font-size: 18px;
                    font-weight: 500;
                    margin-bottom: 20px;
                }

                .loading-progress {
                    width: 200px;
                    height: 4px;
                    background-color: rgba(255, 255, 255, 0.3);
                    border-radius: 2px;
                    overflow: hidden;
                }

                .loading-bar {
                    height: 100%;
                    background-color: white;
                    width: 0%;
                    animation: progress 3s ease-in-out infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes progress {
                    0% { width: 0%; }
                    50% { width: 70%; }
                    100% { width: 100%; }
                }

                .error-screen {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background-color: #36393f;
                    color: #dcddde;
                    text-align: center;
                    padding: 20px;
                }

                .error-icon {
                    font-size: 48px;
                    color: #f04747;
                    margin-bottom: 20px;
                }

                .error-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #f04747;
                }

                .error-message {
                    font-size: 16px;
                    color: #b9bbbe;
                    max-width: 400px;
                    line-height: 1.5;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ローディング画面を非表示
    hideLoading() {
        const loadingStyles = document.getElementById('loading-styles');
        if (loadingStyles) {
            loadingStyles.remove();
        }
    }

    // エラー画面を表示
    showError(message) {
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = `
            <div class="error-screen">
                <div class="error-icon">⚠️</div>
                <div class="error-title">読み込みエラー</div>
                <div class="error-message">${message}</div>
                <button onclick="location.reload()" class="btn" style="margin-top: 20px; padding: 10px 20px; background-color: #7289da; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    ページを再読み込み
                </button>
            </div>
        `;
    }

    // チャット画面を表示
    async showChatView() {
        if (typeof ChatUI !== 'undefined') {
            this.app = new ChatUI();
            await this.app.init();
            console.log('✓ チャット画面に遷移しました');
        } else {
            console.error('ChatUIクラスが見つかりません');
            this.showError('チャット画面の読み込みに失敗しました');
        }
    }

    // 認証画面を表示
    showAuthView() {
        if (typeof AuthUI !== 'undefined') {
            this.app = new AuthUI();
            console.log('✓ 認証画面に遷移しました');
        } else {
            console.error('AuthUIクラスが見つかりません');
            this.showError('認証画面の読み込みに失敗しました');
        }
    }

    // アプリケーションのインスタンスを取得
    getApp() {
        return this.app;
    }

    // ローディング進捗を更新
    updateLoadingProgress(current, total, text) {
        const loadingText = document.querySelector('.loading-text');
        const loadingBar = document.querySelector('.loading-bar');
        
        if (loadingText) {
            loadingText.textContent = text || `読み込み中... (${current}/${total})`;
        }
        
        if (loadingBar) {
            const percentage = (current / total) * 100;
            loadingBar.style.width = `${percentage}%`;
        }
    }
}

// グローバルスコープに登録
window.AppLoader = AppLoader;

// グローバル変数として appLoader を作成
let appLoader;
let app; // 他のスクリプトからアクセス可能にする

// DOMが読み込まれたらアプリケーションを初期化
document.addEventListener('DOMContentLoaded', async () => {
    appLoader = new AppLoader();
    await appLoader.init();
    window.app = appLoader; // グローバルアクセス用（AppLoaderインスタンス）
});

// デバッグ用のグローバル関数
window.getAppLoader = () => appLoader;
