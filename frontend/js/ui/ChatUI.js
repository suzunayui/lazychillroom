// チャット画面UI管理クラス
class ChatUI {
    constructor() {
        this.chatManager = new ChatManager();
        this.channelManager = new ChannelManager();
        this.currentGuild = null;
        this.currentChannel = null;
        this.isDMMode = false;
        this.isSending = false; // 連打防止フラグ

        // サブ管理クラスの初期化
        this.stateManager = new StateManager(this);
        this.settingsHandler = new SettingsHandler(this);
        this.fileUploadHandler = new FileUploadHandler(this);
        this.serverManager = new ServerManager(this);
        this.uiUtils = new UIUtils(this);
        this.eventHandler = new EventHandler(this);
        
        // 新しいマネージャーの初期化
        this.typingManager = new TypingManager();
        this.dmManager = new DMManager();
        this.friendsManager = new FriendsManager();
        this.friendsUI = new FriendsUI(this);
        this.reactionManager = new ReactionManager();
        this.presenceManager = new PresenceManager();
    }

    async init() {
        try {
            console.log('🚀 ChatUI初期化開始...');
            
            // ローディング状態を表示
            this.showLoadingScreen();
            
            // ChatManagerの初期化完了まで待機
            await this.chatManager.init();
            
            // currentUserをChatManagerから取得
            this.currentUser = this.chatManager.currentUser;
            
            // グローバルアクセス用
            window.chatUI = this;
            this.messageManager = this.chatManager.messageManager; // インスタンス変数として設定
            window.messageManager = this.chatManager.messageManager; // MessageManagerをグローバルに設定
            window.presenceManager = this.presenceManager; // PresenceManagerをグローバルに設定
            
            // デバッグ: MessageManagerの初期化確認
            console.log('🔍 MessageManager初期化確認:', {
                chatManager: !!this.chatManager,
                messageManager: !!this.messageManager,
                scrollToBottom: !!(this.messageManager && this.messageManager.scrollToBottom)
            });
            
            // UI要素のレンダリング
            this.render();
            this.eventHandler.bindEvents();
            
            // リアルタイム通信のイベントハンドラーを設定
            this.setupRealtimeEventHandlers();
            
            // 新しいマネージャーの初期化（initメソッドがあるもののみ）
            this.dmManager.init();
            this.friendsUI.setManagers(this.friendsManager, this.dmManager);
            await this.presenceManager.init(); // awaitを追加
            
            await this.loadInitialData();
            
            // メンバーリストの表示は loadInitialData で状態復元後に決定される
            // （マイサーバーの場合は非表示、通常のサーバーの場合は表示）
            
            // 初期アバターを更新
            this.settingsHandler.updateInitialAvatar();
            
            // 読み込み完了フラグを設定（ちらつき防止）
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.classList.add('loaded');
            }
            
            // ローディング画面を隠してメインアプリを表示
            this.hideLoadingScreen();
            
            console.log('✅ ChatUI初期化完了');
        } catch (error) {
            console.error('❌ ChatUI初期化エラー:', error);
            this.showErrorMessage('アプリケーションの初期化に失敗しました。ページを再読み込みしてください。');
        }
    }

    render() {
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = UIComponents.createChatContainer(this.currentUser);
        
        // 画像モーダルを body に追加
        if (!document.getElementById('imageModal')) {
            document.body.insertAdjacentHTML('beforeend', UIComponents.createImageModal());
        }
    }

    // DMモードを開く
    async showDMMode() {
        this.isDMMode = true;
        
        await this.serverManager.showDMUserList();
        document.getElementById('dmButton').classList.add('active');
        document.querySelectorAll('.server-item').forEach(item => {
            item.classList.remove('active');
        });
        this.uiUtils.hideMembersList();
        
        // 状態を保存
        this.stateManager.saveState();
    }

    // チャンネル切り替え（EventHandlerから呼び出される）
    async switchChannel(channelItem) {
        await this.eventHandler.switchChannel(channelItem);
    }

    // DM切り替え（EventHandlerから呼び出される）
    async switchDM(dmItem) {
        await this.eventHandler.switchDM(dmItem);
    }

    // 初期データ読み込み
    async loadInitialData() {
        try {
            console.log('🚀 初期データ読み込み開始...');
            this.updateLoadingText('サーバー情報を読み込み中...');
            
            // 保存された状態を読み込み
            const savedState = this.stateManager.loadState();
            
            const guilds = await this.chatManager.loadGuilds();
            console.log('📊 読み込まれたサーバー一覧:', guilds);
            
            this.updateLoadingText('サーバー一覧を表示中...');
            this.serverManager.renderServerList(guilds);
            
            // DOM更新を確実に待つ
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 状態復元を試行
            if (savedState) {
                console.log('🔄 保存された状態を元に復元を試行します...');
                this.updateLoadingText('前回の状態を復元中...');
                const restored = await this.stateManager.restoreState(savedState, guilds);
                if (restored) {
                    console.log('✅ 状態復元が成功しました');
                    return;
                } else {
                    console.log('⚠️ 状態復元に失敗、デフォルト初期化に移行します');
                }
            } else {
                console.log('💡 保存された状態がないため、デフォルト初期化を実行します');
            }
            
            // デフォルトの初期化
            if (guilds.length > 0) {
                console.log('🏁 デフォルト初期化を実行: 最初のサーバーを選択します');
                this.updateLoadingText('チャンネルを読み込み中...');
                this.currentGuild = guilds[0];
                
                // セクションタイトルを設定
                const sectionTitle = document.getElementById('sectionTitle');
                sectionTitle.textContent = 'テキストチャンネル';
                
                await this.loadAndRenderChannels(this.currentGuild.id);
                this.uiUtils.setActiveServer(this.currentGuild.id);
                
                // DOM更新を待ってからサーバーアイテムを取得
                console.log('👥 メンバーリストを初期化中...');
                this.updateLoadingText('メンバー情報を読み込み中...');
                
                // DOM更新を確実に待つ
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const firstServerItem = document.querySelector(`.server-item[data-server="${this.currentGuild.id}"]`);
                console.log('🔍 First server item found:', firstServerItem);
                
                if (firstServerItem) {
                    console.log('🔄 switchServerを呼び出してメンバーリストを更新します');
                    await this.serverManager.switchServer(firstServerItem, true); // skipChannelLoad=trueで重複回避
                } else {
                    console.log('⚠️ サーバーアイテムが見つからないため、直接メンバーリストを更新します');
                    // フォールバック: 直接メンバーリストを更新
                    const guildDetails = await this.chatManager.loadGuildDetails(this.currentGuild.id);
                    if (guildDetails && guildDetails.members) {
                        console.log('📝 直接メンバーリスト更新:', guildDetails.members.length, 'メンバー');
                        this.updateMembersList(guildDetails.members);
                        this.uiUtils.showMembersList();
                    }
                }
                
                // デフォルトチャンネル（一般チャンネル）を自動選択
                console.log('🎯 デフォルトチャンネルを選択中...');
                this.updateLoadingText('デフォルトチャンネルを選択中...');
                const defaultChannel = await this.selectDefaultChannel(this.currentGuild.id);
                if (defaultChannel) {
                    console.log('✅ デフォルトチャンネル選択完了:', defaultChannel.name);
                } else {
                    console.log('⚠️ デフォルトチャンネルが見つかりません');
                }
                
                // 通常のサーバーの場合はメンバーリストを表示
                if (!this.currentGuild.is_personal_server) {
                    this.uiUtils.showMembersList();
                    
                    // 確実にメンバー情報が表示されるよう追加チェック
                    const onlineMembers = document.getElementById('onlineMembers');
                    if (onlineMembers && onlineMembers.innerHTML.trim() === '') {
                        console.log('⚠️ メンバーリストが空のため、再取得します');
                        const guildDetails = await this.chatManager.loadGuildDetails(this.currentGuild.id);
                        if (guildDetails && guildDetails.members) {
                            console.log('🔄 メンバーリスト再取得成功:', guildDetails.members.length, 'メンバー');
                            this.updateMembersList(guildDetails.members);
                        }
                    }
                } else {
                    this.uiUtils.hideMembersList();
                }
                
                // アバターを更新
                if (this.currentUser && this.currentUser.avatar_url) {
                    this.settingsHandler.updateSidebarAvatar(this.currentUser.avatar_url);
                } else {
                    // localStorageからもチェック
                    const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                    if (storedUser && storedUser.avatar_url) {
                        this.settingsHandler.updateSidebarAvatar(storedUser.avatar_url);
                        // currentUserを更新
                        if (this.currentUser) {
                            this.currentUser.avatar_url = storedUser.avatar_url;
                        }
                    }
                }
                
                // 初期状態を保存
                this.stateManager.saveState();
                console.log('💾 デフォルト初期化完了、状態を保存しました');
            } else {
                console.log('⚠️ 利用可能なサーバーがありません');
            }
            
            this.updateLoadingText('準備完了...');
            console.log('✅ 初期データ読み込み完了');
        } catch (error) {
            console.error('初期データ読み込みエラー:', error);
            throw error; // エラーを上位に伝播
        }
    }

    // ギルドチャンネル一覧を再読み込み
    async loadGuildChannels(guildId) {
        try {
            await this.chatManager.loadChannels(guildId);
            await this.loadAndRenderChannels(guildId);
        } catch (error) {
            console.error('チャンネル一覧の再読み込みエラー:', error);
        }
    }

    renderChannelList(channels) {
        const channelsList = document.getElementById('channelsList');
        channelsList.innerHTML = UIComponents.createChannelListHTML(channels);
    }

    async loadAndRenderMessages(channelId) {
        try {
            // ChatManagerのcurrentChannelを設定
            this.chatManager.currentChannel = this.currentChannel;
            const messages = await this.chatManager.loadMessages(channelId);
            this.chatManager.renderMessages(messages);
            
            // メッセージ表示後に確実に最下部へスクロール
            setTimeout(() => {
                if (this.messageManager && typeof this.messageManager.scrollToBottom === 'function') {
                    this.messageManager.scrollToBottom();
                } else {
                    console.warn('⚠️ MessageManager or scrollToBottom method not available');
                    // フォールバック: 直接DOM操作でスクロール
                    const messagesContainer = document.querySelector('.messages-container');
                    if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
            }, 200);
        } catch (error) {
            console.error('メッセージ読み込みエラー:', error);
        }
    }

    async loadAndRenderChannels(guildId) {
        try {
            console.log(`📂 チャンネル一覧を読み込み中... (サーバーID: ${guildId})`);
            const channels = await this.chatManager.loadChannels(guildId);
            console.log(`📋 読み込まれたチャンネル数: ${channels.length}`, channels);
            this.renderChannelList(channels);
            
            const firstTextChannel = channels.find(ch => ch.type === 'text');
            if (firstTextChannel) {
                console.log(`🎯 デフォルトチャンネルを選択: ${firstTextChannel.name} (ID: ${firstTextChannel.id})`);
                this.currentChannel = firstTextChannel;
                this.chatManager.currentChannel = firstTextChannel;
                await this.loadAndRenderMessages(firstTextChannel.id);
                this.uiUtils.setActiveChannel(firstTextChannel.id);
                this.updateChatHeader(firstTextChannel);
                
                // 状態を保存
                this.stateManager.saveState();
            } else {
                console.log('⚠️ テキストチャンネルが見つかりません');
            }
        } catch (error) {
            console.error('❌ チャンネル読み込みエラー:', error);
        }
    }

    updateChatHeader(channel) {
        const channelHash = document.getElementById('channelHash');
        const channelName = document.getElementById('currentChannelName');
        const channelTopic = document.getElementById('channelTopic');
        const messageInput = document.getElementById('messageInput');
        
        if (channel.type === 'text' || channel.type === 'settings') {
            if (channel.name === '設定' || channel.type === 'settings') {
                // 設定チャンネルの場合
                channelHash.style.display = 'inline';
                channelHash.textContent = '⚙️'; // 設定アイコン
                channelName.textContent = channel.name;
                channelTopic.textContent = channel.topic || 'プロフィール設定やアカウント管理';
                
                // 設定チャンネル専用UIを表示
                this.settingsHandler.showSettingsChannel();
                return; // 通常のメッセージ表示はしない
            } else {
                channelHash.style.display = 'inline';
                channelHash.textContent = '#';
                channelName.textContent = channel.name;
                channelTopic.textContent = channel.topic || 'トピックなし';
                messageInput.placeholder = `#${channel.name} にメッセージを送信`;
            }
        } else if (channel.type === 'uploader_public') {
            channelHash.style.display = 'inline';
            channelHash.textContent = '🌐'; // 公開アップローダーのアイコン
            channelName.textContent = channel.name;
            channelTopic.textContent = channel.topic || '公開ファイルアップローダー';
            messageInput.placeholder = `ファイルをアップロード、またはメモを入力...`;
        } else if (channel.type === 'uploader_private') {
            channelHash.style.display = 'inline';
            channelHash.textContent = '🔒'; // 非公開アップローダーのアイコン
            channelName.textContent = channel.name;
            channelTopic.textContent = channel.topic || '非公開ファイルアップローダー';
            messageInput.placeholder = `ファイルをアップロード、またはメモを入力...`;
        } else {
            channelHash.style.display = 'none';
            channelName.textContent = channel.display_name || channel.name;
            channelTopic.textContent = 'ダイレクトメッセージ';
            messageInput.placeholder = `${channel.display_name || channel.name} にメッセージを送信`;
        }
        
        // 設定チャンネル以外の場合はメッセージ入力エリアを表示
        const messageInputContainer = document.querySelector('.message-input-container');
        if (messageInputContainer) {
            messageInputContainer.style.display = 'flex';
        }
    }

    showMembersList() {
        const membersSidebar = document.getElementById('membersSidebar');
        if (membersSidebar) {
            membersSidebar.style.display = 'flex';
            membersSidebar.classList.add('show');
        }
    }

    hideMembersList() {
        const membersSidebar = document.getElementById('membersSidebar');
        if (membersSidebar) {
            membersSidebar.style.display = 'none';
            membersSidebar.classList.remove('show');
        }
    }

    updateMembersList(members) {
        console.log('📝 updateMembersList called with members:', members);
        console.log('📝 updateMembersList members array length:', members ? members.length : 'null/undefined');
        
        const onlineMembers = document.getElementById('onlineMembers');
        const offlineMembers = document.getElementById('offlineMembers');
        const membersCount = document.getElementById('membersCount');
        
        if (!onlineMembers || !offlineMembers) {
            console.error('❌ Members list elements not found');
            console.error('❌ onlineMembers element:', onlineMembers);
            console.error('❌ offlineMembers element:', offlineMembers);
            return;
        }

        // memberがnullやundefinedの場合は空配列に設定
        const safeMembers = members || [];
        console.log('📝 Safe members array:', safeMembers);

        // メンバーをステータスに基づいて分類
        const online = safeMembers.filter(member => {
            const status = member.status || 'offline';
            return status === 'online' || status === 'away' || status === 'busy';
        });
        
        const offline = safeMembers.filter(member => {
            const status = member.status || 'offline';
            return status === 'offline' || status === 'invisible';
        });
        
        console.log('📊 Online members:', online.length, online);
        console.log('📊 Offline members:', offline.length, offline);

        // HTMLを生成して設定
        const onlineHTML = UIComponents.createMemberListHTML(online, 'online');
        const offlineHTML = UIComponents.createMemberListHTML(offline, 'offline');
        
        console.log('📊 Generated online HTML:', onlineHTML);
        console.log('📊 Generated offline HTML:', offlineHTML);

        onlineMembers.innerHTML = onlineHTML;
        offlineMembers.innerHTML = offlineHTML;

        if (membersCount) {
            const totalMembers = safeMembers.length;
            membersCount.textContent = `メンバー - ${totalMembers}`;
            console.log('📊 Updated members count:', totalMembers);
        }

        const onlineSection = document.querySelector('.members-section:first-child .section-title');
        const offlineSection = document.querySelector('.members-section:last-child .section-title');
        
        if (onlineSection) {
            onlineSection.textContent = `オンライン - ${online.length}`;
            console.log('📊 Updated online section title:', online.length);
        }
        
        if (onlineSection) {
            onlineSection.textContent = `オンライン - ${online.length}`;
        }
        if (offlineSection) {
            offlineSection.textContent = `オフライン - ${offline.length}`;
        }
    }

    async logout() {
        let shouldLogout;
        if (window.notificationManager) {
            shouldLogout = await window.notificationManager.confirm(
                'ログアウトしますか？', 
                'ログアウト確認', 
                'ログアウト', 
                'キャンセル'
            );
        } else {
            shouldLogout = confirm('ログアウトしますか？');
        }
        
        if (shouldLogout) {
            // AuthManagerの統一されたログアウト処理を使用
            if (window.AuthManager) {
                const authManager = new window.AuthManager();
                authManager.logout();
            } else {
                // フォールバック処理
                console.log('⚠️ AuthManagerが見つかりません。フォールバックログアウト処理を実行します。');
                localStorage.removeItem('authToken');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('currentUser');
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('currentUser');
                window.location.reload();
            }
        }
    }

    async handleLogout() {
        await this.logout();
    }

    // ローディング画面表示
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContainer = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            loadingScreen.classList.remove('fade-out');
        }
        if (appContainer) {
            appContainer.style.display = 'none';
        }
    }

    // ローディング画面非表示
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContainer = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            // フェードアウト完了後に非表示
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
        if (appContainer) {
            appContainer.style.display = 'block';
        }
    }

    // ローディングテキスト更新
    updateLoadingText(text) {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    // エラーメッセージ表示
    showErrorMessage(message) {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            const loadingContent = loadingScreen.querySelector('.loading-content');
            if (loadingContent) {
                loadingContent.innerHTML = `
                    <div class="error-icon" style="font-size: 48px; color: var(--red); margin-bottom: 16px;">⚠️</div>
                    <div class="error-text" style="color: var(--text-primary); font-size: var(--font-size-lg); text-align: center; max-width: 300px;">${message}</div>
                `;
            }
        }
    }

    // sendMessage メソッドを修正してファイルアップロードに対応
    async sendMessage() {
        // 連打防止: 送信中なら早期リターン
        if (this.isSending) {
            console.log('🚫 送信中のため、重複送信をブロックしました');
            return;
        }
        
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!this.currentChannel) return;

        // 送信フラグを立てる
        this.isSending = true;
        
        try {
            // アップローダーチャンネルの場合
            if (this.currentChannel.type === 'uploader_public' || this.currentChannel.type === 'uploader_private') {
                // ファイルが選択されている場合はアップローダー用アップロード
                if (this.fileUploadHandler.selectedFiles.length > 0) {
                    await this.fileUploadHandler.uploadUploaderFiles();
                    return;
                }
                
                // テキストメッセージ（メモ）の場合は通常のメッセージ送信
                if (message) {
                    const result = await this.chatManager.sendMessage(this.currentChannel.id, message);
                    
                    if (result.success) {
                        this.chatManager.addMessage(result.message);
                        messageInput.value = '';
                    } else {
                        this.uiUtils.showNotification('メッセージの送信に失敗しました: ' + result.error, 'error');
                    }
                    return;
                }
                return;
            }

            // 通常のチャンネルの場合
            // ファイルが選択されている場合はファイルアップロード
            if (this.fileUploadHandler.selectedFiles.length > 0) {
                await this.fileUploadHandler.uploadFiles();
                return;
            }

            // テキストメッセージのみの場合
            if (!message) return;

            const result = await this.chatManager.sendMessage(this.currentChannel.id, message);
            
            if (result.success) {
                this.chatManager.addMessage(result.message);
                messageInput.value = '';
            } else {
                this.uiUtils.showNotification('メッセージの送信に失敗しました: ' + result.error, 'error');
            }
        } finally {
            // 送信フラグをリセット（1秒後）
            setTimeout(() => {
                this.isSending = false;
            }, 1000);
        }
    }

    // リアルタイム通信のイベントハンドラーを設定
    setupRealtimeEventHandlers() {
        if (!window.realtimeManager) {
            console.warn('RealtimeManager が利用できません');
            return;
        }

        // 新しいメッセージを受信
        window.realtimeManager.on('newMessage', (message) => {
            console.log('リアルタイムメッセージ受信:', message);
            this.handleNewRealtimeMessage(message);
        });

        // メッセージ削除
        window.realtimeManager.on('messageDeleted', (data) => {
            this.handleMessageDeleted(data);
        });

        // メッセージ編集
        window.realtimeManager.on('messageEdited', (message) => {
            this.handleMessageEdited(message);
        });

        // タイピング状態
        window.realtimeManager.on('userTyping', (data) => {
            this.handleUserTyping(data);
        });

        window.realtimeManager.on('userStopTyping', (data) => {
            this.handleUserStopTyping(data);
        });

        // ユーザーオンライン状態
        window.realtimeManager.on('userOnline', (user) => {
            this.handleUserOnline(user);
        });

        window.realtimeManager.on('userOffline', (user) => {
            this.handleUserOffline(user);
        });

        // Socket.io接続状態
        window.realtimeManager.on('socket_connected', async () => {
            console.log('Socket.io接続完了');
            this.showConnectionStatus('connected');
            
            // Socket接続時にステータスを再同期
            if (this.presenceManager) {
                await this.presenceManager.syncCurrentStatusWithServer();
            }
        });

        window.realtimeManager.on('socket_disconnected', (reason) => {
            console.log('Socket.io切断:', reason);
            this.showConnectionStatus('disconnected');
        });

        window.realtimeManager.on('auth_error', (error) => {
            console.error('Socket.io認証エラー:', error);
            this.showConnectionStatus('auth_error');
        });
    }

    // 新しいリアルタイムメッセージの処理
    handleNewRealtimeMessage(message) {
        console.log('🔄 ChatUI: リアルタイムメッセージ処理開始:', {
            message,
            currentChannel: this.currentChannel,
            currentChannelId: this.currentChannel?.id,
            messageChannelId: message.channel_id,
            isMatch: this.currentChannel && message.channel_id == this.currentChannel.id
        });
        
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            console.error('❌ chatMessagesエリアが見つかりません');
            return;
        }

        // 現在のチャネルのメッセージの場合のみ表示
        if (this.currentChannel && message.channel_id == this.currentChannel.id) {
            console.log('✅ チャネルID一致 - メッセージを追加します');
            
            // MessageManagerを使用してメッセージを追加
            if (window.messageManager) {
                console.log('📝 MessageManagerでメッセージ追加');
                window.messageManager.addMessage(message);
            } else {
                console.log('📝 直接DOM操作でメッセージ追加');
                // フォールバック: 直接DOM操作
                const messageElement = this.createMessageElement(message);
                chatMessages.appendChild(messageElement);
                this.scrollToBottom();
            }

            // 通知を表示（自分のメッセージでない場合）
            if (message.user_id != this.currentUser.id && window.notificationManager) {
                window.notificationManager.showNotification(
                    `${message.userid}`,
                    message.content,
                    'message'
                );
            }
        } else {
            console.log('❌ チャネルID不一致またはcurrentChannelが未設定 - メッセージを表示しません');
        }
    }

    // メッセージ削除の処理
    handleMessageDeleted(data) {
        const messageElement = document.querySelector(`[data-message-id="${data.message_id}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    }

    // メッセージ編集の処理
    handleMessageEdited(message) {
        const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.message-content');
            if (contentElement) {
                contentElement.textContent = message.content;
                // 編集マークを追加
                if (!messageElement.querySelector('.edited-mark')) {
                    const editedMark = document.createElement('span');
                    editedMark.className = 'edited-mark';
                    editedMark.textContent = ' (編集済み)';
                    contentElement.appendChild(editedMark);
                }
            }
        }
    }

    // タイピング状態の処理
    handleUserTyping(data) {
        // タイピングインジケーターを表示
        this.showTypingIndicator(data.userid);
    }

    // タイピング停止の処理
    handleUserStopTyping(data) {
        // タイピングインジケーターを非表示
        this.hideTypingIndicator(data.userid);
    }

    // ユーザーオンライン状態の処理
    handleUserOnline(user) {
        // メンバーリストの更新
        this.updateMemberStatus(user.id, 'online');
    }

    // ユーザーオフライン状態の処理
    handleUserOffline(user) {
        // メンバーリストの更新
        this.updateMemberStatus(user.id, 'offline');
    }

    // 接続状態の表示
    showConnectionStatus(status) {
        // 接続状態インジケーターを表示
        let statusElement = document.querySelector('.connection-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.className = 'connection-status';
            document.body.appendChild(statusElement);
        }

        statusElement.classList.remove('connected', 'disconnected', 'auth-error');
        statusElement.classList.add(status);
        
        switch(status) {
            case 'connected':
                statusElement.textContent = '✓ リアルタイム接続';
                statusElement.style.display = 'none'; // 正常時は非表示
                break;
            case 'disconnected':
                statusElement.textContent = '⚠ 接続が切断されました';
                statusElement.style.display = 'block';
                break;
            case 'auth_error':
                statusElement.textContent = '❌ 認証エラー';
                statusElement.style.display = 'block';
                break;
        }
    }

    // タイピングインジケーターの表示
    showTypingIndicator(userid) {
        let typingContainer = document.querySelector('.typing-indicator');
        if (!typingContainer) {
            typingContainer = document.createElement('div');
            typingContainer.className = 'typing-indicator';
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages && chatMessages.parentNode) {
                chatMessages.parentNode.appendChild(typingContainer);
            }
        }
        
        typingContainer.textContent = `${userid} がタイピング中...`;
        typingContainer.style.display = 'block';
        
        // 一定時間後に自動で非表示
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.hideTypingIndicator(userid);
        }, 3000);
    }

    // タイピングインジケーターの非表示
    hideTypingIndicator(userid) {
        const typingContainer = document.querySelector('.typing-indicator');
        if (typingContainer) {
            typingContainer.style.display = 'none';
        }
    }

    // メンバーステータスの更新
    updateMemberStatus(userId, status) {
        const memberElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (memberElement) {
            const statusIndicator = memberElement.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.classList.remove('online', 'offline');
                statusIndicator.classList.add(status);
            }
        }
    }

    // メッセージ要素の作成（フォールバック用）
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.setAttribute('data-message-id', message.id);
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${message.avatar_url || '/default-avatar.png'}" alt="${message.userid}">
            </div>
            <div class="message-content-wrapper">
                <div class="message-header">
                    <span class="message-userid">${message.userid}</span>
                    <span class="message-timestamp">${new Date(message.created_at).toLocaleTimeString()}</span>
                </div>
                <div class="message-content">${message.content}</div>
            </div>
        `;
        
        return messageDiv;
    }

    // デフォルトチャンネル（一般チャンネル）を自動選択
    async selectDefaultChannel(guildId) {
        try {
            // 現在表示されているチャンネルリストから「一般」チャンネルを検索
            const channelItems = document.querySelectorAll('.channel-item');
            let defaultChannelElement = null;
            
            // 「一般」チャンネルを優先的に探す
            for (const item of channelItems) {
                const channelName = item.querySelector('.channel-name');
                if (channelName && channelName.textContent === '一般') {
                    defaultChannelElement = item;
                    break;
                }
            }
            
            // 「一般」が見つからない場合は最初のテキストチャンネルを選択
            if (!defaultChannelElement) {
                const firstTextChannel = document.querySelector('.channel-item:not(.uploader-channel)');
                if (firstTextChannel) {
                    defaultChannelElement = firstTextChannel;
                    console.log('ℹ️ 「一般」チャンネルが見つからないため、最初のテキストチャンネルを選択します');
                }
            }
            
            if (defaultChannelElement) {
                const channelId = defaultChannelElement.dataset.channel;
                const channelName = defaultChannelElement.querySelector('.channel-name').textContent;
                
                console.log(`🎯 デフォルトチャンネル選択: ${channelName} (ID: ${channelId})`);
                
                // チャンネルを選択状態にする
                document.querySelectorAll('.channel-item').forEach(item => {
                    item.classList.remove('active');
                });
                defaultChannelElement.classList.add('active');
                
                // チャンネル詳細を取得して表示を更新
                const channelDetails = await this.chatManager.getChannelDetails(channelId);
                if (channelDetails) {
                    this.currentChannel = channelDetails;
                    this.updateChannelDisplay(channelDetails);
                    
                    // チャンネルのメッセージを読み込み
                    await this.loadAndRenderMessages(channelId);
                    
                    return channelDetails;
                }
            } else {
                console.log('⚠️ 選択可能なデフォルトチャンネルが見つかりません');
            }
            
            return null;
        } catch (error) {
            console.error('❌ デフォルトチャンネル選択エラー:', error);
            return null;
        }
    }

    // フレンド画面を表示
    async showFriendsView() {
        try {
            // DMモードを無効化
            this.isDMMode = false;
            
            // サーバー選択状態をクリア
            document.querySelectorAll('.server-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // DMボタンの状態をクリア
            const dmButton = document.getElementById('dmButton');
            if (dmButton) {
                dmButton.classList.remove('active');
            }
            
            // メンバーリストを非表示
            this.uiUtils.hideMembersList();
            
            // フレンド画面を表示
            await this.friendsUI.showFriendsView();
            
            console.log('✅ フレンド画面表示完了');
        } catch (error) {
            console.error('❌ フレンド画面表示エラー:', error);
            this.uiUtils.showNotification('フレンド画面の表示に失敗しました', 'error');
        }
    }
}

// グローバルスコープに ChatUI を追加
window.ChatUI = ChatUI;
