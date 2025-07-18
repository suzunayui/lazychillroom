// アプリケーションメインエントリーポイント
class AppLoader {
    constructor() {
        this.loadedScripts = new Set();
        this.loadingPromises = new Map();
        this.app = null;
        this.maxRetries = 3;
        this.currentRetries = 0;
        this.isLoading = false;
        this.isLoadingScripts = false; // loadScripts重複実行防止
        
        // デバッグ用：5秒後に状態をログ出力
        setTimeout(() => {
            console.log('🔍 AppLoader状態デバッグ:');
            console.log('  - 読み込み済みスクリプト:', Array.from(this.loadedScripts));
            console.log('  - 読み込み中スクリプト:', Array.from(this.loadingPromises.keys()));
            console.log('  - 現在のリトライ回数:', this.currentRetries);
            console.log('  - loadScripts実行中:', this.isLoadingScripts);
        }, 5000);
        
        // さらなるデバッグ：10秒後の詳細状態
        setTimeout(() => {
            console.log('🔍 AppLoader詳細デバッグ（10秒後）:');
            console.log('  - AppLoaderインスタンス:', this);
            console.log('  - 初期化フラグ:', window.appLoaderInitialized, window.appLoaderInitializing);
            console.log('  - DOM上のscriptタグ数:', document.querySelectorAll('script').length);
            
            // 無限ループの兆候を検出
            if (this.loadingPromises.size > 0) {
                console.warn('⚠️ 10秒経っても読み込み中のスクリプトがあります:', Array.from(this.loadingPromises.keys()));
            }
            if (this.isLoadingScripts) {
                console.error('🔥 10秒経ってもloadScriptsが実行中です！無限ループの可能性があります');
            }
        }, 10000);
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

    // JavaScriptファイルを動的に読み込む（無限ループ防止版・強化版）
    async loadScript(src) {
        // ループ検出：同じスクリプトの連続読み込み試行を検出
        const now = Date.now();
        const lastLoadKey = `lastLoad_${src}`;
        const lastLoadTime = this[lastLoadKey] || 0;
        if (now - lastLoadTime < 100) { // 100ms以内の再読み込みは異常
            console.error(`🔥 無限ループ検出: ${src} が短時間で再読み込みされました`);
            return Promise.reject(new Error(`Infinite loop detected for script: ${src}`));
        }
        this[lastLoadKey] = now;
        
        // 重複読み込み防止
        if (this.loadedScripts.has(src)) {
            console.log(`📋 Already loaded: ${src}`);
            return Promise.resolve();
        }

        // 同時読み込み防止
        if (this.loadingPromises.has(src)) {
            console.log(`⏳ Already loading: ${src}`);
            return this.loadingPromises.get(src);
        }

        const promise = new Promise((resolve, reject) => {
            // スクリプト要素が既に存在するかチェック
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                this.loadedScripts.add(src);
                console.log(`📋 Script already exists in DOM: ${src}`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            
            script.onload = () => {
                this.loadedScripts.add(src);
                this.loadingPromises.delete(src); // プロミスをクリア
                console.log(`✓ Successfully loaded: ${src}`);
                resolve();
            };
            
            script.onerror = (error) => {
                this.loadingPromises.delete(src); // プロミスをクリア
                console.error(`✗ Failed to load script: ${src}`);
                console.error(`Error event:`, error);
                console.error(`Script element:`, script);
                console.error(`Script src:`, script.src);
                
                // HTTPステータスをチェック（可能であれば）
                fetch(src, { method: 'HEAD' })
                    .then(response => {
                        console.error(`HTTP status for ${src}:`, response.status);
                        if (!response.ok) {
                            console.error(`HTTP error: ${response.status} ${response.statusText}`);
                        }
                    })
                    .catch(fetchError => {
                        console.error(`Fetch error for ${src}:`, fetchError);
                    })
                    .finally(() => {
                        reject(new Error(`Failed to load script: ${src} - Check console for details`));
                    });
            };
            
            console.log(`📥 Starting to load: ${src}`);
            document.head.appendChild(script);
        });

        this.loadingPromises.set(src, promise);
        return promise;
    }

    // 複数のスクリプトを順次読み込む（安定性向上版）
    async loadScripts(scripts) {
        console.log(`� loadScripts開始 - ${scripts.length}個のスクリプトを順次読み込み...`);
        console.log('🔍 読み込み予定スクリプトリスト:', scripts);
        
        // loadScripts の重複実行防止
        if (this.isLoadingScripts) {
            console.error('🔥 loadScripts が既に実行中です。重複実行を防止します。');
            throw new Error('loadScripts is already running');
        }
        this.isLoadingScripts = true;
        
        try {
            for (let i = 0; i < scripts.length; i++) {
            const script = scripts[i];
            console.log(`🔄 [${i + 1}/${scripts.length}] スクリプト読み込み開始: ${script}`);
            
            try {
                this.updateLoadingProgress(i + 1, scripts.length, `${script}を読み込み中...`);
                console.log(`📥 [${i + 1}/${scripts.length}] Loading script: ${script}`);
                
                // 基本的なタイムアウトを延長（ネットワークが遅い場合を考慮）
                const baseTimeout = 15000; // 15秒
                const timeout = script.includes('auth') ? 10000 : baseTimeout; // 認証関連は10秒
                console.log(`⏰ タイムアウト設定: ${timeout}ms`);
                
                await Promise.race([
                    this.loadScript(script),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout loading ${script} after ${timeout}ms`)), timeout)
                    )
                ]);
                
                console.log(`✓ [${i + 1}/${scripts.length}] Loaded: ${script}`);
                
            } catch (error) {
                console.warn(`⚠️ スクリプト読み込み失敗: ${script}`, error.message);
                
                // 必須ファイルが失敗した場合のみ特別処理
                const criticalFiles = ['auth.js', 'api.js', 'TimeUtils.js', 'NotificationManager.js', 'ChatUI.js', 'StateManager.js'];
                const isCritical = criticalFiles.some(critical => script.includes(critical));
                
                if (isCritical) {
                    console.error(`❌ 重要なファイル ${script} の読み込みに失敗しました。フォールバック認証を作成します。`);
                    this.isLoadingScripts = false;
                    this.createWorkingFallbackAuth();
                    return; // 残りのスクリプト読み込みを中止
                }
                
                // その他のスクリプトは失敗しても続行
                console.warn(`⚠️ ${script} は必須ではないためスキップして続行します`);
                continue;
            }
        }
        } finally {
            this.isLoadingScripts = false;
        }
        console.log('✅ すべてのJavaScriptファイルの読み込みが完了しました');
    }

    // アプリケーションの初期化
    async init() {
        console.log('🔄 AppLoader.init() 開始...');
        console.log('🔍 初期化状態チェック:');
        console.log('  - isLoading:', this.isLoading);
        console.log('  - currentRetries:', this.currentRetries);
        
        try {
            console.log('🔄 ローディング表示開始...');
            // ローディング表示
            this.showLoading();
            console.log('✅ ローディング表示完了');

            console.log('🔄 CSS読み込み準備...');
            // メインCSSファイルを読み込み（並列処理で高速化）
            const cssFiles = [
                'css/main.css',       // 統合されたメインCSSファイル
                'css/auth.css',       // 認証画面用CSS（優先）
                'css/auth-layout.css' // 認証レイアウト用CSS（優先）
            ];
            
            const additionalCssFiles = [
                'css/modals.css',     // モーダル用CSS
                'css/friends.css'     // フレンド・DM機能用CSS
            ];

            console.log('🔄 CSS読み込み開始...');
            console.log('🔍 読み込み予定CSSファイル:', cssFiles);
            
            // 必須CSSを先に読み込み
            console.log('🔄 必須CSS読み込み中...');
            await Promise.all(cssFiles.map(async css => {
                try {
                    console.log(`📥 CSS読み込み開始: ${css}`);
                    await this.loadCSS(css);
                    console.log(`✅ CSS読み込み完了: ${css}`);
                } catch (error) {
                    console.error(`❌ CSS読み込み失敗: ${css}`, error);
                }
            }));
            console.log('✅ 必須CSS読み込み完了');
            
            // 追加CSSは非同期で読み込み
            console.log('🔄 追加CSS読み込み開始（非同期）...');
            Promise.all(additionalCssFiles.map(async css => {
                try {
                    await this.loadCSS(css);
                    console.log(`✅ 追加CSS読み込み完了: ${css}`);
                } catch (error) {
                    console.warn(`⚠️ 追加CSS読み込み失敗: ${css}`, error);
                }
            }));

            console.log('✅ CSS読み込み完了、JavaScript読み込み開始...');

            // すべての必要なスクリプトを一度に読み込み（安全な方式）
            const allRequiredScripts = [
                // 基本ユーティリティ
                'js/utils/TimeUtils.js',           // ユーティリティ（基本）
                'js/utils/NotificationManager.js', // 通知システム
                
                // 認証・API
                'js/auth.js',                      // 認証機能
                'js/api.js',                       // API通信
                
                // Socket.io管理
                'js/SocketManager.js',             // Socket.io管理
                
                // UI基盤
                'js/ui/UIComponents.js',           // UI部品
                'js/ui/StateManager.js',           // 状態管理
                'js/ui/UIUtils.js',                // UI共通機能
                'js/ui/EventHandler.js',           // イベント処理
                
                // 管理系
                'js/managers/MessageManager.js',   // メッセージ管理
                'js/managers/ChatManager.js',      // チャット管理
                'js/managers/ChannelManager.js',   // チャンネル管理
                
                // UI画面
                'js/ui/SettingsHandler.js',        // 設定ハンドラー
                'js/ui/ServerManager.js',          // サーバー管理
                'js/ui/ChatUI.js',                 // チャット画面UI
                
                // リアルタイム通信
                'js/realtime.js',                  // リアルタイム通信機能
                
                // オプション機能（エラーがあっても続行）
                'js/managers/TypingManager.js',    // タイピング管理
                'js/managers/DMManager.js',        // DM管理
                'js/managers/FriendsManager.js',   // フレンド管理
                'js/managers/ReactionManager.js',  // リアクション管理
                'js/managers/PresenceManager.js',  // プレゼンス管理
                'js/ui/FileUploadHandler.js',      // ファイルアップロード
                'js/ui/FriendsUI.js',              // フレンド・DM UI
                'js/settings.js'                   // 設定機能
            ];

            console.log('🔄 全スクリプト読み込み準備...');
            console.log('🔍 読み込み予定スクリプト数:', allRequiredScripts.length);
            
            // 基本ユーティリティクラスのフォールバックを事前に準備
            console.log('🔄 基本ユーティリティフォールバック準備中...');
            this.createBasicUtilityFallbacks();
            console.log('✅ 基本ユーティリティフォールバック準備完了');
            
            try {
                console.log('🔄 全スクリプト読み込み開始...');
                await this.loadScripts(allRequiredScripts);
                console.log('✅ 全スクリプト読み込み完了');
            } catch (error) {
                console.error('❌ スクリプト読み込み失敗:', error);
                console.error('❌ エラースタック:', error.stack);
                // スクリプトの読み込みに失敗した場合は即座にフォールバック認証を作成
                console.log('🛠️ フォールバック認証を作成します');
                this.createWorkingFallbackAuth();
                return; // 初期化を中断してフォールバック認証に任せる
            }

            // APIクライアントが存在しない場合はフォールバックを作成
            if (!window.apiClient) {
                console.log('APIクライアントが見つかりません。フォールバックを作成します。');
                this.createFallbackAPI();
            }

            // 認証に必要な最小限のクラスを確認
            this.validateAuthClasses();
            
            // 必要なクラスが不足している場合はフォールバック認証を作成
            const requiredAuthClasses = ['AuthManager', 'AuthUI'];
            const missingAuthClasses = requiredAuthClasses.filter(className => typeof window[className] === 'undefined');
            
            if (missingAuthClasses.length > 0) {
                console.error('❌ 必要な認証クラスが不足しています:', missingAuthClasses);
                this.createWorkingFallbackAuth();
                return; // 初期化を中断してフォールバック認証に任せる
            }

            // ログイン状態をチェックして適切な画面を表示
            await this.checkAuthAndInitialize();

        } catch (error) {
            console.error('❌ アプリケーションの初期化に失敗しました:', error);
            console.error('❌ エラースタック:', error.stack);
            
            // エラーの詳細を表示
            console.log('🔍 エラー詳細:');
            console.log('  - エラータイプ:', error.constructor.name);
            console.log('  - エラーメッセージ:', error.message);
            
            // どんなエラーでもフォールバック認証を表示
            console.log('🛠️ フォールバック認証システムを起動します');
            try {
                this.createWorkingFallbackAuth();
            } catch (fallbackError) {
                console.error('❌ フォールバック認証作成も失敗:', fallbackError);
                // 最後の手段として簡単なエラー画面を表示
                this.showError('アプリケーションの読み込みに失敗しました。ページを再読み込みしてください。');
            }
        } finally {
            // 初期化が成功・失敗に関わらず、ローディングを非表示
            // ただし、少し遅延させて認証画面の表示を完了させる
            setTimeout(() => {
                this.hideLoading();
            }, 100);
        }
    }

    // 必要なクラスの存在を確認
    validateRequiredClasses() {
        const requiredClasses = [
            'TimeUtils',
            'NotificationManager',
            'MessageManager', 
            'ChatManager',
            'ChannelManager',
            'TypingManager',
            'DMManager',
            'FriendsManager',
            'ReactionManager',
            'UIComponents',
            'StateManager',
            'SettingsHandler',
            'FileUploadHandler',
            'ServerManager',
            'FriendsUI',
            'UIUtils',
            'EventHandler',
            'ChatUI',
            'AuthManager',
            'AuthUI'
        ];

        // リアルタイム通信関連のグローバルオブジェクト
        const requiredGlobals = [
            'socketManager',
            'realtimeManager'
        ];

        console.log('=== クラス検証開始 ===');
        console.log('利用可能なクラス:', Object.keys(window).filter(key => typeof window[key] === 'function'));

        const missingClasses = [];
        const existingClasses = [];

        requiredClasses.forEach(className => {
            if (typeof window[className] === 'undefined') {
                missingClasses.push(className);
                console.error(`❌ クラスが見つかりません: ${className}`);
            } else {
                existingClasses.push(className);
                console.log(`✅ クラス確認: ${className}`);
            }
        });

        const missingGlobals = [];
        const existingGlobals = [];

        requiredGlobals.forEach(globalName => {
            if (typeof window[globalName] === 'undefined') {
                missingGlobals.push(globalName);
                console.error(`❌ グローバル変数が見つかりません: ${globalName}`);
            } else {
                existingGlobals.push(globalName);
                console.log(`✅ グローバル変数確認: ${globalName}`);
            }
        });

        const allMissing = [...missingClasses, ...missingGlobals];

        if (allMissing.length > 0) {
            console.warn(`一部のクラス/グローバル変数が見つかりません: ${allMissing.join(', ')}`);
            console.log('これらは後で初期化される可能性があります');
        }

        console.log('✓ 基本的なクラスとグローバル変数の確認が完了しました');
    }

    // 認証に必要なクラスの存在を確認
    validateAuthClasses() {
        const requiredClasses = [
            'TimeUtils',
            'NotificationManager',
            'AuthUI',
            'AuthManager'
        ];

        console.log('=== 認証クラス検証開始 ===');
        
        const missingClasses = [];
        
        requiredClasses.forEach(className => {
            if (typeof window[className] === 'undefined') {
                missingClasses.push(className);
                console.error(`❌ 認証クラスが見つかりません: ${className}`);
            } else {
                console.log(`✅ 認証クラス確認: ${className}`);
            }
        });

        if (missingClasses.length > 0) {
            console.warn(`認証に必要なクラスが不足: ${missingClasses.join(', ')}`);
        }

        console.log('✓ 認証クラスの確認が完了しました');
    }

    // ログイン状態をチェックして適切な画面を初期化（デバッグ強化版）
    async checkAuthAndInitialize() {
        console.log('🔍 認証状態確認開始...');
        console.log('🔍 利用可能なクラス:', Object.keys(window).filter(key => typeof window[key] === 'function'));
        console.log('🔍 AuthManager存在確認:', typeof window.AuthManager);
        console.log('🔍 AuthUI存在確認:', typeof window.AuthUI);

        try {
            // AuthManagerクラスが利用可能かチェック
            if (window.AuthManager) {
                console.log('✅ AuthManagerクラスが利用可能です');
                const authManager = new window.AuthManager();
                console.log('✅ AuthManagerインスタンス作成完了');
                
                try {
                    const isAuthenticated = await authManager.checkAuthStatus();
                    console.log('🔍 認証状態チェック結果:', isAuthenticated);
                    
                    if (isAuthenticated) {
                        console.log('✓ ログイン状態が有効です。チャット画面を表示します。');
                        
                        // 保存された状態があるかチェック
                        const savedState = localStorage.getItem('chatUI_state');
                        if (savedState) {
                            console.log('✓ 前回の状態が見つかりました。復元を試行します。');
                        } else {
                            console.log('💡 初回起動またはクリア済みです。');
                        }
                        
                        await this.showChatView();
                        return;
                    }
                } catch (authError) {
                    console.error('❌ AuthManager.checkAuthStatus()でエラー:', authError);
                    throw authError;
                }
            } else {
                console.warn('⚠️ AuthManagerクラスが見つかりません');
            }
            
            // 認証されていない場合は認証画面を表示
            console.log('🔄 認証画面を表示します。');
            this.showAuthScreen();
            
        } catch (error) {
            console.error('❌ 認証状態の確認に失敗:', error);
            console.error('❌ エラースタック:', error.stack);
            
            // ネットワークエラーの場合は保存された状態を確認
            const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
            const currentUser = localStorage.getItem('currentUser');
            
            console.log('🔍 フォールバック認証情報チェック:');
            console.log('  - Token存在:', !!token);
            console.log('  - CurrentUser存在:', !!currentUser);
            console.log('  - Online状態:', navigator.onLine);
            console.log('  - エラーの種類:', error.constructor.name);
            
            // ネットワークエラーまたは一時的なエラーで認証情報がある場合
            if (token && currentUser && (
                error.isNetworkError ||
                error.message.includes('ネットワーク') ||
                error.message.includes('Failed to fetch') ||
                !navigator.onLine ||
                error.status >= 500
            )) {
                console.log('⚠️ ネットワークエラーですが、認証情報があるためチャット画面を表示します');
                try {
                    await this.showChatView();
                } catch (chatError) {
                    console.error('❌ チャット画面表示でもエラー:', chatError);
                    console.log('🛠️ フォールバック認証画面を表示します');
                    this.createWorkingFallbackAuth();
                }
            } else {
                console.log('🛠️ 認証情報がない、または明確な認証エラーのため、フォールバック認証画面を表示します');
                this.createWorkingFallbackAuth();
            }
        }
    }

    // 認証画面を表示（エラーハンドリング強化版）
    showAuthScreen() {
        console.log('🔍 認証画面を表示中...');
        console.log('🔍 AuthUI存在確認:', typeof AuthUI);
        
        // AuthUIが利用可能かチェック
        if (typeof AuthUI !== 'undefined') {
            try {
                console.log('✅ AuthUI クラスが利用可能です');
                this.app = new AuthUI();
                console.log('✅ AuthUI インスタンスが作成されました:', this.app);
                console.log('🔍 showAuthScreen メソッド存在確認:', typeof this.app.showAuthScreen);
                
                if (typeof this.app.showAuthScreen === 'function') {
                    console.log('🔄 AuthUI.showAuthScreen()を実行中...');
                    this.app.showAuthScreen(); // 認証画面を実際に表示
                    console.log('✅ 認証画面が正常に初期化されました');
                    
                    // 2秒後にHTMLが正しく設定されているかチェック
                    setTimeout(() => {
                        const appContainer = document.getElementById('app');
                        if (appContainer && appContainer.innerHTML.length > 100) {
                            console.log('✅ 認証画面のHTMLが正常に設定されました');
                        } else {
                            console.warn('⚠️ 認証画面のHTMLが不完全です。フォールバック認証を使用します。');
                            this.createWorkingFallbackAuth();
                        }
                    }, 2000);
                } else {
                    console.error('❌ showAuthScreen メソッドが見つかりません');
                    this.createWorkingFallbackAuth();
                    return;
                }
            } catch (error) {
                console.error('❌ AuthUI初期化エラー:', error);
                console.error('❌ エラースタック:', error.stack);
                this.createWorkingFallbackAuth();
            }
        } else {
            console.error('❌ AuthUIクラスが見つかりません。フォールバック認証を作成します。');
            this.createWorkingFallbackAuth();
        }
    }

    // トークンの有効性を確認
    async validateAuthToken(token) {
        try {
            console.log('トークン検証開始...');
            
            // ApiClientのトークンを最新の状態に更新
            apiClient.reloadToken();
            
            const result = await apiClient.verifyToken();
            
            if (result.success) {
                console.log('トークン検証成功:', result.user);
                return { success: true, user: result.user };
            } else {
                console.log('トークン検証失敗:', result.message);
                return { success: false, message: result.message };
            }
        } catch (error) {
            console.error('トークン検証エラー:', error);
            return { success: false, message: error.message };
        }
    }

    // ローディング画面を表示
    showLoading() {
        console.log('🔄 ローディング画面表示開始...');
        
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            console.log('✅ loadingScreen要素を表示しました');
        } else {
            console.warn('⚠️ loadingScreen要素が見つかりません');
        }

        // ローディング用のインラインスタイルを追加（フォールバック）
        if (!document.getElementById('loading-styles')) {
            console.log('🔄 ローディング用スタイルを追加中...');
            const style = document.createElement('style');
            style.id = 'loading-styles';
            style.innerHTML = `
                .loading-screen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }

                .loading-content {
                    text-align: center;
                    color: white;
                }

                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(255,255,255,0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px auto;
                }

                .loading-text {
                    font-size: 16px;
                    font-weight: 500;
                }

                .loading-bar {
                    width: 200px;
                    height: 4px;
                    background: rgba(255,255,255,0.3);
                    border-radius: 2px;
                    margin: 10px auto;
                    overflow: hidden;
                }

                .loading-bar-progress {
                    height: 100%;
                    background: white;
                    border-radius: 2px;
                    transition: width 0.3s ease;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            console.log('✅ ローディング用スタイル追加完了');
        } else {
            console.log('📋 ローディング用スタイルは既に存在します');
        }
        
        // ローディングバーの要素を確認
        const loadingBar = document.querySelector('.loading-bar');
        const loadingBarProgress = document.querySelector('.loading-bar-progress');
        const loadingText = document.querySelector('.loading-text');
        console.log('🔍 ローディング要素確認:');
        console.log('  - loadingBar:', !!loadingBar);
        console.log('  - loadingBarProgress:', !!loadingBarProgress);
        console.log('  - loadingText:', !!loadingText);
        
        console.log('✅ ローディング画面表示完了');
    }

    // ローディング画面を非表示
    hideLoading() {
        // 進捗表示をクリア
        this.clearLoadingProgress();
        
        const loadingStyles = document.getElementById('loading-styles');
        if (loadingStyles) {
            loadingStyles.remove();
        }
        
        // ローディング画面を非表示
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        // app要素を表示する
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.style.display = 'block';
        }
        
        console.log('✓ ローディング画面を完全に非表示にしました');
    }

    // エラー画面を表示
    showError(message) {
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = `
            <div class="error-screen">
                <div class="error-icon">⚠️</div>
                <div class="error-title">読み込みエラー</div>
                <div class="error-message">${message}</div>
                <button id="errorReloadBtn" class="btn" style="margin-top: 20px; padding: 10px 20px; background-color: #7289da; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    ページを再読み込み
                </button>
            </div>
        `;
        
        // イベントリスナーを追加
        setTimeout(() => {
            const reloadBtn = document.getElementById('errorReloadBtn');
            if (reloadBtn) {
                reloadBtn.addEventListener('click', () => location.reload());
            }
        }, 0);
        
        // app要素を表示
        appContainer.style.display = 'block';
    }

    // チャット画面を表示
    async showChatView() {
        try {
            console.log('チャット画面を初期化中...');
            
            // ローディング表示
            this.showLoading();
            this.updateLoadingProgress(10, 100, 'チャット画面を初期化中...');
            
            // スクリプトは既に読み込み済みのため、ここでは読み込まない
            console.log('✓ スクリプトは既に読み込み済みです');
            
            this.updateLoadingProgress(50, 100, 'チャット画面を初期化中...');
            
            // NotificationManagerを初期化（まだ存在しない場合）
            if (!window.notificationManager && typeof NotificationManager !== 'undefined') {
                window.notificationManager = new NotificationManager();
            }
            
            // Socket.io接続を初期化
            const token = localStorage.getItem('auth_token');
            if (token && typeof SocketManager !== 'undefined') {
                try {
                    console.log('Socket.io接続を初期化中...');
                    if (!window.socketManager) {
                        window.socketManager = new SocketManager();
                    }
                    await window.socketManager.connect(token);
                    window.socketManager.setupAllEvents();
                    console.log('✓ Socket.io接続が完了しました');
                } catch (error) {
                    console.error('Socket.io接続に失敗:', error);
                    // Socket.io接続に失敗してもチャット画面は表示
                }
            }
            
            this.updateLoadingProgress(90, 100, 'UI初期化中...');
            
            // ChatUIに必要なクラスが読み込まれているか確認
            const requiredClasses = [
                'ChatUI', 'StateManager', 'SettingsHandler', 'FileUploadHandler', 
                'UIUtils', 'EventHandler', 'ChatManager', 'ChannelManager', 'ServerManager'
            ];
            
            const missingClasses = requiredClasses.filter(className => typeof window[className] === 'undefined');
            
            if (missingClasses.length > 0) {
                throw new Error(`必要なクラスが読み込まれていません: ${missingClasses.join(', ')}`);
            }
            
            const chatUI = new ChatUI();
            await chatUI.init();
            this.app = chatUI;
            
            this.hideLoading();
            console.log('✓ チャット画面が正常に初期化されました');
        } catch (error) {
            this.hideLoading();
            console.error('チャット画面の初期化に失敗:', error);
            this.showError('チャット画面の初期化に失敗しました: ' + error.message);
        }
    }

    // 認証後にチャット関連のスクリプトを読み込む（廃止予定 - 現在は初期化時に全て読み込み済み）
    async loadChatScripts() {
        console.log('⚠️ loadChatScripts: この機能は廃止されました。スクリプトは既に読み込み済みです。');
        return true; // 互換性のため成功を返す
    }

    // アプリケーションのインスタンスを取得
    getApp() {
        return this.app;
    }

    // ローディング進捗を更新
    updateLoadingProgress(current, total, text) {
        try {
            console.log(`📊 進捗更新: ${current}/${total} - ${text}`);
            
            const loadingText = document.querySelector('.loading-text');
            const loadingBarProgress = document.querySelector('.loading-bar-progress');
            
            if (loadingText) {
                loadingText.textContent = text || `読み込み中... (${current}/${total})`;
                console.log(`📊 ローディングテキスト更新: ${loadingText.textContent}`);
            } else {
                console.warn('⚠️ .loading-text要素が見つかりません');
            }
            
            if (loadingBarProgress) {
                const percentage = (current / total) * 100;
                loadingBarProgress.style.width = `${percentage}%`;
                console.log(`📊 プログレスバー更新: ${percentage}%`);
            } else {
                console.warn('⚠️ .loading-bar-progress要素が見つかりません');
            }
        } catch (error) {
            console.error('❌ 進捗更新エラー:', error);
        }
    }

    // 読み込み進捗をクリア
    clearLoadingProgress() {
        const loadingText = document.querySelector('.loading-text');
        const loadingBarProgress = document.querySelector('.loading-bar-progress');
        
        if (loadingText) {
            loadingText.textContent = '';
        }
        
        if (loadingBarProgress) {
            loadingBarProgress.style.width = '0%';
        }
        
        console.log('📊 Loading progress cleared');
    }

    // 働くフォールバック認証システム（本格版）
    createWorkingFallbackAuth() {
        console.log('🛠️ 働くフォールバック認証システムを作成中...');
        
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = `
            <div style="
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 20px;
            ">
                <div style="
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    width: 100%;
                    max-width: 400px;
                    text-align: center;
                ">
                    <h1 style="
                        color: #333;
                        margin-bottom: 10px;
                        font-size: 28px;
                        font-weight: 600;
                    ">LazyChillRoom</h1>
                    
                    <p style="
                        color: #666;
                        margin-bottom: 30px;
                        font-size: 14px;
                    ">フォールバック認証モード</p>
                    
                    <form id="fallback-login-form" style="margin: 0;">
                        <div style="margin-bottom: 20px;">
                            <input 
                                type="text" 
                                id="fallback-userid" 
                                placeholder="ユーザーID" 
                                required 
                                style="
                                    width: 100%;
                                    padding: 15px;
                                    border: 2px solid #e1e5e9;
                                    border-radius: 8px;
                                    font-size: 16px;
                                    box-sizing: border-box;
                                    transition: border-color 0.3s ease;
                                "
                            >
                        </div>
                        
                        <div style="margin-bottom: 25px;">
                            <input 
                                type="password" 
                                id="fallback-password" 
                                placeholder="パスワード" 
                                required 
                                style="
                                    width: 100%;
                                    padding: 15px;
                                    border: 2px solid #e1e5e9;
                                    border-radius: 8px;
                                    font-size: 16px;
                                    box-sizing: border-box;
                                    transition: border-color 0.3s ease;
                                "
                            >
                        </div>
                        
                        <button 
                            type="submit" 
                            id="fallback-login-btn"
                            style="
                                width: 100%;
                                padding: 15px;
                                background: #667eea;
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 16px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: background-color 0.3s ease;
                                margin-bottom: 15px;
                            "
                        >ログイン</button>
                    </form>
                    
                    <div id="fallback-status" style="
                        margin-top: 15px;
                        font-size: 14px;
                        min-height: 20px;
                    "></div>
                    
                    <div style="
                        margin-top: 25px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 12px;
                        color: #999;
                    ">
                        認証システムのフォールバックモードです<br>
                        <button 
                            id="retry-normal-mode-btn"
                            style="
                                margin-top: 10px;
                                padding: 8px 16px;
                                background: #95a5a6;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                font-size: 12px;
                                cursor: pointer;
                            "
                        >通常モード再試行</button>
                    </div>
                </div>
            </div>
        `;
        
        // スタイルの追加（ホバー効果など）
        const style = document.createElement('style');
        style.textContent = `
            #fallback-userid:focus, #fallback-password:focus {
                border-color: #667eea !important;
                outline: none;
            }
            #fallback-login-btn:hover {
                background: #5a6fd8 !important;
            }
            #fallback-login-btn:disabled {
                background: #ccc !important;
                cursor: not-allowed !important;
            }
        `;
        document.head.appendChild(style);
        
        // フォーム送信イベント
        const form = document.getElementById('fallback-login-form');
        const statusDiv = document.getElementById('fallback-status');
        const loginBtn = document.getElementById('fallback-login-btn');
        const retryBtn = document.getElementById('retry-normal-mode-btn');
        
        // 通常モード再試行ボタン
        retryBtn.addEventListener('click', () => {
            console.log('🔄 通常モード再試行中...');
            window.location.reload();
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userid = document.getElementById('fallback-userid').value.trim();
            const password = document.getElementById('fallback-password').value;
            
            if (!userid || !password) {
                statusDiv.textContent = 'ユーザーIDとパスワードを入力してください';
                statusDiv.style.color = '#e74c3c';
                return;
            }
            
            // ログイン処理開始
            statusDiv.textContent = 'ログイン中...';
            statusDiv.style.color = '#3498db';
            loginBtn.disabled = true;
            loginBtn.textContent = 'ログイン中...';
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userid, password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    statusDiv.textContent = 'ログイン成功！チャット画面に移動します...';
                    statusDiv.style.color = '#27ae60';
                    
                    // 認証情報を保存
                    localStorage.setItem('authToken', result.token);
                    localStorage.setItem('auth_token', result.token);
                    sessionStorage.setItem('authToken', result.token);
                    localStorage.setItem('currentUser', JSON.stringify(result.user));
                    sessionStorage.setItem('currentUser', JSON.stringify(result.user));
                    
                    // APIクライアントが存在する場合はトークンを設定
                    if (window.apiClient) {
                        window.apiClient.setToken(result.token);
                    }
                    
                    console.log('✅ フォールバック認証成功 - トークンを保存しました');
                    
                    // チャット画面への移動を試行
                    setTimeout(async () => {
                        try {
                            if (window.appLoader) {
                                await window.appLoader.showChatView();
                            } else {
                                // AppLoaderが利用できない場合はページをリロード
                                window.location.reload();
                            }
                        } catch (error) {
                            console.error('チャット画面への移動に失敗:', error);
                            window.location.reload();
                        }
                    }, 1000);
                    
                } else {
                    statusDiv.textContent = result.message || 'ログインに失敗しました';
                    statusDiv.style.color = '#e74c3c';
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'ログイン';
                }
            } catch (error) {
                console.error('フォールバックログインエラー:', error);
                statusDiv.textContent = 'ネットワークエラーが発生しました';
                statusDiv.style.color = '#e74c3c';
                loginBtn.disabled = false;
                loginBtn.textContent = 'ログイン';
            }
        });
        
        // app要素を表示
        appContainer.style.display = 'block';
        
        console.log('✅ 働くフォールバック認証システムを作成完了');
    }
    
    // フォールバックAPIクライアントを作成（改良版）
    createFallbackAPI() {
        if (!window.apiClient) {
            window.apiClient = {
                post: async (url, data) => {
                    const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(data)
                    });
                    return response.json();
                },
                get: async (url) => {
                    const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
                    const headers = {};
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                    
                    const response = await fetch(url, { headers });
                    return response.json();
                },
                setToken: (token) => {
                    localStorage.setItem('authToken', token);
                    localStorage.setItem('auth_token', token);
                    sessionStorage.setItem('authToken', token);
                },
                removeToken: () => {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('currentUser');
                    sessionStorage.removeItem('authToken');
                    sessionStorage.removeItem('currentUser');
                },
                reloadToken: () => {
                    return localStorage.getItem('authToken') || localStorage.getItem('auth_token');
                },
                verifyToken: async () => {
                    const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
                    if (!token) {
                        return { success: false, message: 'No token found' };
                    }
                    
                    try {
                        const response = await fetch('/api/auth/verify', {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        return response.json();
                    } catch (error) {
                        return { success: false, message: error.message };
                    }
                }
            };
            console.log('改良版フォールバックAPIクライアントを作成完了');
        }
    }
    
    // 基本ユーティリティクラスのフォールバックを作成
    createBasicUtilityFallbacks() {
        console.log('🛠️ 基本ユーティリティフォールバックを準備中...');
        
        // TimeUtilsフォールバック
        if (!window.TimeUtils) {
            window.TimeUtils = class FallbackTimeUtils {
                static formatTime(date) {
                    if (!date) return '';
                    try {
                        const d = new Date(date);
                        return d.toLocaleTimeString('ja-JP', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                    } catch (error) {
                        return String(date);
                    }
                }
                
                static formatDate(date) {
                    if (!date) return '';
                    try {
                        const d = new Date(date);
                        return d.toLocaleDateString('ja-JP');
                    } catch (error) {
                        return String(date);
                    }
                }
                
                static formatDateTime(date) {
                    if (!date) return '';
                    try {
                        const d = new Date(date);
                        return d.toLocaleString('ja-JP');
                    } catch (error) {
                        return String(date);
                    }
                }
            };
            console.log('🛠️ TimeUtilsフォールバックを作成しました');
        }
        
        // NotificationManagerフォールバック
        if (!window.NotificationManager) {
            window.NotificationManager = class FallbackNotificationManager {
                constructor() {
                    this.container = this.createContainer();
                }
                
                createContainer() {
                    let container = document.getElementById('notification-container');
                    if (!container) {
                        container = document.createElement('div');
                        container.id = 'notification-container';
                        container.style.cssText = `
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            z-index: 10000;
                            pointer-events: none;
                        `;
                        document.body.appendChild(container);
                    }
                    return container;
                }
                
                show(message, type = 'info') {
                    const notification = document.createElement('div');
                    notification.textContent = message;
                    notification.style.cssText = `
                        background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
                        color: white;
                        padding: 12px 20px;
                        border-radius: 5px;
                        margin-bottom: 10px;
                        pointer-events: auto;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                        font-size: 14px;
                    `;
                    
                    this.container.appendChild(notification);
                    
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 5000);
                }
                
                error(message) {
                    this.show(message, 'error');
                }
                
                success(message) {
                    this.show(message, 'success');
                }
                
                info(message) {
                    this.show(message, 'info');
                }
            };
            console.log('🛠️ NotificationManagerフォールバックを作成しました');
        }
        
        console.log('✅ 基本ユーティリティフォールバック準備完了');
    }
}

// AppLoaderクラスをグローバルに公開
window.AppLoader = AppLoader;

// アプリケーションローダーの初期化関数（即座実行版）
async function initializeAppLoader() {
    console.log('🚀 AppLoader初期化開始（即座実行版）...');
    console.log('🔍 Document readyState:', document.readyState);
    console.log('� Window loaded:', document.readyState === 'complete');
    
    // 複数回初期化を防ぐフラグ（強化版）
    if (window.appLoaderInitialized || window.appLoaderInitializing) {
        console.warn('⚠️ AppLoaderは既に初期化済みまたは初期化中です。重複初期化を防止します。');
        return;
    }
    window.appLoaderInitializing = true;
    
    try {
        console.log('🔄 AppLoaderクラスをインスタンス化中...');
        
        // AppLoaderクラスが定義されているか確認
        if (typeof AppLoader === 'undefined') {
            throw new Error('AppLoaderクラスが定義されていません');
        }
        
        const appLoader = new AppLoader();
        window.appLoader = appLoader;
        console.log('✅ AppLoaderインスタンス作成完了');
        
        console.log('🔄 AppLoader.init()を実行中...');
        // タイムアウト付きで初期化（30秒）
        await Promise.race([
            appLoader.init(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Application initialization timeout (30s)')), 30000)
            )
        ]);
        
        window.appLoaderInitialized = true;
        window.appLoaderInitializing = false;
        console.log('✅ AppLoader初期化完了');
    } catch (error) {
        window.appLoaderInitializing = false;
        console.error('❌ AppLoader初期化エラー:', error);
        console.error('❌ エラースタック:', error.stack);
        
        // エラーが発生した場合はリロード
        console.log('� エラーが発生しました。ページをリロードします。');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
}

// DOMの状態に応じて即座にまたは適切なタイミングで初期化
if (document.readyState === 'loading') {
    console.log('📋 DOMまだ読み込み中、DOMContentLoadedを待機...');
    document.addEventListener('DOMContentLoaded', initializeAppLoader);
} else {
    console.log('📋 DOM既に読み込み済み、即座に初期化開始...');
    // DOM読み込み済みの場合は即座に実行
    console.log('🔄 AppLoaderクラス確認:', typeof AppLoader);
    console.log('🔄 initializeAppLoader関数確認:', typeof initializeAppLoader);
    
    // より確実な初期化
    Promise.resolve().then(() => {
        return initializeAppLoader();
    }).catch(error => {
        console.error('❌ 即座初期化でエラー:', error);
        console.log('� エラーが発生しました。ページをリロードします。');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    });
}

// グローバルスコープに登録（他のスクリプトからアクセス可能）
window.app = {
    showChatView: async () => {
        if (window.appLoader) {
            await window.appLoader.showChatView();
        }
    }
};

// デバッグ用：スクリプト読み込み完了を明示
console.log('📄 app.jsの実行完了');
console.log('🔍 window.AppLoader:', typeof window.AppLoader !== 'undefined');
console.log('🔍 AppLoaderクラス定義確認:', typeof AppLoader !== 'undefined');
console.log('🔍 initializeAppLoader関数定義確認:', typeof initializeAppLoader !== 'undefined');

// 即座にテスト実行
console.log('🧪 AppLoaderテストインスタンス作成...');
try {
    const testInstance = new AppLoader();
    console.log('✅ AppLoaderテストインスタンス作成成功');
    window.testAppLoader = testInstance;
} catch (error) {
    console.error('❌ AppLoaderテストインスタンス作成失敗:', error);
}