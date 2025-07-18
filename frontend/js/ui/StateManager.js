// チャット状態管理クラス
class StateManager {
    constructor(chatUI) {
        this.chatUI = chatUI;
    }

    // 状態保存メソッド
    saveState() {
        const state = {
            isDMMode: this.chatUI.isDMMode,
            currentGuildId: this.chatUI.currentGuild?.id || null,
            currentChannelId: this.chatUI.currentChannel?.id || null,
            isMyServer: this.chatUI.currentGuild?.is_personal_server || false,
            timestamp: Date.now()
        };
        
        localStorage.setItem('chatUI_state', JSON.stringify(state));
        console.log('✓ 状態を保存しました:', state);
        
        // デバッグ: チャンネル名も表示
        if (this.chatUI.currentChannel) {
            console.log(`  - 現在のチャンネル: ${this.chatUI.currentChannel.name} (ID: ${this.chatUI.currentChannel.id})`);
        }
        if (this.chatUI.currentGuild) {
            console.log(`  - 現在のサーバー: ${this.chatUI.currentGuild.name} (ID: ${this.chatUI.currentGuild.id})`);
            console.log(`  - マイサーバー: ${this.chatUI.currentGuild.is_personal_server ? 'はい' : 'いいえ'}`);
        }
    }

    // 状態復元メソッド
    loadState() {
        try {
            const savedState = localStorage.getItem('chatUI_state');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // 7日間以内の状態のみ復元（24時間から延長）
                const oneWeek = 7 * 24 * 60 * 60 * 1000;
                if (state.timestamp && (Date.now() - state.timestamp) < oneWeek) {
                    console.log('✓ 保存された状態を発見:', state);
                    const ageHours = Math.floor((Date.now() - state.timestamp) / (1000 * 60 * 60));
                    const ageDays = Math.floor(ageHours / 24);
                    if (ageDays > 0) {
                        console.log(`  - 状態の経過時間: ${ageDays}日${ageHours % 24}時間前`);
                    } else {
                        console.log(`  - 状態の経過時間: ${ageHours}時間前`);
                    }
                    return state;
                } else {
                    console.log('⚠ 保存された状態が古すぎるため無視します');
                    localStorage.removeItem('chatUI_state');
                }
            } else {
                console.log('💡 保存された状態が見つかりません（初回起動またはクリア済み）');
            }
        } catch (error) {
            console.error('❌ 状態復元エラー:', error);
            localStorage.removeItem('chatUI_state');
        }
        return null;
    }

    // 状態復元実行メソッド
    async restoreState(savedState, guilds) {
        try {
            console.log('🔄 状態復元を開始します...', savedState);
            
            // DMモードの復元
            if (savedState.isDMMode) {
                console.log('📱 DMモードを復元します');
                await this.chatUI.showDMMode();
                
                // DMチャンネルの復元
                if (savedState.currentChannelId) {
                    console.log(`💬 DMチャンネルを復元します (ID: ${savedState.currentChannelId})`);
                    
                    // リトライ機能付きでDMチャンネルを取得
                    let dmChannels = null;
                    for (let i = 0; i < 3; i++) {
                        try {
                            dmChannels = await this.chatUI.chatManager.loadChannels();
                            if (dmChannels && dmChannels.length > 0) break;
                            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                        } catch (error) {
                            console.warn(`DMチャンネル取得リトライ ${i + 1}/3:`, error);
                        }
                    }
                    
                    if (dmChannels) {
                        const targetDM = dmChannels.find(dm => dm.id == savedState.currentChannelId);
                        if (targetDM) {
                            this.chatUI.currentChannel = targetDM;
                            this.chatUI.chatManager.currentChannel = targetDM;
                            this.chatUI.updateChatHeader(targetDM);
                            await this.chatUI.loadAndRenderMessages(targetDM.id);
                            this.chatUI.uiUtils.setActiveDM(targetDM.id);
                            console.log(`✓ DMチャンネル復元完了: ${targetDM.display_name}`);
                            return true;
                        } else {
                            console.log('⚠ 指定されたDMチャンネルが見つかりません');
                        }
                    } else {
                        console.log('⚠ DMチャンネルリストの取得に失敗しました');
                    }
                }
                return true;
            }
            
            // マイサーバーの復元（isMyServerフラグで判定）
            if (savedState.isMyServer) {
                console.log('🏠 マイサーバーを復元します');
                
                // リトライ機能付きでマイサーバーを取得
                let myServer = null;
                for (let i = 0; i < 3; i++) {
                    try {
                        myServer = await this.chatUI.chatManager.getMyServer();
                        if (myServer) break;
                        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                    } catch (error) {
                        console.warn(`マイサーバー取得リトライ ${i + 1}/3:`, error);
                    }
                }
                
                if (myServer) {
                    // ServerManager経由でマイサーバーを表示
                    this.chatUI.serverManager.showMyServer(myServer);
                    
                    // マイサーバーのチャンネル復元
                    if (savedState.currentChannelId && myServer.channels) {
                        console.log(`📁 マイサーバーのチャンネルを復元します (ID: ${savedState.currentChannelId})`);
                        const targetChannel = myServer.channels.find(ch => ch.id == savedState.currentChannelId);
                        if (targetChannel) {
                            this.chatUI.currentChannel = targetChannel;
                            this.chatUI.chatManager.currentChannel = targetChannel;
                            this.chatUI.updateChatHeader(targetChannel);
                            await this.chatUI.loadAndRenderMessages(targetChannel.id);
                            this.chatUI.uiUtils.setActiveChannel(targetChannel.id);
                            console.log(`✓ マイサーバーのチャンネル復元完了: ${targetChannel.name}`);
                        } else {
                            console.log('⚠ 指定されたマイサーバーチャンネルが見つかりません');
                        }
                    }
                    return true;
                } else {
                    console.log('⚠ マイサーバーが見つかりません');
                }
            }
            
            // 通常のサーバーの復元
            if (savedState.currentGuildId) {
                console.log(`🖥️ 通常のサーバーを復元します (ID: ${savedState.currentGuildId})`);
                const targetGuild = guilds.find(guild => guild.id == savedState.currentGuildId);
                if (targetGuild) {
                    this.chatUI.currentGuild = targetGuild;
                    
                    // セクションタイトルを更新
                    const sectionTitle = document.getElementById('sectionTitle');
                    sectionTitle.textContent = 'テキストチャンネル';
                    
                    await this.chatUI.loadAndRenderChannels(targetGuild.id);
                    this.chatUI.uiUtils.setActiveServer(targetGuild.id);
                    
                    // 通常のサーバーの場合はメンバーリストを表示
                    this.chatUI.uiUtils.showMembersList();
                    
                    // チャンネルの復元
                    if (savedState.currentChannelId) {
                        console.log(`📁 通常のサーバーのチャンネルを復元します (ID: ${savedState.currentChannelId})`);
                        const targetChannel = this.chatUI.chatManager.channels.find(ch => ch.id == savedState.currentChannelId);
                        if (targetChannel) {
                            this.chatUI.currentChannel = targetChannel;
                            this.chatUI.chatManager.currentChannel = targetChannel;
                            this.chatUI.updateChatHeader(targetChannel);
                            await this.chatUI.loadAndRenderMessages(targetChannel.id);
                            this.chatUI.uiUtils.setActiveChannel(targetChannel.id);
                            console.log(`✓ 通常のサーバーのチャンネル復元完了: ${targetChannel.name}`);
                        } else {
                            console.log('⚠ 指定された通常のサーバーチャンネルが見つかりません、デフォルトチャンネルを選択します');
                            await this.chatUI.selectDefaultChannel(targetGuild.id);
                        }
                    } else {
                        console.log('ℹ️ 保存されたチャンネルIDがないため、デフォルトチャンネルを選択します');
                        await this.chatUI.selectDefaultChannel(targetGuild.id);
                    }
                    return true;
                } else {
                    console.log('⚠ 指定されたサーバーが見つかりません');
                }
            }
            
            console.log('⚠ 状態復元に失敗しました（対象が見つかりません）');
            return false;
        } catch (error) {
            console.error('状態復元実行エラー:', error);
            return false;
        }
    }
}

// グローバルスコープに登録
window.StateManager = StateManager;
