// チャット画面UI管理クラス
class ChatUI {
    constructor() {
        this.chatManager = new ChatManager();
        this.channelManager = new ChannelManager();
        this.currentGuild = null;
        this.currentChannel = null;
        this.isDMMode = false;
    }

    // 状態保存メソッド
    saveState() {
        const state = {
            isDMMode: this.isDMMode,
            currentGuildId: this.currentGuild?.id || null,
            currentChannelId: this.currentChannel?.id || null,
            isMyServer: this.currentGuild?.is_personal_server || false,
            timestamp: Date.now()
        };
        
        localStorage.setItem('chatUI_state', JSON.stringify(state));
        console.log('状態を保存しました:', state);
    }

    // 状態復元メソッド
    loadState() {
        try {
            const savedState = localStorage.getItem('chatUI_state');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // 24時間以内の状態のみ復元
                const oneDay = 24 * 60 * 60 * 1000;
                if (state.timestamp && (Date.now() - state.timestamp) < oneDay) {
                    console.log('保存された状態を復元します:', state);
                    return state;
                }
            }
        } catch (error) {
            console.error('状態復元エラー:', error);
        }
        return null;
    }

    // 状態復元実行メソッド
    async restoreState(savedState, guilds) {
        try {
            // DMモードの復元
            if (savedState.isDMMode) {
                await this.toggleDMMode();
                
                // DMチャンネルの復元
                if (savedState.currentChannelId) {
                    const dmChannels = await this.chatManager.loadChannels(); // type=dm でDMチャンネルを読み込み
                    const targetDM = dmChannels.find(dm => dm.id == savedState.currentChannelId);
                    if (targetDM) {
                        this.currentChannel = targetDM;
                        this.chatManager.currentChannel = targetDM;
                        this.updateChatHeader(targetDM);
                        await this.loadAndRenderMessages(targetDM.id);
                        this.setActiveDM(targetDM.id);
                        return true;
                    }
                }
                return true; // DMモードに切り替えただけでも成功とする
            }
            
            // マイサーバーの復元
            if (savedState.isMyServer) {
                const myServer = await this.chatManager.getMyServer();
                if (myServer) {
                    this.showMyServer(myServer);
                    
                    // マイサーバーのチャンネル復元
                    if (savedState.currentChannelId && myServer.channels) {
                        const targetChannel = myServer.channels.find(ch => ch.id == savedState.currentChannelId);
                        if (targetChannel) {
                            this.currentChannel = targetChannel;
                            this.chatManager.currentChannel = targetChannel;
                            this.updateChatHeader(targetChannel);
                            await this.loadAndRenderMessages(targetChannel.id);
                            this.setActiveChannel(targetChannel.id);
                        }
                    }
                    return true;
                }
            }
            
            // 通常のサーバーの復元
            if (savedState.currentGuildId) {
                const targetGuild = guilds.find(guild => guild.id == savedState.currentGuildId);
                if (targetGuild) {
                    this.currentGuild = targetGuild;
                    
                    // セクションタイトルを更新
                    const sectionTitle = document.getElementById('sectionTitle');
                    sectionTitle.textContent = 'テキストチャンネル';
                    
                    await this.loadAndRenderChannels(targetGuild.id);
                    this.setActiveServer(targetGuild.id);
                    
                    // チャンネルの復元
                    if (savedState.currentChannelId) {
                        const targetChannel = this.chatManager.channels.find(ch => ch.id == savedState.currentChannelId);
                        if (targetChannel) {
                            this.currentChannel = targetChannel;
                            this.chatManager.currentChannel = targetChannel;
                            this.updateChatHeader(targetChannel);
                            await this.loadAndRenderMessages(targetChannel.id);
                            this.setActiveChannel(targetChannel.id);
                        }
                    }
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('状態復元実行エラー:', error);
            return false;
        }
    }

    async init() {
        // ChatManagerの初期化完了まで待機
        await this.chatManager.init();
        
        // currentUserをChatManagerから取得
        this.currentUser = this.chatManager.currentUser;
        
        // グローバルアクセス用
        window.chatUI = this;
        
        // UI要素のレンダリング
        this.render();
        this.bindEvents();
        await this.loadInitialData();
        
        // 初期状態でメンバーリストを表示（サーバーモードで開始）
        this.showMembersList();
        
        console.log('ChatUI初期化完了');
    }

    render() {
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = UIComponents.createChatContainer(this.currentUser);
        
        // 画像モーダルを body に追加
        if (!document.getElementById('imageModal')) {
            document.body.insertAdjacentHTML('beforeend', UIComponents.createImageModal());
        }
    }

    bindEvents() {
        // DMボタンクリック
        const dmButton = document.getElementById('dmButton');
        if (dmButton) {
            dmButton.addEventListener('click', () => {
                this.toggleDMMode();
            });
        }

        // サーバー切り替え
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.server-item:not(.add-server)')) {
                const serverItem = e.target.closest('.server-item');
                await this.switchServer(serverItem);
            }
        });

        // チャンネル切り替え（DMユーザー切り替えも含む）
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.channel-item')) {
                const item = e.target.closest('.channel-item');
                await this.switchChannel(item);
            } else if (e.target.closest('.dm-user-item:not(.add-friend)')) {
                const item = e.target.closest('.dm-user-item');
                await this.switchDM(item);
            }
        });

        // サーバー追加ボタン（動的に追加されるため、イベント委譲を使用）
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-server')) {
                this.showAddServerModal();
            }
        });

        // チャンネル追加ボタン
        document.addEventListener('click', (e) => {
            if (e.target.closest('#addChannelBtn')) {
                if (this.currentGuild && !this.isDMMode) {
                    this.channelManager.showCreateChannelModal(this.currentGuild.id, 1); // デフォルトでテキストチャンネルカテゴリ
                }
            }
        });

        // メッセージ送信
        const chatForm = document.getElementById('chatForm');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        // ログアウト（下部のボタン）
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        // メッセージ入力欄のEnterキー
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // ユーザー名クリック（マイサーバー）
        document.addEventListener('click', async (e) => {
            if (e.target.closest('#usernameBtn')) {
                await this.openMyServer();
            }
        });

        // マイサーバーボタンクリック
        document.addEventListener('click', async (e) => {
            if (e.target.closest('#myServerBtn')) {
                await this.openMyServer();
            }
        });

        // 画像クリックイベント（モーダル表示）
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('clickable-image')) {
                this.showImageModal(e.target);
            }
        });

        // URLコピーボタンのクリックイベント
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('copy-url-btn')) {
                const url = e.target.dataset.url;
                const fullUrl = window.location.origin + url;
                
                try {
                    await navigator.clipboard.writeText(fullUrl);
                    
                    // ボタンのテキストを一時的に変更
                    const originalText = e.target.textContent;
                    e.target.textContent = '✅ コピー完了';
                    e.target.disabled = true;
                    
                    setTimeout(() => {
                        e.target.textContent = originalText;
                        e.target.disabled = false;
                    }, 2000);
                    
                    this.showNotification('URLをクリップボードにコピーしました', 'success');
                } catch (err) {
                    console.error('クリップボードへのコピーに失敗:', err);
                    this.showNotification('URLのコピーに失敗しました', 'error');
                }
            }
        });

        // ファイルアップロード関連のイベント
        this.bindFileUploadEvents();
    }

    async toggleDMMode() {
        this.isDMMode = !this.isDMMode;
        
        if (this.isDMMode) {
            await this.showDMUserList();
            document.getElementById('dmButton').classList.add('active');
            document.querySelectorAll('.server-item').forEach(item => {
                item.classList.remove('active');
            });
            this.hideMembersList();
        } else {
            await this.showChannelList();
            document.getElementById('dmButton').classList.remove('active');
            if (this.chatManager.guilds.length > 0) {
                const firstGuild = this.chatManager.guilds[0];
                this.setActiveServer(firstGuild.id);
                await this.loadAndRenderChannels(firstGuild.id);
            }
            this.showMembersList();
        }
        
        // 状態を保存
        this.saveState();
    }

    async showDMUserList() {
        const sectionTitle = document.getElementById('sectionTitle');
        const channelsList = document.getElementById('channelsList');
        
        sectionTitle.textContent = 'ダイレクトメッセージ';
        
        const dmChannels = await this.chatManager.loadChannels();
        channelsList.innerHTML = UIComponents.createDMUserListHTML(dmChannels);

        // フレンド追加ボタンのイベントを再バインド
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', () => {
                this.showAddFriendModal();
            });
        }
    }

    async showChannelList() {
        const sectionTitle = document.getElementById('sectionTitle');
        sectionTitle.textContent = 'テキストチャンネル';
        
        if (this.currentGuild) {
            await this.loadAndRenderChannels(this.currentGuild.id);
        }
    }

    async switchServer(serverItem) {
        this.isDMMode = false;
        document.getElementById('dmButton').classList.remove('active');
        
        document.querySelectorAll('.server-item').forEach(item => {
            item.classList.remove('active');
        });

        serverItem.classList.add('active');
        const serverId = serverItem.dataset.server;
        
        const guild = await this.chatManager.loadGuildDetails(serverId);
        if (guild) {
            this.currentGuild = guild;
            
            // セクションタイトルを更新
            const sectionTitle = document.getElementById('sectionTitle');
            sectionTitle.textContent = 'テキストチャンネル';
            
            await this.loadAndRenderChannels(serverId);
            this.updateMembersList(guild.members);
            this.showMembersList();
            
            // 状態を保存
            this.saveState();
            
            console.log(`サーバー切り替え: ${guild.name}`);
        }
    }

    async switchChannel(channelItem) {
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });

        channelItem.classList.add('active');
        const channelId = channelItem.dataset.channel;
        
        // チャンネルを検索する際、通常のサーバーチャンネルとマイサーバーチャンネルの両方を確認
        let channel = this.chatManager.channels.find(ch => ch.id == channelId);
        
        // 通常のチャンネルで見つからない場合、マイサーバーのチャンネルから検索
        if (!channel && this.currentGuild && this.currentGuild.channels) {
            channel = this.currentGuild.channels.find(ch => ch.id == channelId);
        }
        
        if (channel) {
            this.currentChannel = channel;
            this.chatManager.currentChannel = channel; // ChatManagerにも設定
            this.updateChatHeader(channel);
            
            // 設定チャンネルの場合は特別な処理
            if (channel.name === '設定') {
                this.showSettingsChannel();
            } else {
                // 通常チャンネルの場合、メッセージ入力エリアを表示
                const messageInputContainer = document.querySelector('.message-input-container');
                if (messageInputContainer) {
                    messageInputContainer.style.display = 'flex';
                }
                const messagesContainer = document.querySelector('.messages-container');
                if (messagesContainer) {
                    messagesContainer.style.height = '';
                    messagesContainer.style.paddingBottom = '';
                }
                // チャットメッセージエリアをクリア（設定UIを削除）
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.innerHTML = '';
                }
                await this.loadAndRenderMessages(channelId);
            }
            
            // マイサーバーの場合はメンバーリストを非表示
            if (this.currentGuild && this.currentGuild.is_personal_server) {
                this.hideMembersList();
            } else {
                this.showMembersList();
            }
            
            // 状態を保存
            this.saveState();
            
            console.log(`チャンネル切り替え: ${channel.name} (${channel.type})`);
        } else {
            console.error('チャンネルが見つかりません:', channelId);
        }
    }

    async switchDM(dmItem) {
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });

        dmItem.classList.add('active');
        const dmId = dmItem.dataset.dm;
        
        const dmChannel = this.chatManager.dmChannels.find(ch => ch.id == dmId);
        if (dmChannel) {
            this.currentChannel = dmChannel;
            this.chatManager.currentChannel = dmChannel;
            this.updateChatHeader(dmChannel);
            await this.loadAndRenderMessages(dmId);
            this.hideMembersList();
            
            // 状態を保存
            this.saveState();
            
            console.log(`ダイレクトメッセージ切り替え: ${dmChannel.display_name}`);
        }
    }

    showAddServerModal() {
        const serverName = prompt('参加するサーバー名を入力してください:');
        if (serverName) {
            console.log(`サーバーに参加: ${serverName}`);
            // TODO: サーバー参加機能を実装
        }
    }

    showAddFriendModal() {
        const friendName = prompt('フレンドのユーザー名を入力してください:');
        if (friendName) {
            console.log(`フレンド追加: ${friendName}`);
            // TODO: フレンド追加機能を実装
        }
    }



    addTemporaryMessage(content) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = UIComponents.createTemporaryMessage(this.currentUser, content);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async loadInitialData() {
        try {
            console.log('初期データ読み込み開始...');
            
            // 保存された状態を読み込み
            const savedState = this.loadState();
            
            const guilds = await this.chatManager.loadGuilds();
            console.log('読み込まれたギルド:', guilds);
            
            this.renderServerList(guilds);
            
            // 状態復元を試行
            if (savedState && await this.restoreState(savedState, guilds)) {
                console.log('状態復元完了');
                return;
            }
            
            // デフォルトの初期化
            if (guilds.length > 0) {
                this.currentGuild = guilds[0];
                
                // セクションタイトルを設定
                const sectionTitle = document.getElementById('sectionTitle');
                sectionTitle.textContent = 'テキストチャンネル';
                
                await this.loadAndRenderChannels(this.currentGuild.id);
                this.setActiveServer(this.currentGuild.id);
                
                // 初期状態を保存
                this.saveState();
            }
            
            console.log('初期データを読み込み完了');
        } catch (error) {
            console.error('初期データ読み込みエラー:', error);
        }
    }

    renderServerList(guilds) {
        console.log('サーバーリストをレンダリング中...', guilds);
        const serversList = document.getElementById('serversList');
        
        if (!serversList) {
            console.error('serversList要素が見つかりません');
            return;
        }
        
        serversList.innerHTML = UIComponents.createServerListHTML(guilds);
        console.log('サーバーリスト HTML設定完了');
        
        this.bindServerEvents();
    }

    bindServerEvents() {
        const addServerBtn = document.getElementById('addServerBtn');
        if (addServerBtn) {
            addServerBtn.addEventListener('click', () => {
                this.showAddServerModal();
            });
        }
    }

    setActiveServer(serverId) {
        document.querySelectorAll('.server-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const serverItem = document.querySelector(`[data-server="${serverId}"]`);
        if (serverItem) {
            serverItem.classList.add('active');
        }
    }

    setActiveDM(dmId) {
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const dmItem = document.querySelector(`[data-dm="${dmId}"]`);
        if (dmItem) {
            dmItem.classList.add('active');
        }
    }

    async loadAndRenderChannels(guildId) {
        try {
            const channels = await this.chatManager.loadChannels(guildId);
            this.renderChannelList(channels);
            
            const firstTextChannel = channels.find(ch => ch.type === 'text');
            if (firstTextChannel) {
                this.currentChannel = firstTextChannel;
                this.chatManager.currentChannel = firstTextChannel;
                await this.loadAndRenderMessages(firstTextChannel.id);
                this.setActiveChannel(firstTextChannel.id);
                this.updateChatHeader(firstTextChannel);
                
                // 状態を保存
                this.saveState();
            }
        } catch (error) {
            console.error('チャンネル読み込みエラー:', error);
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
        } catch (error) {
            console.error('メッセージ読み込みエラー:', error);
        }
    }

    setActiveChannel(channelId) {
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const channelItem = document.querySelector(`[data-channel="${channelId}"]`);
        if (channelItem) {
            channelItem.classList.add('active');
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
                this.showSettingsChannel();
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
            membersSidebar.style.display = 'block';
        }
    }

    hideMembersList() {
        const membersSidebar = document.getElementById('membersSidebar');
        if (membersSidebar) {
            membersSidebar.style.display = 'none';
        }
    }

    updateMembersList(members) {
        const onlineMembers = document.getElementById('onlineMembers');
        const offlineMembers = document.getElementById('offlineMembers');
        const membersCount = document.getElementById('membersCount');
        
        if (!onlineMembers || !offlineMembers || !membersCount) return;

        const online = members.filter(member => member.status === 'online');
        const offline = members.filter(member => member.status === 'offline');

        onlineMembers.innerHTML = UIComponents.createMemberListHTML(online, 'online');
        offlineMembers.innerHTML = UIComponents.createMemberListHTML(offline, 'offline');

        const totalMembers = members.length;
        membersCount.textContent = `メンバー - ${totalMembers}`;

        const onlineSection = document.querySelector('.members-section:first-child .section-title');
        const offlineSection = document.querySelector('.members-section:last-child .section-title');
        
        if (onlineSection) {
            onlineSection.textContent = `オンライン - ${online.length}`;
        }
        if (offlineSection) {
            offlineSection.textContent = `オフライン - ${offline.length}`;
        }
    }

    logout() {
        if (confirm('ログアウトしますか？')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.reload();
        }
    }

    handleLogout() {
        this.logout();
    }

    bindFileUploadEvents() {
        this.selectedFiles = [];

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
                alert(`${file.name} のファイルサイズが大きすぎます（最大10MB）`);
                return false;
            }

            if (!allowedTypes.includes(file.type)) {
                alert(`${file.name} はサポートされていないファイルタイプです`);
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
        if (this.selectedFiles.length === 0 || !this.currentChannel) {
            return false;
        }

        const messageInput = document.getElementById('messageInput');
        const content = messageInput ? messageInput.value.trim() : '';

        try {
            // 複数ファイルを順次アップロード
            for (const file of this.selectedFiles) {
                const result = await this.chatManager.uploadFile(file, this.currentChannel.id, content);
                
                if (result.success) {
                    this.chatManager.addMessage(result.message);
                } else {
                    alert(`ファイル ${file.name} のアップロードに失敗しました: ${result.error}`);
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
            alert('ファイルのアップロードに失敗しました');
            return false;
        }
    }

    // sendMessage メソッドを修正してファイルアップロードに対応
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!this.currentChannel) return;

        // アップローダーチャンネルの場合
        if (this.currentChannel.type === 'uploader_public' || this.currentChannel.type === 'uploader_private') {
            // ファイルが選択されている場合はアップローダー用アップロード
            if (this.selectedFiles.length > 0) {
                await this.uploadUploaderFiles();
                return;
            }
            
            // テキストメッセージ（メモ）の場合は通常のメッセージ送信
            if (message) {
                const result = await this.chatManager.sendMessage(this.currentChannel.id, message);
                
                if (result.success) {
                    this.chatManager.addMessage(result.message);
                    messageInput.value = '';
                } else {
                    alert('メッセージの送信に失敗しました: ' + result.error);
                }
                return;
            }
            return;
        }

        // 通常のチャンネルの場合
        // ファイルが選択されている場合はファイルアップロード
        if (this.selectedFiles.length > 0) {
            await this.uploadFiles();
            return;
        }

        // テキストメッセージのみの場合
        if (!message) return;

        const result = await this.chatManager.sendMessage(this.currentChannel.id, message);
        
        if (result.success) {
            this.chatManager.addMessage(result.message);
            messageInput.value = '';
        } else {
            alert('メッセージの送信に失敗しました: ' + result.error);
        }
    }

    // アップローダー用ファイルアップロード
    async uploadUploaderFiles() {
        if (this.selectedFiles.length === 0 || !this.currentChannel) {
            return false;
        }

        const messageInput = document.getElementById('messageInput');
        const content = messageInput ? messageInput.value.trim() : '';

        try {
            // 複数ファイルを順次アップロード
            for (const file of this.selectedFiles) {
                const result = await this.chatManager.uploadUploaderFile(file, this.currentChannel.id, content);
                
                if (result.success) {
                    this.chatManager.addMessage(result.message);
                    
                    // 公開ファイルの場合、アクセスURLを表示
                    if (this.currentChannel.type === 'uploader_public' && result.uploadInfo.access_url) {
                        const accessUrl = window.location.origin + result.uploadInfo.access_url;
                        console.log('公開URL:', accessUrl);
                        
                        // 公開URLをクリップボードにコピー
                        try {
                            await navigator.clipboard.writeText(accessUrl);
                            this.showNotification('公開URLをクリップボードにコピーしました', 'success');
                        } catch (e) {
                            console.log('クリップボードへのコピーに失敗:', e);
                        }
                    }
                } else {
                    alert(`ファイル ${file.name} のアップロードに失敗しました: ${result.error}`);
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
            alert('ファイルのアップロードに失敗しました');
            return false;
        }
    }

    // 通知表示
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#43b581' : type === 'error' ? '#f04747' : '#7289da'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 500;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // アニメーション
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // 自動削除
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 画像モーダル表示
    showImageModal(imageElement) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('imageModalImage');
        const modalFilename = document.getElementById('imageModalFilename');
        const modalSize = document.getElementById('imageModalSize');
        
        if (!modal || !modalImage) return;
        
        // 画像情報を設定
        modalImage.src = imageElement.src;
        modalImage.alt = imageElement.alt;
        
        // ファイル名とサイズを設定
        const filename = imageElement.dataset.filename || 'image';
        const fileSize = parseInt(imageElement.dataset.fileSize) || 0;
        
        modalFilename.textContent = filename;
        modalSize.textContent = fileSize > 0 ? this.formatFileSize(fileSize) : '';
        
        // モーダル表示
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // イベントリスナーを一度だけ追加
        this.bindImageModalEvents();
    }

    // 画像モーダルを閉じる
    hideImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // 画像モーダルのイベントバインド
    bindImageModalEvents() {
        const modal = document.getElementById('imageModal');
        const closeBtn = document.getElementById('imageModalClose');
        const overlay = modal?.querySelector('.image-modal-overlay');
        
        if (!modal || modal.dataset.eventsbound) return;
        
        // 閉じるボタン
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideImageModal();
            });
        }
        
        // オーバーレイクリック
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.hideImageModal();
            });
        }
        
        // ESCキー
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.hideImageModal();
            }
        });
        
        // イベントが追加済みであることをマーク
        modal.dataset.eventsbound = 'true';
    }

    // マイサーバーを開く
    async openMyServer() {
        try {
            const myServer = await this.chatManager.getMyServer();
            if (myServer) {
                this.showMyServer(myServer);
            } else {
                console.error('マイサーバーが見つかりません');
            }
        } catch (error) {
            console.error('マイサーバーの読み込みエラー:', error);
        }
    }

    // マイサーバーを表示
    showMyServer(myServer) {
        // DMモードを無効化
        this.isDMMode = false;
        document.getElementById('dmButton').classList.remove('active');
        
        // 現在のサーバー選択を解除
        document.querySelectorAll('.server-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // マイサーバーを設定
        this.currentGuild = myServer;
        
        // チャンネル一覧を表示
        this.renderChannelList(myServer.channels || []);
        
        // セクションタイトルを更新
        const sectionTitle = document.getElementById('sectionTitle');
        sectionTitle.textContent = 'マイサーバー';
        
        // 最初のチャンネルを選択（アップローダーチャンネル優先）
        if (myServer.channels && myServer.channels.length > 0) {
            // 公開チャンネルを優先的に選択
            const publicChannel = myServer.channels.find(ch => ch.type === 'uploader_public');
            const firstChannel = publicChannel || myServer.channels[0];
            
            this.currentChannel = firstChannel;
            this.chatManager.currentChannel = firstChannel; // ChatManagerにも設定
            this.loadAndRenderMessages(firstChannel.id);
            this.setActiveChannel(firstChannel.id);
            this.updateChatHeader(firstChannel);
        }
        
        // メンバーリストを非表示（マイサーバーは個人用）
        this.hideMembersList();
        
        // 状態を保存
        this.saveState();
        
        console.log('マイサーバーを開きました:', myServer.name);
    }

    showSettingsChannel() {
        // メッセージ入力エリアを非表示
        const messageInputContainer = document.querySelector('.message-input-container');
        if (messageInputContainer) {
            messageInputContainer.style.display = 'none';
        }
        
        // 設定チャンネル専用UIを表示
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = this.createSettingsChannelHTML();
            // メッセージコンテナの高さを調整
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                messagesContainer.style.height = 'calc(100vh - 48px)';
                messagesContainer.style.paddingBottom = '0';
            }
        }
        
        // 設定チャンネル用のイベントリスナーを設定
        this.bindSettingsEvents();
    }
    
    createSettingsChannelHTML() {
        const user = this.currentUser || this.chatManager.currentUser;
        return `
            <div class="settings-channel">
                <div class="settings-header">
                    <h2 class="settings-title">
                        <span class="settings-icon">⚙️</span>
                        プロフィール設定
                    </h2>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <span>👤</span>
                        プロフィール情報
                    </h3>
                    <div class="profile-info">
                        <div class="profile-avatar-section">
                            <div class="current-avatar" id="currentAvatar">
                                ${user.avatar_url ? 
                                    `<img src="${user.avatar_url}" alt="現在のアバター">` : 
                                    '<span class="default-avatar">👤</span>'
                                }
                            </div>
                            <div class="profile-username">
                                ${user.avatar_url ? 
                                    `<img src="${user.avatar_url}" alt="アバター" class="username-avatar">` : 
                                    '<span class="username-avatar-placeholder">👤</span>'
                                }
                                <span class="username-text">${user.username}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <span>📸</span>
                        アバター画像
                    </h3>
                    <p class="settings-section-description">
                        プロフィール画像をアップロードして、あなたのアカウントをカスタマイズしましょう。
                    </p>
                    
                    <div class="avatar-upload-section">
                        <label class="avatar-upload-button">
                            <input type="file" id="avatarUpload" accept="image/jpeg,image/png,image/gif,image/webp">
                            📸 アバター画像をアップロード
                        </label>
                        
                        <div class="upload-progress" id="uploadProgress">
                            <div class="upload-progress-bar" id="uploadProgressBar"></div>
                        </div>
                        
                        <div class="upload-status" id="uploadStatus"></div>
                        
                        <div class="file-format-info">
                            対応形式: JPEG, PNG, GIF, WebP（最大5MB）
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <span>ℹ️</span>
                        アカウント情報
                    </h3>
                    <div class="user-info-grid">
                        <div class="user-info-item">
                            <div class="user-info-label">ユーザー名</div>
                            <div class="user-info-value">${user.username}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">メールアドレス</div>
                            <div class="user-info-value">${user.email || 'なし'}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">ステータス</div>
                            <div class="user-info-value">${this.getStatusLabel(user.status)}</div>
                        </div>
                        <div class="user-info-item">
                            <div class="user-info-label">登録日</div>
                            <div class="user-info-value">${user.created_at ? this.formatDate(user.created_at) : 'なし'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    bindSettingsEvents() {
        // アバターアップロードのイベントリスナー
        const avatarUpload = document.getElementById('avatarUpload');
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => {
                this.handleAvatarUpload(e);
            });
        }
    }
    
    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // ファイルサイズチェック
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showError('ファイルサイズが大きすぎます（最大5MB）');
            return;
        }

        // ファイル形式チェック
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('対応していないファイル形式です');
            return;
        }

        try {
            this.showProgress(0);
            this.setStatus('アップロード中...', 'uploading');

            const formData = new FormData();
            formData.append('avatar', file);

            const xhr = new XMLHttpRequest();
            
            // プログレス表示
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.showProgress(percentComplete);
                }
            });

            // 完了処理
            xhr.addEventListener('load', () => {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        this.handleUploadSuccess(response);
                    } else {
                        this.showError(response.error || 'アップロードに失敗しました');
                    }
                } catch (error) {
                    this.showError('レスポンスの解析に失敗しました');
                }
            });

            // エラー処理
            xhr.addEventListener('error', () => {
                this.showError('ネットワークエラーが発生しました');
            });

            xhr.open('POST', '/api/upload_avatar.php');
            // Bearerトークンを設定
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
                xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
            }
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            this.showError('アップロードエラーが発生しました');
        }
    }
    
    handleUploadSuccess(response) {
        // アバター画像を更新
        const avatarElement = document.getElementById('currentAvatar');
        if (avatarElement) {
            avatarElement.innerHTML = `<img src="${response.avatar_url}?t=${Date.now()}" alt="新しいアバター">`;
            avatarElement.classList.add('upload-success-animation');
            
            // アニメーション後にクラスを削除
            setTimeout(() => {
                avatarElement.classList.remove('upload-success-animation');
            }, 600);
        }
        
        // ユーザー名横のアバターも更新
        const usernameAvatar = document.querySelector('.username-avatar');
        const usernameAvatarPlaceholder = document.querySelector('.username-avatar-placeholder');
        if (usernameAvatarPlaceholder) {
            usernameAvatarPlaceholder.replaceWith(`<img src="${response.avatar_url}?t=${Date.now()}" alt="アバター" class="username-avatar">`);
        } else if (usernameAvatar) {
            usernameAvatar.src = response.avatar_url + '?t=' + Date.now();
        }

        // サイドバーのアバターも更新
        this.updateSidebarAvatar(response.avatar_url);

        // ステータス表示
        this.setStatus('✅ アップロード完了！', 'success');
        this.hideProgress();

        // フォームをリセット
        const uploadInput = document.getElementById('avatarUpload');
        if (uploadInput) {
            uploadInput.value = '';
        }

        // ユーザー情報を更新
        if (this.currentUser) {
            this.currentUser.avatar_url = response.avatar_url;
        }
        if (this.chatManager.currentUser) {
            this.chatManager.currentUser.avatar_url = response.avatar_url;
        }
    }

    updateSidebarAvatar(avatarUrl) {
        // サイドバーのユーザーアバターを更新
        const sidebarAvatars = document.querySelectorAll('.user-avatar, .current-user-avatar, #usernameBtn img');
        sidebarAvatars.forEach(avatar => {
            if (avatar.tagName === 'IMG') {
                avatar.src = avatarUrl + '?t=' + Date.now();
            } else {
                avatar.style.backgroundImage = `url(${avatarUrl}?t=${Date.now()})`;
            }
        });
    }

    showProgress(percent) {
        const progressContainer = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('uploadProgressBar');
        
        if (progressContainer && progressBar) {
            progressContainer.style.display = 'block';
            progressBar.style.width = percent + '%';
        }
    }

    hideProgress() {
        const progressContainer = document.getElementById('uploadProgress');
        if (progressContainer) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 1000);
        }
    }

    setStatus(message, type = '') {
        const statusElement = document.getElementById('uploadStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = 'upload-status ' + type;
        }
    }

    showError(message) {
        this.setStatus('❌ ' + message, 'error');
        this.hideProgress();
    }

    getStatusLabel(status) {
        const statusMap = {
            'online': '🟢 オンライン',
            'away': '🟡 退席中',
            'busy': '🔴 取り込み中',
            'offline': '⚫ オフライン'
        };
        return statusMap[status] || '⚫ 不明';
    }

    formatDate(dateString) {
        if (!dateString) return 'なし';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return 'なし';
        }
    }
}

// グローバルスコープに登録
window.ChatUI = ChatUI;
