// サーバー管理クラス
class ServerManager {
    constructor(chatUI) {
        this.chatUI = chatUI;
    }

    // サーバー切り替え
    async switchServer(serverItem, skipChannelLoad = false) {
        this.chatUI.isDMMode = false;
        document.getElementById('dmButton').classList.remove('active');
        
        document.querySelectorAll('.server-item').forEach(item => {
            item.classList.remove('active');
        });

        serverItem.classList.add('active');
        const serverId = serverItem.dataset.server;
        
        const guild = await this.chatUI.chatManager.loadGuildDetails(serverId);
        console.log('🔍 switchServer - guild loaded:', guild);
        console.log('🔍 switchServer - guild.members:', guild?.members);
        
        if (guild) {
            this.chatUI.currentGuild = guild;
            
            // セクションタイトルを更新
            const sectionTitle = document.getElementById('sectionTitle');
            sectionTitle.textContent = 'テキストチャンネル';
            
            // メンバーリストを最初に更新（最重要）
            console.log('👥 メンバーリスト更新:', guild.members?.length || 0, 'メンバー');
            console.log('👥 メンバーリスト詳細:', guild.members);
            this.chatUI.updateMembersList(guild.members || []);
            this.chatUI.uiUtils.showMembersList(); // uiUtils経由で呼び出し
            
            // チャンネル読み込みをスキップしない場合のみ実行
            if (!skipChannelLoad) {
                await this.chatUI.loadAndRenderChannels(serverId);
            }
            
            // アバターを更新（初期化時に設定されていない場合のため）
            if (this.chatUI.currentUser && this.chatUI.currentUser.avatar_url) {
                this.chatUI.settingsHandler.updateSidebarAvatar(this.chatUI.currentUser.avatar_url);
            } else {
                // localStorageからもチェック
                const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (storedUser && storedUser.avatar_url) {
                    this.chatUI.settingsHandler.updateSidebarAvatar(storedUser.avatar_url);
                    // currentUserを更新
                    if (this.chatUI.currentUser) {
                        this.chatUI.currentUser.avatar_url = storedUser.avatar_url;
                    }
                }
            }
            
            // 状態を保存
            this.chatUI.stateManager.saveState();
            
            console.log(`サーバー切り替え: ${guild.name}`);
        }
    }

    // マイサーバーを開く
    async openMyServer() {
        try {
            console.log('🏠 マイサーバーを読み込み中...');
            const myServer = await this.chatUI.chatManager.getMyServer();
            console.log('🔍 getMyServer() の結果:', myServer);
            
            if (myServer) {
                console.log('✅ マイサーバーの読み込み完了:', myServer);
                console.log('🔍 マイサーバーのID:', myServer.id);
                console.log('🔍 マイサーバーの名前:', myServer.name);
                this.showMyServer(myServer);
            } else {
                console.warn('⚠️ マイサーバーが見つかりません - まだ作成されていない可能性があります');
                // マイサーバーが存在しない場合の処理を追加できます
            }
        } catch (error) {
            console.error('❌ マイサーバーの読み込みエラー:', error);
            // エラーをユーザーに表示しないで、ログだけ残す
        }
    }

