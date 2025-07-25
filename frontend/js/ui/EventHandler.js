// イベント処理管理クラス
class EventHandler {
    constructor(chatUI) {
        this.chatUI = chatUI;
    }

    bindEvents() {
        // モバイルメニューの初期化
        this.initMobileMenu();
        
        // フレンドボタンクリック
        const friendsButton = document.getElementById('friendsButton');
        if (friendsButton) {
            friendsButton.addEventListener('click', () => {
                this.showFriendsListDirectly();
            });
        }

        // サーバー切り替え
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.server-item:not(.add-server)')) {
                const serverItem = e.target.closest('.server-item');
                await this.chatUI.serverManager.switchServer(serverItem);
                // モバイルでサーバー切り替え後にメニューを閉じる
                this.closeMobileMenus();
            }
        });

        // チャンネル切り替え（DMユーザー切り替えも含む）
        document.addEventListener('click', async (e) => {
            // チャンネルアイテムのクリック処理
            const channelItem = e.target.closest('.channel-item');
            if (channelItem && channelItem.dataset.channel) {
                console.log('🔄 チャンネルアイテムクリック検出:', channelItem.dataset.channel);
                e.stopPropagation(); // イベントの伝播を停止
                
                // DMモードを無効化（サーバーチャンネルに切り替える場合）
                this.chatUI.isDMMode = false;
                document.getElementById('friendsButton').classList.remove('active');
                
                await this.chatUI.switchChannel(channelItem);
                this.closeMobileMenus();
                return;
            }
            
            // DMユーザーアイテムのクリック処理
            const dmItem = e.target.closest('.dm-user-item:not(.add-friend)');
            if (dmItem && (dmItem.dataset.dm || dmItem.dataset.friendId)) {
                console.log('🔄 DMアイテムクリック検出:', dmItem.dataset.dm || dmItem.dataset.friendId);
                e.stopPropagation(); // イベントの伝播を停止
                
                await this.chatUI.switchDM(dmItem);
                this.closeMobileMenus();
                return;
            }
        });

        // サーバー追加ボタン（動的に追加されるため、イベント委譲を使用）
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-server')) {
                this.chatUI.serverManager.showAddServerModal();
            }
        });

        // サーバー右クリックメニュー
        document.addEventListener('contextmenu', (e) => {
            const serverItem = e.target.closest('.server-item:not(.add-server)');
            if (serverItem) {
                e.preventDefault();
                this.showServerContextMenu(e, serverItem);
                return;
            }
            
            // メンバー右クリックメニュー
            const memberItem = e.target.closest('.member-item');
            if (memberItem) {
                e.preventDefault();
                this.showMemberContextMenu(e, memberItem);
                return;
            }
        });

        // コンテキストメニューを閉じる
        document.addEventListener('click', () => {
            this.hideContextMenus();
        });

        // チャンネル追加ボタン
        document.addEventListener('click', (e) => {
            if (e.target.closest('#addChannelBtn')) {
                if (this.chatUI.currentGuild && !this.chatUI.isDMMode) {
                    this.chatUI.channelManager.showCreateChannelModal(this.chatUI.currentGuild.id, 1); // デフォルトでテキストチャンネルカテゴリ
                }
            }
        });

        // フレンド追加ボタン
        document.addEventListener('click', (e) => {
            if (e.target.closest('#addFriendBtn') || e.target.closest('.add-friend')) {
                this.showFriendsListDirectly();
            }
        });

        // DMユーザーとフレンドのクリックイベント
        document.addEventListener('click', async (e) => {
            const dmUserItem = e.target.closest('.dm-user-item');
            if (dmUserItem) {
                // フレンド追加ボタンは除外
                if (dmUserItem.classList.contains('add-friend')) {
                    return;
                }
                
                // フレンドアイテムの場合
                if (dmUserItem.classList.contains('friend-item')) {
                    const friendId = dmUserItem.dataset.friendId;
                    if (friendId) {
                        console.log('🎯 フレンドをクリック:', friendId);
                        await this.startDMWithFriend(parseInt(friendId, 10));
                    }
                    return;
                }
                
                // DMアイテムの場合
                const dmId = dmUserItem.dataset.dm;
                if (dmId) {
                    console.log('🎯 DMをクリック:', dmId);
                    await this.openDMChannel(parseInt(dmId, 10));
                }
            }
        });

        // メッセージ送信
        const chatForm = document.getElementById('chatForm');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.chatUI.sendMessage();
            });
        }

        // ログアウト（下部のボタン）
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.chatUI.uiUtils.logout();
            });
        }

        // メッセージ入力欄のEnterキー
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.chatUI.sendMessage();
                }
            });
            
            // タイピングインジケーター
            messageInput.addEventListener('input', (e) => {
                const currentChannel = this.chatUI.currentChannel;
                if (currentChannel && e.target.value.length > 0) {
                    this.chatUI.typingManager.handleMessageInput(currentChannel.id);
                }
            });
            
            // メッセージ送信時にタイピング停止
            messageInput.addEventListener('blur', (e) => {
                const currentChannel = this.chatUI.currentChannel;
                if (currentChannel) {
                    this.chatUI.typingManager.handleMessageSent(currentChannel.id);
                }
            });
        }

        // ユーザー名クリック（マイサーバー）
        document.addEventListener('click', async (e) => {
            if (e.target.closest('#useridBtn')) {
                await this.chatUI.serverManager.openMyServer();
            }
        });

        // マイサーバーボタンクリック
        document.addEventListener('click', async (e) => {
            if (e.target.closest('#myServerBtn')) {
                await this.chatUI.serverManager.openMyServer();
            }
        });

        // 画像クリックイベント（モーダル表示）
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('clickable-image')) {
                this.chatUI.uiUtils.showImageModal(e.target);
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
                    
                    this.chatUI.uiUtils.showNotification('URLをクリップボードにコピーしました', 'success');
                } catch (err) {
                    console.error('クリップボードへのコピーに失敗:', err);
                    this.chatUI.uiUtils.showNotification('URLのコピーに失敗しました', 'error');
                }
            }
        });

        // ファイルアップロード関連のイベント
        this.chatUI.fileUploadHandler.bindFileUploadEvents();

        // メンバーサイドバー閉じるボタン
        const closeMembersBtn = document.getElementById('closeMembersBtn');
        if (closeMembersBtn) {
            closeMembersBtn.addEventListener('click', () => {
                this.closeMembersSidebar();
            });
        }

        // メンバーサイドバー閉じるボタン（イベント委譲）
        document.addEventListener('click', (e) => {
            if (e.target.closest('.close-members-btn')) {
                this.closeMembersSidebar();
            }
        });
    }

    // チャンネル切り替え
    async switchChannel(channelItem) {
        const channelId = channelItem.dataset.channel;
        console.log(`🔄 チャンネル切り替え開始 (ID: ${channelId})`);
        
        // DMモードを確実に無効化（サーバーチャンネルに移動する場合）
        this.chatUI.isDMMode = false;
        
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });

        channelItem.classList.add('active');
        
        // チャンネル検索の優先順位を明確化
        let channel = null;
        
        // 1. 現在のギルドのチャンネルから検索（最優先）
        if (this.chatUI.currentGuild && this.chatUI.currentGuild.channels) {
            channel = this.chatUI.currentGuild.channels.find(ch => ch.id == channelId);
            console.log(`🏠 現在のギルドから検索: ${channel ? '見つかりました' : '見つかりません'}`);
        }
        
        // 2. ChatManagerの一般チャンネルから検索
        if (!channel && this.chatUI.chatManager.channels) {
            channel = this.chatUI.chatManager.channels.find(ch => ch.id == channelId);
            console.log(`📋 ChatManagerから検索: ${channel ? '見つかりました' : '見つかりません'}`);
        }
        
        if (channel) {
            console.log(`✅ チャンネルが見つかりました: ${channel.name} (${channel.type})`);
            this.chatUI.currentChannel = channel;
            this.chatUI.chatManager.currentChannel = channel; // ChatManagerにも設定
            this.chatUI.updateChatHeader(channel);
            
            // 設定チャンネルの場合は特別な処理
            if (channel.name === '設定' || channel.type === 'settings') {
                this.chatUI.settingsHandler.showSettingsChannel();
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
                await this.chatUI.loadAndRenderMessages(channelId);
                
                // リアルタイム通信: チャネルに参加
                if (window.realtimeManager) {
                    window.realtimeManager.joinChannel(channelId);
                }
            }
            
            // メンバーリスト表示の判定を修正
            if (this.chatUI.currentGuild && this.chatUI.currentGuild.is_personal_server) {
                // マイサーバーの場合はメンバーリストを非表示
                this.chatUI.uiUtils.hideMembersList();
            } else if (this.chatUI.currentGuild && !this.chatUI.isDMMode) {
                // 通常のサーバーでDMモードでない場合はメンバーリストを表示
                this.chatUI.uiUtils.showMembersList();
            } else {
                // その他の場合は非表示
                this.chatUI.uiUtils.hideMembersList();
            }
            
            // 状態を保存
            this.chatUI.stateManager.saveState();
            
            console.log(`✅ チャンネル切り替え完了: ${channel.name} (${channel.type})`);
        } else {
            console.error(`❌ チャンネルが見つかりません: ID=${channelId}`);
            console.log('現在のギルド:', this.chatUI.currentGuild);
            console.log('ChatManagerのチャンネル数:', this.chatUI.chatManager.channels?.length || 0);
            if (this.chatUI.currentGuild && this.chatUI.currentGuild.channels) {
                console.log('現在のギルドのチャンネル数:', this.chatUI.currentGuild.channels.length);
                console.log('現在のギルドのチャンネル一覧:', this.chatUI.currentGuild.channels.map(ch => `${ch.name}(${ch.id})`));
            }
        }
    }

    // DM切り替え
    async switchDM(dmItem) {
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });

        dmItem.classList.add('active');
        const dmId = dmItem.dataset.dm;
        
        const dmChannel = this.chatUI.chatManager.dmChannels.find(ch => ch.id == dmId);
        if (dmChannel) {
            this.chatUI.currentChannel = dmChannel;
            this.chatUI.chatManager.currentChannel = dmChannel;
            this.chatUI.updateChatHeader(dmChannel);
            await this.chatUI.loadAndRenderMessages(dmId);
            this.chatUI.uiUtils.hideMembersList();
            
            // 状態を保存
            this.chatUI.stateManager.saveState();
            
            console.log(`ダイレクトメッセージ切り替え: ${dmChannel.display_name}`);
        }
    }

    // サーバーコンテキストメニューを表示
    showServerContextMenu(e, serverItem) {
        const serverId = serverItem.dataset.server;
        const guild = this.chatUI.chatManager.guilds.find(g => g.id == serverId);
        
        if (!guild) return;

        // 既存のコンテキストメニューを削除
        this.hideContextMenus();

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="settings">
                <span class="context-menu-icon">⚙️</span>
                <span>サーバー設定</span>
            </div>
            <div class="context-menu-item" data-action="change-icon">
                <span class="context-menu-icon">🖼️</span>
                <span>アイコンを変更</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item danger" data-action="leave">
                <span class="context-menu-icon">🚪</span>
                <span>サーバーを離れる</span>
            </div>
        `;

        // 位置を調整
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.zIndex = '10000';

        document.body.appendChild(contextMenu);

        // メニューアイテムのクリックイベント
        contextMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            
            switch (action) {
                case 'settings':
                    this.chatUI.serverManager.showServerSettingsModal(serverId);
                    break;
                case 'change-icon':
                    this.chatUI.serverManager.showServerSettingsModal(serverId);
                    break;
                case 'leave':
                    this.confirmLeaveServer(guild);
                    break;
            }
            
            this.hideContextMenus();
        });

        // 画面外に出ないように調整
        setTimeout(() => {
            const rect = contextMenu.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            if (rect.right > windowWidth) {
                contextMenu.style.left = `${windowWidth - rect.width - 10}px`;
            }
            if (rect.bottom > windowHeight) {
                contextMenu.style.top = `${windowHeight - rect.height - 10}px`;
            }
        }, 0);
    }

    // コンテキストメニューを非表示
    hideContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.remove();
        });
    }

    // サーバー離脱確認
    confirmLeaveServer(guild) {
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>サーバーを離れる</h3>
                </div>
                <div class="modal-body">
                    <p>本当に「${guild.name}」から離れますか？</p>
                    <p style="color: var(--text-danger); font-size: 14px;">この操作は元に戻せません。</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" id="cancelLeave">キャンセル</button>
                    <button class="btn-danger" id="confirmLeave">離れる</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        // イベントリスナー
        document.getElementById('cancelLeave').addEventListener('click', () => {
            confirmModal.remove();
        });

        document.getElementById('confirmLeave').addEventListener('click', async () => {
            try {
                const currentGuild = this.chatUI.currentGuild;
                if (!currentGuild) {
                    this.chatUI.uiUtils.showNotification('サーバーが選択されていません', 'error');
                    return;
                }

                const response = await fetch(`/api/guilds/${currentGuild.id}/leave`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                
                if (data.success) {
                    this.chatUI.uiUtils.showNotification(data.message, 'success');
                    
                    // サーバーリストを再読み込み
                    await this.chatUI.chatManager.loadGuilds();
                    
                    // 最初のサーバーに切り替える（あれば）
                    const guilds = this.chatUI.chatManager.guilds;
                    if (guilds.length > 0) {
                        await this.chatUI.chatManager.switchToGuild(guilds[0].id);
                    } else {
                        // サーバーがない場合は空の状態に
                        this.chatUI.currentGuild = null;
                        this.chatUI.currentChannel = null;
                        document.getElementById('chatMessages').innerHTML = '<div class="no-server">参加しているサーバーがありません</div>';
                        document.getElementById('channelsList').innerHTML = '';
                    }
                    
                    // モーダルを閉じる
                    document.getElementById('leaveServerModal').style.display = 'none';
                } else {
                    this.chatUI.uiUtils.showNotification(data.message, 'error');
                }
            } catch (error) {
                console.error('サーバー離脱エラー:', error);
                this.chatUI.uiUtils.showNotification('サーバーからの離脱に失敗しました', 'error');
            }
            confirmModal.remove();
        });

        // モーダル外クリックで閉じる
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
            }
        });
    }

    // モバイルメニューの初期化
    initMobileMenu() {
        // モバイルメニューボタンのイベントリスナー
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileMembersToggle = document.getElementById('mobileMembersToggle');
        
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSidebar();
            });
        }
        
        if (mobileMembersToggle) {
            mobileMembersToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMembersSidebar();
            });
        }

        // オーバーレイを作成
        this.createMobileOverlay();

        // タッチイベントのサポート
        this.addTouchSupport();
    }

    // サイドバーの開閉
    toggleSidebar() {
        const leftSidebar = document.querySelector('.left-sidebar');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        
        if (leftSidebar && sidebar) {
            const isOpen = leftSidebar.classList.contains('open');
            
            if (isOpen) {
                this.closeSidebar();
            } else {
                this.openSidebar();
            }
        }
    }

    // サイドバーを開く
    openSidebar() {
        const leftSidebar = document.querySelector('.left-sidebar');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        
        if (leftSidebar && sidebar && overlay) {
            leftSidebar.classList.add('open');
            sidebar.classList.add('open');
            overlay.classList.add('active');
            
            // メンバーサイドバーが開いていたら閉じる
            this.closeMembersSidebar();
        }
    }

    // サイドバーを閉じる
    closeSidebar() {
        const leftSidebar = document.querySelector('.left-sidebar');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        
        if (leftSidebar && sidebar && overlay) {
            leftSidebar.classList.remove('open');
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        }
    }

    // メンバーサイドバーの開閉
    toggleMembersSidebar() {
        const membersSidebar = document.querySelector('.members-sidebar');
        
        if (membersSidebar) {
            const isOpen = membersSidebar.classList.contains('open');
            
            if (isOpen) {
                this.closeMembersSidebar();
            } else {
                this.openMembersSidebar();
            }
        }
    }

    // メンバーサイドバーを開く
    openMembersSidebar() {
        const membersSidebar = document.querySelector('.members-sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        
        if (membersSidebar && overlay) {
            membersSidebar.classList.add('open');
            overlay.classList.add('active');
            
            // サイドバーが開いていたら閉じる
            this.closeSidebar();
        }
    }

    // メンバーサイドバーを閉じる
    closeMembersSidebar() {
        const membersSidebar = document.querySelector('.members-sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        
        if (membersSidebar && overlay) {
            membersSidebar.classList.remove('open');
            if (!document.querySelector('.left-sidebar.open')) {
                overlay.classList.remove('active');
            }
        }
    }

    // すべてのモバイルメニューを閉じる
    closeMobileMenus() {
        this.closeSidebar();
        this.closeMembersSidebar();
    }

    // モバイルオーバーレイを作成
    createMobileOverlay() {
        if (!document.querySelector('.mobile-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'mobile-overlay';
            overlay.addEventListener('click', () => {
                this.closeMobileMenus();
            });
            document.body.appendChild(overlay);
        }
    }

    // タッチサポートを追加
    addTouchSupport() {
        // タッチデバイスでのクリック遅延を防ぐ
        const clickableElements = document.querySelectorAll('.channel-item, .server-item, .dm-user-item, .member-item');
        
        clickableElements.forEach(element => {
            element.addEventListener('touchstart', (e) => {
                e.currentTarget.classList.add('touch-active');
            });
            
            element.addEventListener('touchend', (e) => {
                setTimeout(() => {
                    e.currentTarget.classList.remove('touch-active');
                }, 150);
            });
            
            element.addEventListener('touchcancel', (e) => {
                e.currentTarget.classList.remove('touch-active');
            });
        });

        // スワイプジェスチャーの検出（将来の拡張用）
        let startX, startY;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            
            // 水平スワイプが主要な場合のみ処理
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                // 右スワイプでサイドバーを開く
                if (deltaX > 0 && startX < 50) {
                    this.openSidebar();
                }
                // 左スワイプでサイドバーを閉じる
                else if (deltaX < 0) {
                    this.closeMobileMenus();
                }
            }
        });
        
        document.addEventListener('touchend', () => {
            startX = null;
            startY = null;
        });
    }

    // フレンド画面を表示
    async showFriendsView() {
        try {
            // フレンドUIが初期化されていない場合は初期化
            if (!this.chatUI.friendsUI) {
                console.warn('FriendsUIが初期化されていません');
                return;
            }

            // フレンドマネージャーとDMマネージャーを設定
            if (this.chatUI.friendsManager && this.chatUI.dmManager) {
                this.chatUI.friendsUI.setManagers(this.chatUI.friendsManager, this.chatUI.dmManager);
            }

            // フレンド画面を表示
            await this.chatUI.friendsUI.showFriendsView();
            
            // サイドバーの状態更新
            this.chatUI.isDMMode = false;
            document.querySelectorAll('.server-item, .dm-user-item').forEach(item => {
                item.classList.remove('active');
            });
            document.getElementById('friendsButton')?.classList.remove('active');
            
            // メンバーリストを非表示
            this.chatUI.uiUtils.hideMembersList();
        } catch (error) {
            console.error('フレンド画面表示エラー:', error);
            this.chatUI.uiUtils.showNotification('フレンド画面の表示に失敗しました', 'error');
        }
    }

    // フレンドリストを直接表示（中間画面をスキップ）
    async showFriendsListDirectly() {
        try {
            console.log('🎯 フレンドボタンクリック - DMモード表示開始');
            
            // 各マネージャーの初期化確認
            if (!this.chatUI.friendsManager) {
                console.warn('FriendsManagerが初期化されていません');
                if (window.FriendsManager) {
                    this.chatUI.friendsManager = new FriendsManager();
                }
            }
            
            if (!this.chatUI.dmManager) {
                console.warn('DMManagerが初期化されていません');
                if (window.DMManager) {
                    this.chatUI.dmManager = new DMManager();
                }
            }

            // 現在の状態をクリア
            this.chatUI.currentChannel = null;
            this.chatUI.currentGuild = null;
            this.chatUI.isDMMode = true; // DMモードに設定
            
            console.log('🔄 状態クリア完了 - currentChannel:', this.chatUI.currentChannel, 'currentGuild:', this.chatUI.currentGuild);
            
            // 左サイドバーをDMモードに変更（統合されたDM+フレンドリストを表示）
            console.log('📋 左サイドバーをDM+フレンドモードに更新中...');
            await this.chatUI.serverManager.showDMUserList();
            
            // サイドバーの状態更新
            document.querySelectorAll('.server-item, .dm-user-item').forEach(item => {
                item.classList.remove('active');
            });
            document.getElementById('friendsButton')?.classList.add('active');
            
            // メンバーリストを強制的に非表示
            this.chatUI.uiUtils.hideMembersList();
            
            // 右サイドバーを確実に非表示にする
            const membersSidebar = document.getElementById('membersSidebar');
            if (membersSidebar) {
                membersSidebar.style.display = 'none';
                membersSidebar.classList.remove('show');
            }
            
            // メンバーリストコンテナも非表示
            const membersListContainer = document.querySelector('.members-sidebar');
            if (membersListContainer) {
                membersListContainer.style.display = 'none';
            }
            
            // 中央エリアにはDM選択を促すメッセージを表示
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="dm-welcome-screen">
                        <div class="dm-welcome-content">
                            <i class="fas fa-envelope dm-welcome-icon"></i>
                            <h2>ダイレクトメッセージ</h2>
                            <p>左のフレンドリストからフレンドを選択してDMを開始しましょう。</p>
                            <div class="dm-welcome-tips">
                                <div class="tip">
                                    <i class="fas fa-user-friends"></i>
                                    <span>フレンドをクリックしてDMを開始</span>
                                </div>
                                <div class="tip">
                                    <i class="fas fa-user-plus"></i>
                                    <span>フレンド追加で新しい友達を追加</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // チャットヘッダーを更新
            const chatHeader = document.querySelector('.chat-header');
            if (chatHeader) {
                chatHeader.innerHTML = `
                    <div class="channel-info">
                        <span class="channel-name">
                            <i class="fas fa-envelope"></i>
                            ダイレクトメッセージ
                        </span>
                    </div>
                `;
            }
            
            console.log('✅ DMモード表示完了');

        } catch (error) {
            console.error('DMモード表示エラー:', error);
            this.chatUI.uiUtils.showNotification('DMモードの表示に失敗しました', 'error');
        }
    }

    // メンバー右クリックコンテキストメニューを表示
    showMemberContextMenu(event, memberItem) {
        const userId = memberItem.dataset.userId;
        const username = memberItem.dataset.username;
        
        // 自分自身の場合は何も表示しない
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (parseInt(userId) === currentUser.id) {
            return;
        }

        // 既存のコンテキストメニューを削除
        this.hideContextMenus();

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu member-context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="profile">
                <span class="context-menu-icon">👤</span>
                <span class="context-menu-text">プロフィールを表示</span>
            </div>
            <div class="context-menu-item" data-action="dm">
                <span class="context-menu-icon">💬</span>
                <span class="context-menu-text">DMを送信</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="add-friend">
                <span class="context-menu-icon">👥</span>
                <span class="context-menu-text">フレンド申請を送信</span>
            </div>
        `;

        document.body.appendChild(contextMenu);

        // イベントリスナーを追加
        contextMenu.addEventListener('click', async (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            this.hideContextMenus();

            switch (action) {
                case 'profile':
                    await this.showMemberProfile(userId, username);
                    break;
                case 'dm':
                    await this.startDMWithMember(userId, username);
                    break;
                case 'add-friend':
                    await this.sendFriendRequest(username);
                    break;
            }
        });

        // 位置を調整
        this.positionContextMenu(contextMenu, event);
    }

    // メンバープロフィールを表示
    async showMemberProfile(userId, username) {
        // 簡単なプロフィール表示（モーダル）
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content member-profile-modal">
                <div class="modal-header">
                    <h3>メンバープロフィール</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="profile-info">
                        <div class="profile-avatar">
                            <div class="avatar-placeholder">${username.charAt(0).toUpperCase()}</div>
                        </div>
                        <div class="profile-details">
                            <h4>${username}</h4>
                            <p>ユーザーID: ${userId}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-action="close">閉じる</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // イベントハンドラー
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close') || 
                e.target.dataset.action === 'close' || 
                e.target === modal) {
                modal.remove();
            }
        });
    }

    // メンバーとDMを開始
    async startDMWithMember(userId, username) {
        try {
            if (!this.chatUI.dmManager) {
                console.error('DMManagerが初期化されていません');
                return;
            }

            // DMチャンネルを作成または取得
            const dmChannel = await this.chatUI.dmManager.createOrGetDMChannel(parseInt(userId));
            if (dmChannel) {
                // DMチャンネルに切り替える
                if (this.chatUI.channelManager) {
                    await this.chatUI.channelManager.switchToChannel(dmChannel.id, 'dm');
                }
                console.log(`✅ ${username}とのDMを開始しました`);
            }
        } catch (error) {
            console.error('DM開始エラー:', error);
            this.chatUI.uiUtils.showNotification('DMの開始に失敗しました', 'error');
        }
    }

    // フレンド申請を送信
    async sendFriendRequest(username) {
        try {
            if (!this.chatUI.friendsManager) {
                console.error('FriendsManagerが初期化されていません');
                return;
            }

            const response = await this.chatUI.friendsManager.sendFriendRequest(username);
            if (response.success) {
                this.chatUI.uiUtils.showNotification(`${username}にフレンド申請を送信しました`, 'success');
            } else {
                this.chatUI.uiUtils.showNotification(response.message || 'フレンド申請の送信に失敗しました', 'error');
            }
        } catch (error) {
            console.error('フレンド申請エラー:', error);
            this.chatUI.uiUtils.showNotification('フレンド申請の送信に失敗しました', 'error');
        }
    }

    // フレンドからDMを開始
    async startDMWithFriend(friendId) {
        try {
            console.log('🎯 フレンドからDM開始:', friendId);
            
            if (!this.chatUI.dmManager) {
                console.error('DMManagerが初期化されていません');
                return;
            }

            // DMチャンネルを作成または取得
            const dmChannel = await this.chatUI.dmManager.createOrGetDMChannel(friendId);
            if (dmChannel) {
                console.log('✅ DMチャンネル取得成功:', dmChannel);
                // DMチャンネルに切り替える
                await this.chatUI.dmManager.switchToDMChannel(dmChannel);
                this.chatUI.uiUtils.showNotification('DMを開始しました', 'success');
            } else {
                console.error('❌ DMチャンネルの作成に失敗');
                this.chatUI.uiUtils.showNotification('DMの開始に失敗しました', 'error');
            }
        } catch (error) {
            console.error('フレンドからのDM開始エラー:', error);
            this.chatUI.uiUtils.showNotification('DMの開始に失敗しました', 'error');
        }
    }

    // DMチャンネルを開く
    async openDMChannel(dmId) {
        try {
            console.log('🎯 DMチャンネルを開く:', dmId);
            
            if (!this.chatUI.dmManager) {
                console.error('DMManagerが初期化されていません');
                return;
            }

            // DMチャンネルを取得
            const dmChannel = this.chatUI.dmManager.findDMChannelById(dmId);
            if (dmChannel) {
                console.log('✅ DMチャンネル見つかりました:', dmChannel);
                // DMチャンネルに切り替える
                await this.chatUI.dmManager.switchToDMChannel(dmChannel);
            } else {
                console.error('❌ DMチャンネルが見つかりません:', dmId);
                this.chatUI.uiUtils.showNotification('DMチャンネルが見つかりません', 'error');
            }
        } catch (error) {
            console.error('DMチャンネルを開くエラー:', error);
            this.chatUI.uiUtils.showNotification('DMチャンネルを開けませんでした', 'error');
        }
    }

    // コンテキストメニューの位置調整
    positionContextMenu(menu, event) {
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = event.clientX;
        let y = event.clientY;

        // 右端にはみ出る場合は左に表示
        if (x + rect.width > viewportWidth) {
            x = viewportWidth - rect.width - 10;
        }

        // 下端にはみ出る場合は上に表示
        if (y + rect.height > viewportHeight) {
            y = viewportHeight - rect.height - 10;
        }

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    }
}

// グローバルスコープに登録
window.EventHandler = EventHandler;
