// UI部品関連のクラス
class UIComponents {
    // チャットコンテナのHTMLを生成
    static createChatContainer(currentUser) {
        return `
            <div class="chat-container">
                <!-- 左サイドバー（サーバー選択とDM） -->
                <div class="left-sidebar">
                    <!-- ダイレクトメッセージボタン -->
                    <div class="dm-button-section">
                        <div class="dm-button" id="dmButton">
                            <div class="dm-button-icon">@</div>
                        </div>
                    </div>

                    <!-- 区切り線 -->
                    <div class="separator"></div>

                    <!-- サーバー選択セクション -->
                    <div class="servers-section">
                        <div class="servers-list" id="serversList">
                            <!-- サーバーリストは動的に生成される -->
                        </div>
                    </div>
                </div>

                <!-- メインサイドバー -->
                <div class="sidebar">
                    <div class="server-info">
                        <div class="user-info">
                            <div class="user-avatar">
                                ${currentUser.avatar_url ? 
                                    `<img src="${currentUser.avatar_url}" alt="アバター" class="user-avatar-img">` : 
                                    `<span>${(currentUser.nickname || currentUser.userid).charAt(0).toUpperCase()}</span>`
                                }
                            </div>
                            <div class="user-details">
                                <div class="userid clickable-userid" id="useridBtn" title="マイサーバーを開く">${currentUser.nickname || currentUser.userid}</div>
                                <div class="user-status status-${currentUser.status || 'online'}">${UIComponents.getStatusLabel(currentUser.status || 'online')}</div>
                                <button class="my-server-btn" id="myServerBtn" title="マイサーバー">🏠 マイサーバー</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- テキストチャンネルセクション -->
                    <div class="channels-section" id="channelsSection">
                        <div class="section-header">
                            <span id="sectionTitle">テキストチャンネル</span>
                            <button class="add-channel-btn" id="addChannelBtn" title="チャンネルを追加">+</button>
                        </div>
                        <div class="channels-list" id="channelsList">
                            <!-- チャンネルリストは動的に生成される -->
                        </div>
                    </div>

                    <div class="user-controls">
                        <button class="control-button" id="logoutBtn">
                            <span>ログアウト</span>
                        </button>
                    </div>
                </div>

                <!-- メインチャットエリア -->
                <div class="main-content">
                    <div class="chat-header">
                        <button class="mobile-menu-toggle" id="mobileMenuToggle">
                            <svg width="24" height="24" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"/>
                            </svg>
                        </button>
                        <div class="channel-info">
                            <span class="channel-hash" id="channelHash">#</span>
                            <span class="channel-name" id="currentChannelName">チャンネルを選択してください</span>
                            <span class="channel-topic" id="channelTopic">...</span>
                        </div>
                        <button class="mobile-members-toggle" id="mobileMembersToggle">
                            <svg width="24" height="24" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M16,4C18.11,4 20,5.89 20,8C20,10.11 18.11,12 16,12C13.89,12 12,10.11 12,8C12,5.89 13.89,4 16,4M16,14C20.42,14 24,15.79 24,18V20H8V18C8,15.79 11.58,14 16,14M6,6H10V8H6V6M6,10H10V12H6V10M6,14H10V16H6V14Z"/>
                            </svg>
                        </button>
                    </div>

                    <div class="chat-messages" id="chatMessages">
                        <div class="welcome-message">
                            <h3>LazyChillRoomへようこそ！🎉</h3>
                            <p>サーバーまたはDMを選択してチャットを開始しましょう。</p>
                        </div>
                    </div>
                    
                    <!-- タイピングインジケーター -->
                    <div id="typing-indicator" class="typing-indicator" style="display: none;"></div>

                    <!-- 返信インジケーター -->
                    <div class="reply-indicator" style="display: none;"></div>

                    <div class="chat-input-container">
                        <form class="chat-input-form" id="chatForm">
                            <div class="chat-input-wrapper">
                                <button type="button" class="file-upload-button" id="fileUploadBtn" title="ファイルをアップロード">
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                    </svg>
                                </button>
                                <input 
                                    type="file" 
                                    id="fileInput" 
                                    style="display: none;"
                                    accept="image/*,.pdf,.doc,.docx,.txt"
                                    multiple
                                >
                                <input 
                                    type="text" 
                                    class="chat-input" 
                                    id="messageInput"
                                    placeholder="メッセージを入力してください"
                                    autocomplete="off"
                                >
                                <button type="submit" class="send-button">
                                    <svg width="24" height="24" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                                    </svg>
                                </button>
                            </div>
                        </form>
                        <div class="file-preview-container" id="filePreviewContainer" style="display: none;">
                            <div class="file-preview-header">
                                <span>アップロード予定のファイル:</span>
                                <button type="button" class="clear-files-btn" id="clearFilesBtn">×</button>
                            </div>
                            <div class="file-preview-list" id="filePreviewList"></div>
                        </div>
                        <div class="drag-drop-overlay" id="dragDropOverlay">
                            <div class="drag-drop-content">
                                <svg width="48" height="48" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                </svg>
                                <h3>ファイルをドロップしてアップロード</h3>
                                <p>画像、PDF、テキストファイルなど</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- メンバーリスト（常に表示） -->
                <div class="members-sidebar" id="membersSidebar">
                    <div class="members-header">
                        <span id="membersCount">メンバー - 4</span>
                        <button class="close-members-btn" id="closeMembersBtn" title="メンバーリストを閉じる" style="display: none;">×</button>
                    </div>
                    <div class="members-list">
                        <!-- オンラインメンバー -->
                        <div class="members-section">
                            <div class="members-section-header">
                                <span class="section-title" id="onlineMembersTitle">オンライン - 0</span>
                            </div>
                            <div class="members-group" id="onlineMembers">
                                <!-- サーバー選択時にオンラインメンバーが表示されます -->
                            </div>
                        </div>

                        <!-- オフラインメンバー -->
                        <div class="members-section">
                            <div class="members-section-header">
                                <span class="section-title" id="offlineMembersTitle">オフライン - 0</span>
                            </div>
                            <div class="members-group" id="offlineMembers">
                                <!-- サーバー選択時にオフラインメンバーが表示されます -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 一時的なメッセージ要素を作成
    static createTemporaryMessage(currentUser, content) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.innerHTML = `
            <div class="message-avatar">
                <span>${(currentUser.nickname || currentUser.userid).charAt(0).toUpperCase()}</span>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${currentUser.nickname || currentUser.userid}</span>
                    <span class="message-timestamp">${TimeUtils.getCurrentJSTTime()}</span>
                </div>
                <div class="message-text">${content}</div>
            </div>
        `;
        return messageElement;
    }

    // サーバーリストのHTMLを生成
    static createServerListHTML(guilds) {
        console.log('UIComponents: サーバーリストHTML生成中...', guilds);
        let html = '';
        
        guilds.forEach(guild => {
            const serverName = guild.name || `サーバー${guild.id}`;
            
            // アイコンまたはテキストを決定
            let iconContent;
            if (guild.icon_url) {
                // 相対パスでアクセスできるようにパスを調整
                let iconPath = guild.icon_url;
                if (iconPath.startsWith('/')) {
                    iconPath = iconPath.substring(1); // 先頭の/を削除
                }
                const fallbackText = guild.name ? guild.name.substring(0, 2).toUpperCase() : 'S';
                iconContent = `<img src="${iconPath}" alt="${serverName}" class="server-icon-img" data-fallback="${fallbackText}" data-guild-id="${guild.id}">`;
                console.log(`UIComponents: サーバー追加 - ID: ${guild.id}, 名前: ${serverName}, アイコン画像: ${iconPath}`);
            } else {
                const iconText = guild.name ? guild.name.substring(0, 2).toUpperCase() : 'S';
                iconContent = iconText;
                console.log(`UIComponents: サーバー追加 - ID: ${guild.id}, 名前: ${serverName}, アイコンテキスト: ${iconText}`);
            }
            
            html += `
                <div class="server-item" data-server="${guild.id}" title="${serverName}">
                    <div class="server-icon">${iconContent}</div>
                </div>
            `;
        });
        
        // サーバー追加ボタン
        html += `
            <div class="server-item add-server" id="addServerBtn" title="サーバーを追加">
                <div class="server-icon plus">+</div>
            </div>
        `;
        
        console.log('UIComponents: 生成されたHTML:', html);
        
        // HTMLを設定後、画像エラーハンドリングを設定
        setTimeout(() => {
            UIComponents.setupImageErrorHandling();
        }, 100);
        
        return html;
    }
    
    // 画像エラーハンドリングを設定
    static setupImageErrorHandling() {
        const images = document.querySelectorAll('.server-icon-img');
        images.forEach(img => {
            img.onerror = function() {
                const fallback = this.getAttribute('data-fallback') || 'S';
                const guildId = this.getAttribute('data-guild-id');
                console.log(`画像読み込み失敗 (Guild ID: ${guildId}):`, this.src, 'フォールバック:', fallback);
                this.style.display = 'none';
                this.parentNode.innerHTML = fallback;
            };
        });
    }

    // チャンネルリストのHTMLを生成
    static createChannelListHTML(channels) {
        let html = '';
        
        channels.forEach(channel => {
            if (channel.type === 'text' || channel.type === 'settings') {
                if (channel.name === '設定' || channel.type === 'settings') {
                    html += `
                        <div class="channel-item uploader-channel" data-channel="${channel.id}">
                            <span class="channel-icon">⚙️</span>
                            <span class="channel-name">${channel.name}</span>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="channel-item" data-channel="${channel.id}">
                            <span class="channel-hash">#</span>
                            <span class="channel-name">${channel.name}</span>
                        </div>
                    `;
                }
            } else if (channel.type === 'uploader_public') {
                html += `
                    <div class="channel-item uploader-channel" data-channel="${channel.id}">
                        <span class="channel-icon">🌐</span>
                        <span class="channel-name">${channel.name}</span>
                    </div>
                `;
            } else if (channel.type === 'uploader_private') {
                html += `
                    <div class="channel-item uploader-channel" data-channel="${channel.id}">
                        <span class="channel-icon">🔒</span>
                        <span class="channel-name">${channel.name}</span>
                    </div>
                `;
            }
        });
        
        return html;
    }

    // DMユーザーリストのHTMLを生成
    static createDMUserListHTML(dmChannels) {
        let html = '';
        dmChannels.forEach(dm => {
            const participant = dm.participants[0]; // 最初の参加者（自分以外）
            if (participant) {
                html += `
                    <div class="dm-user-item" data-dm="${dm.id}">
                        <div class="dm-avatar">${(participant.nickname || participant.userid).charAt(0).toUpperCase()}</div>
                        <span class="dm-name">${participant.nickname || participant.userid}</span>
                        <div class="dm-status online"></div>
                    </div>
                `;
            }
        });
        
        return html;
    }

    // メンバーリストのHTMLを生成
    static createMemberListHTML(members, type) {
        return members.map(member => {
            // デバッグ出力
            console.log('🔍 Member data:', member);
            console.log('🔍 Member id:', member.id);
            console.log('🔍 Member user_id:', member.user_id);
            console.log('🔍 Member avatar_url:', member.avatar_url);
            
            // 現在ログインしているユーザーの情報を取得
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            console.log('🔍 Current user:', currentUser);
            
            // user_idフィールドを正しく取得（APIからはidとして返される）
            const memberId = member.user_id || member.id;
            
            // アバター表示の決定
            let avatarContent;
            if (currentUser && currentUser.id && memberId == currentUser.id && currentUser.avatar_url) {
                // 自分のメンバー表示の場合はlocalStorageから取得
                console.log('✓ Using current user avatar from localStorage');
                avatarContent = `<img src="${currentUser.avatar_url}?t=${Date.now()}" alt="${currentUser.nickname || currentUser.userid}" class="member-avatar-img">`;
            } else if (member.avatar_url) {
                // メンバーデータにアバターURL情報がある場合
                console.log('✓ Using member avatar_url:', member.avatar_url);
                avatarContent = `<img src="${member.avatar_url}?t=${Date.now()}" alt="${member.nickname || member.userid}" class="member-avatar-img">`;
            } else {
                // デフォルトは文字のプレースホルダー
                console.log('⚠️ No avatar found, using text placeholder');
                avatarContent = (member.nickname || member.userid).charAt(0).toUpperCase();
            }
            
            return `
                <div class="member-item">
                    <div class="member-avatar">${avatarContent}</div>
                    <div class="member-info">
                        <span class="member-name">${member.nickname || member.userid}</span>
                        <span class="member-activity">${type === 'online' ? (member.activity || 'LazyChillRoomを使用中') : (member.lastSeen || '最終ログイン: 不明')}</span>
                    </div>
                    <div class="member-status ${type}"></div>
                </div>
            `;
        }).join('');
    }

    // 画像モーダルのHTMLを生成
    static createImageModal() {
        return `
            <div class="image-modal" id="imageModal">
                <div class="image-modal-overlay"></div>
                <div class="image-modal-content">
                    <button class="image-modal-close" id="imageModalClose">&times;</button>
                    <img class="image-modal-image" id="imageModalImage" src="" alt="">
                    <div class="image-modal-info">
                        <div class="image-modal-filename" id="imageModalFilename"></div>
                        <div class="image-modal-size" id="imageModalSize"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // ステータスラベル取得
    static getStatusLabel(status) {
        const statusMap = {
            'online': '🟢 オンライン',
            'away': '🟡 退席中',
            'busy': '🔴 取り込み中',
            'invisible': '⚫ オフライン表示',
            'offline': '⚫ オフライン'
        };
        return statusMap[status] || '🟢 オンライン';
    }
}

// グローバルスコープに登録
window.UIComponents = UIComponents;
