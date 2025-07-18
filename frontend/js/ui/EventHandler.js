// イベント処理管理クラス
class EventHandler {
    constructor(chatUI) {
        this.chatUI = chatUI;
    }

    bindEvents() {
        // モバイルメニューの初期化
        this.initMobileMenu();
        
        // DMボタンクリック
        const dmButton = document.getElementById('dmButton');
        if (dmButton) {
            dmButton.addEventListener('click', () => {
                this.chatUI.showDMMode();
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
            if (e.target.closest('.channel-item')) {
                const item = e.target.closest('.channel-item');
                await this.chatUI.switchChannel(item);
                // モバイルでチャンネル切り替え後にメニューを閉じる
                this.closeMobileMenus();
            } else if (e.target.closest('.dm-user-item:not(.add-friend)')) {
                const item = e.target.closest('.dm-user-item');
                await this.chatUI.switchDM(item);
                // モバイルでDM切り替え後にメニューを閉じる
                this.closeMobileMenus();
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
        
        document.querySelectorAll('.channel-item, .dm-user-item').forEach(item => {
            item.classList.remove('active');
        });

        channelItem.classList.add('active');
        
        // チャンネルを検索する際、通常のサーバーチャンネルとマイサーバーチャンネルの両方を確認
        let channel = this.chatUI.chatManager.channels.find(ch => ch.id == channelId);
        
        // 通常のチャンネルで見つからない場合、マイサーバーのチャンネルから検索
        if (!channel && this.chatUI.currentGuild && this.chatUI.currentGuild.channels) {
            channel = this.chatUI.currentGuild.channels.find(ch => ch.id == channelId);
            console.log(`🏠 マイサーバーチャンネルから検索: ${channel ? '見つかりました' : '見つかりません'}`);
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
            
            // マイサーバーの場合はメンバーリストを非表示
            if (this.chatUI.currentGuild && this.chatUI.currentGuild.is_personal_server) {
                this.chatUI.uiUtils.hideMembersList();
            } else {
                this.chatUI.uiUtils.showMembersList();
            }
            
            // 状態を保存
            this.chatUI.stateManager.saveState();
            
            console.log(`✅ チャンネル切り替え完了: ${channel.name} (${channel.type})`);
        } else {
            console.error(`❌ チャンネルが見つかりません: ID=${channelId}`);
            console.log('利用可能なチャンネル:', this.chatUI.chatManager.channels);
            if (this.chatUI.currentGuild && this.chatUI.currentGuild.channels) {
                console.log('マイサーバーチャンネル:', this.chatUI.currentGuild.channels);
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
}

// グローバルスコープに登録
window.EventHandler = EventHandler;
