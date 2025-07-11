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
                                <span>${currentUser.username.charAt(0).toUpperCase()}</span>
                            </div>
                            <div class="user-details">
                                <div class="username clickable-username" id="usernameBtn" title="マイサーバーを開く">${currentUser.username}</div>
                                <div class="user-status">オンライン</div>
                            </div>
                            <div class="user-actions">
                                <button class="my-server-btn" id="myServerBtn" title="マイサーバー">マイサーバー</button>
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
                        <div class="channel-info">
                            <span class="channel-hash" id="channelHash">#</span>
                            <span class="channel-name" id="currentChannelName">チャンネルを選択してください</span>
                            <span class="channel-topic" id="channelTopic">...</span>
                        </div>
                    </div>

                    <div class="chat-messages" id="chatMessages">
                        <div class="welcome-message">
                            <h3>LazyChillRoomへようこそ！🎉</h3>
                            <p>サーバーまたはDMを選択してチャットを開始しましょう。</p>
                        </div>
                    </div>

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

                <!-- メンバーリスト -->
                <div class="members-sidebar" id="membersSidebar">
                    <div class="members-header">
                        <span id="membersCount">メンバー - 4</span>
                    </div>
                    <div class="members-list">
                        <!-- オンラインメンバー -->
                        <div class="members-section">
                            <div class="members-section-header">
                                <span class="section-title">オンライン - 2</span>
                            </div>
                            <div class="members-group" id="onlineMembers">
                                <div class="member-item">
                                    <div class="member-avatar">T</div>
                                    <div class="member-info">
                                        <span class="member-name">テストユーザー</span>
                                        <span class="member-activity">LazyChillRoomを使用中</span>
                                    </div>
                                    <div class="member-status online"></div>
                                </div>
                                <div class="member-item">
                                    <div class="member-avatar">A</div>
                                    <div class="member-info">
                                        <span class="member-name">Admin</span>
                                        <span class="member-activity">Visual Studio Code</span>
                                    </div>
                                    <div class="member-status online"></div>
                                </div>
                            </div>
                        </div>

                        <!-- オフラインメンバー -->
                        <div class="members-section">
                            <div class="members-section-header">
                                <span class="section-title">オフライン - 2</span>
                            </div>
                            <div class="members-group" id="offlineMembers">
                                <div class="member-item">
                                    <div class="member-avatar">B</div>
                                    <div class="member-info">
                                        <span class="member-name">Bob</span>
                                        <span class="member-activity">最終ログイン: 2時間前</span>
                                    </div>
                                    <div class="member-status offline"></div>
                                </div>
                                <div class="member-item">
                                    <div class="member-avatar">C</div>
                                    <div class="member-info">
                                        <span class="member-name">Charlie</span>
                                        <span class="member-activity">最終ログイン: 1日前</span>
                                    </div>
                                    <div class="member-status offline"></div>
                                </div>
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
                <span>${currentUser.username.charAt(0).toUpperCase()}</span>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${currentUser.username}</span>
                    <span class="message-timestamp">${TimeUtils.getCurrentJSTTime()}</span>
                </div>
                <div class="message-text">${content}</div>
            </div>
        `;
        return messageElement;
    }

    // サーバーリストのHTMLを生成
    static createServerListHTML(guilds) {
        let html = '';
        
        guilds.forEach(guild => {
            const iconText = guild.name.substring(0, 2).toUpperCase();
            html += `
                <div class="server-item" data-server="${guild.id}">
                    <div class="server-icon">${iconText}</div>
                </div>
            `;
        });
        
        // サーバー追加ボタン
        html += `
            <div class="server-item add-server" id="addServerBtn">
                <div class="server-icon plus">+</div>
            </div>
        `;
        
        return html;
    }

    // チャンネルリストのHTMLを生成
    static createChannelListHTML(channels) {
        let html = '';
        
        channels.forEach(channel => {
            if (channel.type === 'text' || channel.type === 'settings') {
                if (channel.name === '設定' || channel.type === 'settings') {
                    html += `
                        <div class="channel-item settings-channel" data-channel="${channel.id}">
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
                        <div class="dm-avatar">${participant.username.charAt(0).toUpperCase()}</div>
                        <span class="dm-name">${participant.username}</span>
                        <div class="dm-status online"></div>
                    </div>
                `;
            }
        });
        
        // フレンド追加ボタン
        html += `
            <div class="dm-user-item add-friend" id="addFriendBtn">
                <div class="dm-avatar plus">+</div>
                <span class="dm-name">フレンドを追加</span>
            </div>
        `;
        
        return html;
    }

    // メンバーリストのHTMLを生成
    static createMemberListHTML(members, type) {
        return members.map(member => `
            <div class="member-item">
                <div class="member-avatar">${member.username.charAt(0).toUpperCase()}</div>
                <div class="member-info">
                    <span class="member-name">${member.username}</span>
                    <span class="member-activity">${type === 'online' ? (member.activity || 'LazyChillRoomを使用中') : (member.lastSeen || '最終ログイン: 不明')}</span>
                </div>
                <div class="member-status ${type}"></div>
            </div>
        `).join('');
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
}

// グローバルスコープに登録
window.UIComponents = UIComponents;