    // マイサーバーを表示
    showMyServer(myServer) {
        // DMモードを無効化
        this.chatUI.isDMMode = false;
        document.getElementById('dmButton').classList.remove('active');
        
        // 現在のサーバー選択を解除
        document.querySelectorAll('.server-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // マイサーバーを設定
        this.chatUI.currentGuild = myServer;
        
        // チャンネル一覧を表示
        this.chatUI.renderChannelList(myServer.channels || []);
        
        // セクションタイトルを更新
        const sectionTitle = document.getElementById('sectionTitle');
        sectionTitle.textContent = 'マイサーバー';
        
        // 最初のチャンネルを選択（アップローダーチャンネル優先）
        if (myServer.channels && myServer.channels.length > 0) {
            // 公開チャンネルを優先的に選択
            const publicChannel = myServer.channels.find(ch => ch.type === 'uploader_public');
            const firstChannel = publicChannel || myServer.channels[0];
            
            this.chatUI.currentChannel = firstChannel;
            this.chatUI.chatManager.currentChannel = firstChannel; // ChatManagerにも設定
            this.chatUI.loadAndRenderMessages(firstChannel.id);
            this.chatUI.uiUtils.setActiveChannel(firstChannel.id); // uiUtils経由で呼び出し
            this.chatUI.updateChatHeader(firstChannel);
        }
        
        // メンバーリストを非表示（マイサーバーは個人用）
        this.chatUI.uiUtils.hideMembersList(); // uiUtils経由で呼び出し
        
        // 状態を保存
        this.chatUI.stateManager.saveState();
        
        console.log('マイサーバーを開きました:', myServer.name);
    }

    // サーバー追加モーダル表示
    showAddServerModal() {
        this.createServerModal();
    }

    // サーバー作成モーダルを作成
    createServerModal() {
        // 既存のモーダルがあれば削除
        const existingModal = document.getElementById('serverCreateModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'serverCreateModal';
        modal.className = 'server-create-modal';
        
        modal.innerHTML = `
            <div class="server-create-content">
                <div class="server-create-header">
                    <h2 class="server-create-title">サーバーを作成</h2>
                    <p class="server-create-subtitle">サーバーは、あなたとお友達がハングアウトする場所です。自分のサーバーを作成して、話し始めましょう。</p>
                </div>
                
                <div class="server-create-body">
                    <form class="server-create-form" id="serverCreateForm">
                        <div class="form-group">
                            <label class="form-label" for="serverName">サーバー名 <span style="color: #ed4245;">*</span></label>
                            <input type="text" id="serverName" class="form-input" placeholder="例: 友達のサーバー" maxlength="100" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="serverDescription">サーバーの説明 <span style="color: #72767d;">(オプション)</span></label>
                            <textarea id="serverDescription" class="form-textarea" placeholder="このサーバーについて少し教えてください" maxlength="500"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">サーバーアイコン <span style="color: #72767d;">(オプション)</span></label>
                            <div class="server-icon-upload">
                                <div class="server-icon-preview" id="serverIconPreview">
                                    <span id="serverIconText">?</span>
                                </div>
                                <div class="server-icon-input-group">
                                    <input type="file" id="serverIconInput" class="server-icon-input" accept="image/*">
                                    <button type="button" class="server-icon-button" id="serverIconUploadBtn">
                                        画像をアップロード
                                    </button>
                                    <p style="color: #72767d; font-size: 12px; margin-top: 8px;">推奨: 正方形、最小128x128px</p>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                
                <div class="server-create-footer">
                    <button type="button" class="btn-cancel" id="cancelServerBtn">戻る</button>
                    <button type="button" class="btn-create" id="createServerBtn">作成</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // イベントリスナーを設定
        this.setupServerModalEvents();
        
        // サーバー名入力フィールドにフォーカス
        setTimeout(() => {
            document.getElementById('serverName').focus();
        }, 100);
    }

    // サーバーモーダルのイベントを設定
    setupServerModalEvents() {
        const modal = document.getElementById('serverCreateModal');
        const serverNameInput = document.getElementById('serverName');
        const serverIconInput = document.getElementById('serverIconInput');
        const serverIconPreview = document.getElementById('serverIconPreview');
        const serverIconText = document.getElementById('serverIconText');
        const createBtn = document.getElementById('createServerBtn');
        
        // サーバー名変更でアイコンテキストを更新
        serverNameInput.addEventListener('input', () => {
            const name = serverNameInput.value.trim();
            serverIconText.textContent = name ? name.charAt(0).toUpperCase() : '?';
        });
        
        // アイコンファイル選択
        serverIconInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 8 * 1024 * 1024) { // 8MB制限
                    if (window.notificationManager) {
                        window.notificationManager.error('ファイルサイズは8MB以下にしてください');
                    } else {
                        this.chatUI.uiUtils.showNotification('ファイルサイズは8MB以下にしてください', 'error');
                    }
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    serverIconPreview.innerHTML = `<img src="${e.target.result}" alt="サーバーアイコン">`;
                };
                reader.readAsDataURL(file);
            }
        });

        // サーバーアイコンアップロードボタン
        const serverIconUploadBtn = document.getElementById('serverIconUploadBtn');
        if (serverIconUploadBtn) {
            serverIconUploadBtn.addEventListener('click', () => {
                document.getElementById('serverIconInput').click();
            });
        }
        
        // 作成ボタン
        createBtn.addEventListener('click', () => {
            this.handleServerCreate();
        });
        
        // 戻るボタン
        const cancelBtn = document.getElementById('cancelServerBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        // Enterキーでの送信
        serverNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleServerCreate();
            }
        });
        
        // モーダル外クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // ESCキーで閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('serverCreateModal')) {
                modal.remove();
            }
        });
    }

    // サーバー作成処理
    async handleServerCreate() {
        const serverName = document.getElementById('serverName').value.trim();
        const serverDescription = document.getElementById('serverDescription').value.trim();
        const serverIconInput = document.getElementById('serverIconInput');
        const createBtn = document.getElementById('createServerBtn');
        
        // バリデーション
        if (!serverName) {
            if (window.notificationManager) {
                window.notificationManager.error('サーバー名を入力してください');
            } else {
                this.chatUI.uiUtils.showNotification('サーバー名を入力してください', 'error');
            }
            document.getElementById('serverName').focus();
            return;
        }
        
        if (serverName.length < 2) {
            if (window.notificationManager) {
                window.notificationManager.error('サーバー名は2文字以上で入力してください');
            } else {
                this.chatUI.uiUtils.showNotification('サーバー名は2文字以上で入力してください', 'error');
            }
            document.getElementById('serverName').focus();
            return;
        }
        
        // ローディング状態
        createBtn.disabled = true;
        createBtn.innerHTML = '<div class="loading-spinner"></div>';
        
        try {
            // まずサーバーを作成
            const authToken = localStorage.getItem('authToken');
            console.log('Auth token exists:', !!authToken);
            if (authToken) {
                console.log('Token preview:', authToken.substring(0, 10) + '...');
            }
            
            const response = await fetch('api/guilds/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    name: serverName,
                    description: serverDescription,
                    icon_url: ''
                })
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            // レスポンスのテキストを先に取得してデバッグ
            const responseText = await response.text();
            console.log('Raw response:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed response data:', data);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                throw new Error(`サーバーからの応答が不正です: ${responseText}`);
            }
            
            if (data.success) {
                // アイコンがある場合はアップロード
                let iconUploadSuccess = true;
                if (serverIconInput.files && serverIconInput.files[0]) {
                    try {
                        const iconResult = await this.uploadServerIcon(data.guild.id, serverIconInput.files[0]);
                        console.log('アイコンアップロード成功:', iconResult);
                        // アップロード成功時、データベースから最新のサーバー情報を取得するため
                        // icon_urlを更新
                        if (iconResult.icon_url) {
                            data.guild.icon_url = iconResult.icon_url;
                        }
                    } catch (iconError) {
                        console.warn('アイコンアップロードに失敗しましたが、サーバーは作成されました:', iconError);
                        iconUploadSuccess = false;
                        if (window.notificationManager) {
                            window.notificationManager.warning('サーバーは作成されましたが、アイコンのアップロードに失敗しました');
                        }
                    }
                }
                
                // 成功通知
                if (window.notificationManager) {
                    if (iconUploadSuccess && serverIconInput.files && serverIconInput.files[0]) {
                        window.notificationManager.success(`サーバー「${serverName}」がアイコン付きで作成されました`);
                    } else {
                        window.notificationManager.success(`サーバー「${serverName}」が作成されました`);
                    }
                }
                
                // モーダルを閉じる
                document.getElementById('serverCreateModal').remove();
                
                // サーバーリストを強制的に更新（キャッシュをクリアして最新データを取得）
                console.log('サーバー作成成功 - サーバーリストを更新中...');
                const updatedGuilds = await this.chatUI.chatManager.reloadGuilds();
                console.log('更新後のサーバーリスト:', updatedGuilds);
                
                this.renderServerList(updatedGuilds);
                
                console.log('サーバー作成後のサーバーリスト:', this.chatUI.chatManager.guilds);
                
                // DOM更新完了を確実に待つ
                await new Promise(resolve => {
                    requestAnimationFrame(() => {
                        setTimeout(resolve, 50);
                    });
                });
                
                // 作成されたサーバー要素を探す
                console.log(`作成されたサーバーID: ${data.guild.id} を検索中...`);
                const allServerElements = document.querySelectorAll('[data-server]');
                console.log('利用可能なサーバー要素:', Array.from(allServerElements).map(el => ({
                    id: el.dataset.server,
                    element: el
                })));
                
                // 作成したサーバーに切り替え
                if (data.guild) {
                    const serverElement = document.querySelector(`[data-server="${data.guild.id}"]`);
                    if (serverElement) {
                        console.log('✅ 作成されたサーバーに切り替えます:', data.guild.name);
                        await this.switchServer(serverElement);
                    } else {
                        console.warn('❌ 作成されたサーバーの要素が見つかりません:', data.guild.id);
                        
                        // より詳細なデバッグ
                        const serversList = document.getElementById('serversList');
                        console.log('サーバーリストHTML:', serversList?.innerHTML);
                        
                        // 最大3回リトライ
                        let retryCount = 0;
                        const retryFind = async () => {
                            retryCount++;
                            console.log(`🔄 リトライ ${retryCount}/3: サーバー要素を検索中...`);
                            
                            await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
                            const retryElement = document.querySelector(`[data-server="${data.guild.id}"]`);
                            
                            if (retryElement) {
                                console.log('✅ リトライで作成されたサーバーが見つかりました');
                                await this.switchServer(retryElement);
                            } else if (retryCount < 3) {
                                await retryFind();
                            } else {
                                console.error('❌ 3回のリトライでもサーバー要素が見つかりませんでした');
                            }
                        };
                        
                        await retryFind();
                    }
                }
                
            } else {
                console.error('Server returned error:', data);
                throw new Error(data.message || data.error_details || 'サーバーの作成に失敗しました');
            }
            
        } catch (error) {
            console.error('サーバー作成エラー:', error);
            
            if (window.notificationManager) {
                window.notificationManager.error(error.message || 'サーバーの作成に失敗しました');
            } else {
                this.chatUI.uiUtils.showNotification('サーバーの作成に失敗しました: ' + error.message, 'error');
            }
        } finally {
            // ローディング状態を解除
            createBtn.disabled = false;
            createBtn.innerHTML = '作成';
        }
    }

    // DMユーザーリスト表示 → フレンド管理画面表示に変更
    async showDMUserList() {
        try {
            console.log('🔄 フレンド管理画面を表示中...');
            
            // DMモードを有効化
            this.chatUI.isDMMode = true;
            
            // セクションタイトルを更新
            const sectionTitle = document.getElementById('sectionTitle');
            sectionTitle.textContent = 'ダイレクトメッセージ';
            
            // フレンド管理画面を中央に表示
            if (this.chatUI.showFriendsView) {
                await this.chatUI.showFriendsView();
            } else {
                // FriendsUIが初期化されていない場合の代替表示
                const mainContent = document.getElementById('chatMessages') || document.getElementById('mainContent') || document.getElementById('channelContent');
                if (mainContent) {
                    mainContent.innerHTML = `
                        <div class="friends-loading">
                            <div class="loading-spinner"></div>
                            <p>フレンド管理機能を初期化中...</p>
                        </div>
                    `;
                }
                
                // 少し待ってからリトライ
                setTimeout(async () => {
                    if (this.chatUI.showFriendsView) {
                        await this.chatUI.showFriendsView();
                    } else {
                        console.error('フレンド管理機能が利用できません');
                        if (mainContent) {
                            mainContent.innerHTML = `
                                <div class="friends-error">
                                    <p>フレンド管理機能が利用できません</p>
                                    <button onclick="location.reload()">再読み込み</button>
                                </div>
                            `;
                        }
                    }
                }, 1000);
            }
            
            // サイドバーには簡易的なDMリストを表示
            await this.showDMSidebar();
            
        } catch (error) {
            console.error('フレンド管理画面表示エラー:', error);
            if (this.chatUI.uiUtils) {
                this.chatUI.uiUtils.showNotification('フレンド管理画面の表示に失敗しました', 'error');
            }
        }
    }

    // サイドバー用の簡易DMリスト表示
    async showDMSidebar() {
        const channelsList = document.getElementById('channelsList');
        
        try {
            // DMチャンネルとフレンドリストを並行して取得
            const [dmChannels, friendsList] = await Promise.all([
                this.chatUI.chatManager.loadChannels(),
                this.loadFriendsForDMList()
            ]);
            
            channelsList.innerHTML = UIComponents.createDMUserListHTML(dmChannels, friendsList);
            
            // イベントリスナーを設定
            this.bindDMListEvents();
        } catch (error) {
            console.error('DMサイドバー表示エラー:', error);
            channelsList.innerHTML = UIComponents.createDMUserListHTML([], []);
            this.bindDMListEvents();
        }
    }

    // DMリスト用のフレンドリストを取得
    async loadFriendsForDMList() {
        try {
            // フレンド管理システムが初期化されていない場合は初期化完了まで待機
            if (!window.friendsManager) {
                console.log('⏳ FriendsManagerの初期化を待機中...');
                
                // 初期化完了イベントを待機（最大3秒）
                let timeoutId;
                const waitForInit = new Promise((resolve, reject) => {
                    const checkInit = () => {
                        if (window.friendsManager) {
                            clearTimeout(timeoutId);
                            console.log('✓ FriendsManagerの初期化が完了しました');
                            resolve();
                        }
                    };
                    
                    // 初期化完了イベントをリッスン
                    window.addEventListener('friendsSystemReady', checkInit, { once: true });
                    
                    // すでに初期化済みの場合はすぐに解決
                    checkInit();
                    
                    // 3秒でタイムアウト
                    timeoutId = setTimeout(() => {
                        window.removeEventListener('friendsSystemReady', checkInit);
                        console.warn('⚠️ FriendsManagerの初期化がタイムアウトしました');
                        resolve(); // エラーにせずに続行
                    }, 3000);
                });
                
                await waitForInit;
            }
            
            // まだ初期化されていない場合は空配列を返す
            if (!window.friendsManager) {
                console.log('⚠️ FriendsManagerが利用できません - 空のフレンドリストを返します');
                return [];
            }
            
            console.log('🔄 フレンドリストを読み込み中...');
            await window.friendsManager.loadFriends();
            const friends = window.friendsManager.friends || [];
            console.log('✅ フレンドリスト読み込み完了:', friends.length, '人');
            return friends;
        } catch (error) {
            console.error('フレンドリスト取得エラー:', error);
            
            // エラーの詳細を表示
            if (error.status === 401) {
                console.error('認証エラー: ログインが必要です');
            } else if (error.status === 404) {
                console.error('APIエンドポイントが見つかりません');
            } else if (error.status >= 500) {
                console.error('サーバーエラーが発生しました');
            }
            
            // エラーの場合は空配列を返してUIは継続する
            return [];
        }
    }

    // DMリストのイベントをバインド
    bindDMListEvents() {
        const channelsList = document.getElementById('channelsList');
        if (!channelsList) return;

        // フレンドを追加ボタン（大）
        const addFriendBtnLarge = channelsList.querySelector('#addFriendFromDMLarge');
        if (addFriendBtnLarge) {
            addFriendBtnLarge.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.showAddFriendModal();
            });
        }

        // フレンドアイテム（DM開始）
        channelsList.querySelectorAll('.dm-friend-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                const friendId = item.dataset.friendId;
                if (friendId && window.dmManager) {
                    try {
                        // フレンドとのDMチャンネルを作成または取得
                        const dmChannel = await window.dmManager.createOrGetDMChannel(parseInt(friendId));
                        if (dmChannel) {
                            await window.dmManager.switchToDMChannel(dmChannel);
                        }
                    } catch (error) {
                        console.error('フレンドとのDM開始エラー:', error);
                        if (window.notificationManager) {
                            window.notificationManager.error('DMの開始に失敗しました');
                        }
                    }
                }
            });
        });

        // 既存のDMアイテム
        channelsList.querySelectorAll('.dm-user-item[data-dm]').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                const dmId = item.dataset.dm;
                if (dmId && window.dmManager) {
                    const dmChannel = window.dmManager.findDMChannelById(parseInt(dmId));
                    if (dmChannel) {
                        await window.dmManager.switchToDMChannel(dmChannel);
                    }
                }
            });
        });
    }

    // フレンド追加モーダルを表示
    async showAddFriendModal() {
        try {
            // フレンド管理画面を表示して、そこからフレンド追加を行う
            console.log('🔄 フレンド管理画面でフレンド追加を実行...');
            
            if (this.chatUI.showFriendsView) {
                await this.chatUI.showFriendsView();
                
                // フレンド管理画面が表示された後、フレンド追加モーダルを表示
                setTimeout(() => {
                    if (window.friendsManager && this.chatUI.uiUtils) {
                        this.showQuickFriendAdd();
                    }
                }, 300);
            } else {
                // 従来のモーダル方式をフォールバック
                await this.showQuickFriendAdd();
            }
            
        } catch (error) {
            console.error('フレンド追加機能表示エラー:', error);
            if (this.chatUI.uiUtils) {
                this.chatUI.uiUtils.showNotification('フレンド追加機能でエラーが発生しました', 'error');
            }
        }
    }

    // クイックフレンド追加モーダル
    async showQuickFriendAdd() {
        try {
            if (window.friendsManager && this.chatUI.uiUtils) {
                const result = await this.chatUI.uiUtils.showInput({
                    title: 'フレンド追加',
                    message: 'フレンドのユーザー名を入力してください:',
                    placeholder: 'ユーザー名',
                    confirmText: '送信',
                    cancelText: 'キャンセル'
                });

                if (result && result.trim()) {
                    const response = await window.friendsManager.sendFriendRequest(result);
                    this.chatUI.uiUtils.showNotification(
                        response.message, 
                        response.success ? 'success' : 'error'
                    );
                    
                    if (response.success) {
                        // フレンド管理画面を更新
                        if (this.chatUI.showFriendsView) {
                            await this.chatUI.showFriendsView();
                        }
                        // サイドバーも更新
                        await this.showDMSidebar();
                    }
                }
            }
        } catch (error) {
            console.error('クイックフレンド追加エラー:', error);
            if (this.chatUI.uiUtils) {
                this.chatUI.uiUtils.showNotification('フレンド追加でエラーが発生しました', 'error');
            }
        }
    }

    // チャンネルリスト表示
    async showChannelList() {
        const sectionTitle = document.getElementById('sectionTitle');
        sectionTitle.textContent = 'テキストチャンネル';
        
        if (this.chatUI.currentGuild) {
            await this.chatUI.loadAndRenderChannels(this.chatUI.currentGuild.id);
        }
    }

    // サーバーリストをレンダリング
    renderServerList(guilds) {
        console.log('ServerManager: サーバーリストをレンダリング中...', guilds);
        const serversList = document.getElementById('serversList');
        
        if (!serversList) {
            console.error('ServerManager: serversList要素が見つかりません');
            return;
        }
        
        if (!guilds || guilds.length === 0) {
            console.warn('ServerManager: サーバーリストが空です');
            serversList.innerHTML = `
                <div class="server-item add-server" id="addServerBtn" title="サーバーを追加">
                    <div class="server-icon plus">+</div>
                </div>
            `;
            this.bindServerEvents();
            return;
        }
        
        const html = UIComponents.createServerListHTML(guilds);
        serversList.innerHTML = html;
        console.log('ServerManager: サーバーリスト HTML設定完了');
        console.log('ServerManager: 設定されたHTML:', html);
        
        // 画像エラーハンドリングを設定
        setTimeout(() => {
            UIComponents.setupImageErrorHandling();
        }, 100);
        
        // イベントを再バインド
        this.bindServerEvents();
        
        // デバッグ: 作成された要素を確認
        const serverItems = document.querySelectorAll('.server-item:not(.add-server)');
        console.log('ServerManager: 作成されたサーバー要素数:', serverItems.length);
        serverItems.forEach((item, index) => {
            console.log(`ServerManager: サーバー${index + 1} - data-server="${item.dataset.server}", 内容:"${item.textContent.trim()}"`);
        });
        
        // 特定のサーバーIDが含まれているかチェック
        guilds.forEach(guild => {
            const element = document.querySelector(`[data-server="${guild.id}"]`);
            console.log(`ServerManager: サーバーID ${guild.id} の要素確認:`, element ? '✅ 存在' : '❌ 不在');
        });
    }

    // サーバーリストを更新
    updateServersList(guilds) {
        const serversList = document.getElementById('serversList');
        if (serversList && guilds) {
            serversList.innerHTML = UIComponents.createServerListHTML(guilds);
        }
    }

    // サーバーイベントをバインド
    bindServerEvents() {
        // サーバー追加ボタン
        const addServerBtn = document.getElementById('addServerBtn');
        if (addServerBtn) {
            addServerBtn.addEventListener('click', () => {
                this.showAddServerModal();
            });
        }
        
        // 各サーバー項目のクリックイベント
        const serverItems = document.querySelectorAll('.server-item:not(.add-server)');
        serverItems.forEach(serverItem => {
            serverItem.addEventListener('click', () => {
                this.switchServer(serverItem);
            });
        });
    }

    // サーバーアイコンをアップロード
    async uploadServerIcon(serverId, file) {
        const authToken = localStorage.getItem('authToken');
        
        if (!file) {
            throw new Error('ファイルが選択されていません');
        }
        
        // ファイルサイズチェック
        if (file.size > 8 * 1024 * 1024) {
            throw new Error('ファイルサイズは8MB以下にしてください');
        }
        
        // ファイル形式チェック
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('JPEG、PNG、GIF、WebP形式のファイルのみアップロードできます');
        }
        
        const formData = new FormData();
        formData.append('icon', file);
        formData.append('guild_id', serverId);
        
        const response = await fetch('api/guilds/upload-icon', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const responseText = await response.text();
        console.log('Server icon upload response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error(`サーバーからの応答が不正です: ${responseText}`);
        }
        
        if (!data.success) {
            throw new Error(data.error || 'アイコンのアップロードに失敗しました');
        }
        
        console.log('Server icon uploaded successfully:', data);
        
        // アップロード成功後、サーバーリストを即座に更新
        // ChatManagerのギルドリストも更新
        if (this.chatUI.chatManager.guilds) {
            const guild = this.chatUI.chatManager.guilds.find(g => g.id === parseInt(serverId));
            if (guild) {
                guild.icon_url = data.icon_url;
                console.log('ギルドリスト内のアイコンURLを更新:', guild.name, data.icon_url);
            }
        }
        
        return data;
    }

    // サーバー設定モーダルを表示（アイコン変更など）
    showServerSettingsModal(serverId) {
        // 既存のモーダルがあれば削除
        const existingModal = document.getElementById('serverSettingsModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'serverSettingsModal';
        modal.className = 'server-create-modal';
        
        modal.innerHTML = `
            <div class="server-create-content">
                <div class="server-create-header">
                    <h2 class="server-create-title">サーバー設定</h2>
                    <p class="server-create-subtitle">サーバーの設定を変更できます。</p>
                </div>
                
                <div class="server-create-body">
                    <div class="form-group">
                        <label class="form-label">サーバーアイコン</label>
                        <div class="server-icon-upload">
                            <div class="server-icon-preview" id="currentServerIconPreview">
                                <span id="currentServerIconText">?</span>
                            </div>
                            <div class="server-icon-input-group">
                                <input type="file" id="newServerIconInput" class="server-icon-input" accept="image/*">
                                <button type="button" class="server-icon-button" id="newServerIconUploadBtn">
                                    新しい画像をアップロード
                                </button>
                                <p style="color: #72767d; font-size: 12px; margin-top: 8px;">推奨: 正方形、最小128x128px、最大8MB</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">サーバー管理</label>
                        <div class="server-management-buttons">
                            <button type="button" class="btn-secondary" id="inviteManagerBtn">
                                🔗 招待リンク管理
                            </button>
                            <button type="button" class="btn-secondary" id="roleManagerBtn">
                                🎭 ロール管理
                            </button>
                            <p style="color: #72767d; font-size: 12px; margin-top: 8px;">サーバーに他のユーザーを招待するためのリンクやロールの権限を管理します</p>
                        </div>
                        
                        <!-- 危険な操作セクション -->
                        <div style="border-top: 1px solid #3e4146; margin-top: 20px; padding-top: 20px;">
                            <h3 style="color: #f04747; margin-bottom: 10px;">⚠️ 危険な操作</h3>
                            <button type="button" class="btn-danger" id="deleteServerBtn" style="background: #f04747; color: white; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer; width: 100%;">
                                🗑️ サーバーを削除
                            </button>
                            <p style="color: #72767d; font-size: 12px; margin-top: 8px;">この操作は取り消せません。すべてのチャンネル、メッセージ、設定が削除されます。</p>
                        </div>
                    </div>
                </div>
                
                <div class="server-create-footer">
                    <button type="button" class="btn-cancel" id="cancelServerSettingsBtn">キャンセル</button>
                    <button type="button" class="btn-create" id="updateServerIconBtn">更新</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // 現在のサーバー情報を取得して表示
        this.loadCurrentServerInfo(serverId);
        
        // イベントリスナーを設定
        this.setupServerSettingsEvents(serverId);
    }

    // 現在のサーバー情報を読み込み
    async loadCurrentServerInfo(serverId) {
        try {
            const guild = this.chatUI.chatManager.guilds.find(g => g.id == serverId);
            if (guild) {
                const iconPreview = document.getElementById('currentServerIconPreview');
                const iconText = document.getElementById('currentServerIconText');
                
                if (guild.icon_url) {
                    iconPreview.innerHTML = `<img src="${guild.icon_url}" alt="サーバーアイコン">`;
                } else {
                    iconText.textContent = guild.name ? guild.name.charAt(0).toUpperCase() : '?';
                }
            }
        } catch (error) {
            console.error('サーバー情報の取得に失敗:', error);
        }
    }

    // サーバー設定モーダルのイベントを設定
    setupServerSettingsEvents(serverId) {
        const newServerIconInput = document.getElementById('newServerIconInput');
        const iconPreview = document.getElementById('currentServerIconPreview');
        const updateBtn = document.getElementById('updateServerIconBtn');
        const inviteManagerBtn = document.getElementById('inviteManagerBtn');
        const roleManagerBtn = document.getElementById('roleManagerBtn');
        const deleteServerBtn = document.getElementById('deleteServerBtn');
        const cancelBtn = document.getElementById('cancelServerSettingsBtn');
        const modal = document.getElementById('serverSettingsModal');
        
        // キャンセルボタン
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        // サーバー削除ボタン
        if (deleteServerBtn) {
            deleteServerBtn.addEventListener('click', async () => {
                modal.remove();
                await this.deleteServer(serverId);
            });
        }
        
        // 招待リンク管理ボタン
        inviteManagerBtn.addEventListener('click', () => {
            // モーダルを閉じる
            document.getElementById('serverSettingsModal').remove();
            
            // 招待リンク管理画面を表示
            this.chatUI.settingsHandler.showInviteManager(serverId);
        });
        
        // ロール管理ボタン
        roleManagerBtn.addEventListener('click', () => {
            // モーダルを閉じる
            document.getElementById('serverSettingsModal').remove();
            
            // ロール管理画面を表示
            this.chatUI.settingsHandler.showRoleManager(serverId);
        });
        
        // アイコンファイル選択
        newServerIconInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 8 * 1024 * 1024) {
                    if (window.notificationManager) {
                        window.notificationManager.error('ファイルサイズは8MB以下にしてください');
                    } else {
                        this.chatUI.uiUtils.showNotification('ファイルサイズは8MB以下にしてください', 'error');
                    }
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    iconPreview.innerHTML = `<img src="${e.target.result}" alt="新しいサーバーアイコン">`;
                };
                reader.readAsDataURL(file);
            }
        });

        // 新しいサーバーアイコンアップロードボタン
        const newServerIconUploadBtn = document.getElementById('newServerIconUploadBtn');
        if (newServerIconUploadBtn) {
            newServerIconUploadBtn.addEventListener('click', () => {
                document.getElementById('newServerIconInput').click();
            });
        }
        
        // 更新ボタン
        updateBtn.addEventListener('click', async () => {
            const file = newServerIconInput.files[0];
            if (!file) {
                if (window.notificationManager) {
                    window.notificationManager.error('新しいアイコンを選択してください');
                } else {
                    this.chatUI.uiUtils.showNotification('新しいアイコンを選択してください', 'error');
                }
                return;
            }
            
            updateBtn.disabled = true;
            updateBtn.innerHTML = '<div class="loading-spinner"></div>';
            
            try {
                await this.uploadServerIcon(serverId, file);
                
                if (window.notificationManager) {
                    window.notificationManager.success('サーバーアイコンが更新されました');
                } else {
                    this.chatUI.uiUtils.showNotification('サーバーアイコンが更新されました', 'success');
                }
                
                // サーバーリストを更新
                await this.chatUI.chatManager.loadGuilds();
                this.renderServerList(this.chatUI.chatManager.guilds);
                
                // モーダルを閉じる
                document.getElementById('serverSettingsModal').remove();
                
            } catch (error) {
                console.error('アイコンアップロードエラー:', error);
                if (window.notificationManager) {
                    window.notificationManager.error(error.message || 'アイコンの更新に失敗しました');
                } else {
                    this.chatUI.uiUtils.showNotification('アイコンの更新に失敗しました: ' + error.message, 'error');
                }
            } finally {
                updateBtn.disabled = false;
                updateBtn.innerHTML = '更新';
            }
        });
    }

    // サーバー削除機能
    async deleteServer(guildId) {
        try {
            let shouldDelete;
            if (window.notificationManager) {
                shouldDelete = await window.notificationManager.confirm(
                    '本当にこのサーバーを削除しますか？この操作は取り消せません。', 
                    'サーバー削除の確認', 
                    '削除', 
                    'キャンセル'
                );
            } else {
                shouldDelete = confirm('本当にこのサーバーを削除しますか？この操作は取り消せません。');
            }
            
            if (!shouldDelete) {
                return;
            }

            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                throw new Error('認証が必要です');
            }

            const response = await fetch(`api/guilds/${guildId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            const data = await response.json();

            if (data.success) {
                // 成功通知
                if (window.notificationManager) {
                    window.notificationManager.success('サーバーが削除されました');
                } else {
                    this.chatUI.uiUtils.showNotification('サーバーが削除されました', 'success');
                }

                // サーバーリストを更新
                await this.chatUI.chatManager.loadGuilds();
                
                // 少し待機してからUIを更新（サーバー側の削除が完全に反映されるまで）
                setTimeout(() => {
                    this.renderServerList(this.chatUI.chatManager.guilds);
                }, 100);
                
                // 削除されたサーバーが現在選択されている場合は、マイサーバーに切り替え
                if (this.chatUI.currentGuildId == guildId) {
                    await this.chatUI.selectMyServer();
                }

            } else {
                throw new Error(data.message || 'サーバーの削除に失敗しました');
            }

        } catch (error) {
            console.error('サーバー削除エラー:', error);
            
            if (window.notificationManager) {
                window.notificationManager.error(error.message || 'サーバーの削除に失敗しました');
            } else {
                this.chatUI.uiUtils.showNotification('サーバーの削除に失敗しました: ' + error.message, 'error');
            }
        }
    }
}

// グローバルスコープに登録
window.ServerManager = ServerManager;
