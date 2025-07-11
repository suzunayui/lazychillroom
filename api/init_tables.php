<?php
/**
 * LazyChillRoom データベース初期化スクリプト
 * このファイルを実行すると、必要なテーブルの作成と初期データの投入を行います
 */

// 設定ファイルを読み込み
require_once __DIR__ . '/config.php';

try {
    // PDO接続を取得
    $pdo = getDbConnection();
    echo "データベースに接続しました。\n";

    // 既存のテーブルを削除（データの初期化）
    echo "既存のテーブルを削除中...\n";
    
    // 外部キー制約を無効化
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // テーブルを削除（依存関係を考慮した順序）
    $tables = [
        'file_attachments',
        'message_edit_history',
        'pinned_messages',
        'notification_settings',
        'user_settings',
        'user_sessions_detailed',
        'guild_member_presence',
        'user_presence',
        'webhooks',
        'voice_states',
        'audit_logs',
        'guild_bans',
        'invites',
        'mentions',
        'message_reactions',
        'emojis',
        'user_sessions',
        'friends',
        'channel_permissions',
        'member_roles',
        'guild_members',
        'messages',
        'dm_participants',
        'channels',
        'channel_categories',
        'roles',
        'guilds',
        'users'
    ];
    
    foreach ($tables as $table) {
        $pdo->exec("DROP TABLE IF EXISTS {$table}");
        echo "- {$table}テーブル削除完了\n";
    }
    
    // 外部キー制約を再有効化
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    
    echo "既存テーブルの削除が完了しました。\n\n";

    // テーブル作成開始
    echo "テーブルを作成中...\n";

    // ユーザーテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            avatar_url VARCHAR(255) DEFAULT NULL,
            status ENUM('online', 'away', 'busy', 'offline', 'invisible') DEFAULT 'offline',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_username (username),
            INDEX idx_email (email)
        )
    ");
    echo "- usersテーブル作成完了\n";

    // サーバー（Guild）テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS guilds (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            icon_url VARCHAR(255) DEFAULT NULL,
            banner_url VARCHAR(255) DEFAULT NULL,
            owner_id INT NOT NULL,
            verification_level ENUM('none', 'low', 'medium', 'high', 'very_high') DEFAULT 'none',
            explicit_content_filter ENUM('disabled', 'members_without_roles', 'all_members') DEFAULT 'disabled',
            member_count INT DEFAULT 0,
            is_personal_server BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_owner (owner_id),
            INDEX idx_personal_server (is_personal_server)
        )
    ");
    echo "- guildsテーブル作成完了\n";

    // ロールテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            color VARCHAR(7) DEFAULT '#99aab5',
            permissions BIGINT UNSIGNED DEFAULT 0,
            position INT DEFAULT 0,
            hoist BOOLEAN DEFAULT FALSE,
            mentionable BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            INDEX idx_guild_position (guild_id, position)
        )
    ");
    echo "- rolesテーブル作成完了\n";

    // チャンネルカテゴリテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS channel_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            position INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            INDEX idx_guild_position (guild_id, position)
        )
    ");
    echo "- channel_categoriesテーブル作成完了\n";

    // チャンネルテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS channels (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT DEFAULT NULL,
            category_id INT DEFAULT NULL,
            name VARCHAR(100) DEFAULT NULL,
            type ENUM('text', 'voice', 'dm', 'group_dm', 'uploader_public', 'uploader_private') DEFAULT 'text',
            topic TEXT,
            position INT DEFAULT 0,
            nsfw BOOLEAN DEFAULT FALSE,
            rate_limit_per_user INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES channel_categories(id) ON DELETE SET NULL,
            INDEX idx_guild_position (guild_id, position),
            INDEX idx_category (category_id)
        )
    ");
    echo "- channelsテーブル作成完了\n";

    // DMチャンネル参加者テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS dm_participants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            channel_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_dm_participant (channel_id, user_id),
            INDEX idx_channel (channel_id),
            INDEX idx_user (user_id)
        )
    ");
    echo "- dm_participantsテーブル作成完了\n";

    // メッセージテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            channel_id INT NOT NULL,
            user_id INT NOT NULL,
            content TEXT NOT NULL,
            type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
            file_url VARCHAR(255) DEFAULT NULL,
            file_name VARCHAR(255) DEFAULT NULL,
            file_size INT DEFAULT NULL,
            reply_to_id INT DEFAULT NULL,
            edited_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
            INDEX idx_channel_created (channel_id, created_at),
            INDEX idx_user (user_id),
            INDEX idx_reply (reply_to_id)
        )
    ");
    echo "- messagesテーブル作成完了\n";

    // ギルドメンバーテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS guild_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT NOT NULL,
            user_id INT NOT NULL,
            nickname VARCHAR(50) DEFAULT NULL,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_member (guild_id, user_id),
            INDEX idx_guild (guild_id),
            INDEX idx_user (user_id)
        )
    ");
    echo "- guild_membersテーブル作成完了\n";

    // メンバーロール関連テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS member_roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT NOT NULL,
            user_id INT NOT NULL,
            role_id INT NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
            UNIQUE KEY unique_member_role (guild_id, user_id, role_id),
            INDEX idx_guild_user (guild_id, user_id),
            INDEX idx_role (role_id)
        )
    ");
    echo "- member_rolesテーブル作成完了\n";

    // チャンネル権限オーバーライドテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS channel_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            channel_id INT NOT NULL,
            target_type ENUM('role', 'user') NOT NULL,
            target_id INT NOT NULL,
            allow_permissions BIGINT UNSIGNED DEFAULT 0,
            deny_permissions BIGINT UNSIGNED DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            UNIQUE KEY unique_permission (channel_id, target_type, target_id),
            INDEX idx_channel (channel_id),
            INDEX idx_target (target_type, target_id)
        )
    ");
    echo "- channel_permissionsテーブル作成完了\n";

    // フレンドリストテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS friends (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            friend_id INT NOT NULL,
            status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_friendship (user_id, friend_id),
            INDEX idx_user_status (user_id, status),
            INDEX idx_friend (friend_id)
        )
    ");
    echo "- friendsテーブル作成完了\n";

    // セッションテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(255) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token (token),
            INDEX idx_user_expires (user_id, expires_at)
        )
    ");
    echo "- user_sessionsテーブル作成完了\n";

    // 絵文字・リアクションテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS emojis (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT DEFAULT NULL,
            name VARCHAR(32) NOT NULL,
            emoji_unicode VARCHAR(50) DEFAULT NULL,
            image_url VARCHAR(255) DEFAULT NULL,
            animated BOOLEAN DEFAULT FALSE,
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE KEY unique_guild_emoji (guild_id, name),
            INDEX idx_guild (guild_id)
        )
    ");
    echo "- emojisテーブル作成完了\n";

    // メッセージリアクションテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS message_reactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NOT NULL,
            user_id INT NOT NULL,
            emoji_id INT DEFAULT NULL,
            emoji_unicode VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (emoji_id) REFERENCES emojis(id) ON DELETE CASCADE,
            UNIQUE KEY unique_reaction (message_id, user_id, emoji_id, emoji_unicode),
            INDEX idx_message (message_id),
            INDEX idx_user (user_id)
        )
    ");
    echo "- message_reactionsテーブル作成完了\n";

    // メンション・通知テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS mentions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NOT NULL,
            user_id INT NOT NULL,
            type ENUM('user', 'role', 'everyone', 'here') DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_created (user_id, created_at),
            INDEX idx_message (message_id)
        )
    ");
    echo "- mentionsテーブル作成完了\n";

    // 招待リンクテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS invites (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(10) NOT NULL UNIQUE,
            guild_id INT NOT NULL,
            channel_id INT DEFAULT NULL,
            inviter_id INT NOT NULL,
            max_uses INT DEFAULT 0,
            uses INT DEFAULT 0,
            max_age INT DEFAULT 0,
            temporary BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP DEFAULT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
            FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_code (code),
            INDEX idx_guild (guild_id),
            INDEX idx_expires (expires_at)
        )
    ");
    echo "- invitesテーブル作成完了\n";

    // BANテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS guild_bans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT NOT NULL,
            user_id INT NOT NULL,
            banned_by INT NOT NULL,
            reason TEXT DEFAULT NULL,
            delete_message_days INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP DEFAULT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_ban (guild_id, user_id),
            INDEX idx_guild (guild_id),
            INDEX idx_user (user_id),
            INDEX idx_expires (expires_at)
        )
    ");
    echo "- guild_bansテーブル作成完了\n";

    // 監査ログテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT NOT NULL,
            user_id INT DEFAULT NULL,
            target_id INT DEFAULT NULL,
            action_type ENUM(
                'guild_update', 'channel_create', 'channel_update', 'channel_delete',
                'emoji_create', 'emoji_update', 'emoji_delete'
            ) NOT NULL,
            reason TEXT DEFAULT NULL,
            changes JSON DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_guild_created (guild_id, created_at),
            INDEX idx_user (user_id),
            INDEX idx_action (action_type)
        )
    ");
    echo "- audit_logsテーブル作成完了\n";

    // ボイスチャンネル接続状態テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS voice_states (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            guild_id INT DEFAULT NULL,
            channel_id INT DEFAULT NULL,
            session_id VARCHAR(32) NOT NULL,
            deaf BOOLEAN DEFAULT FALSE,
            mute BOOLEAN DEFAULT FALSE,
            self_deaf BOOLEAN DEFAULT FALSE,
            self_mute BOOLEAN DEFAULT FALSE,
            suppress BOOLEAN DEFAULT FALSE,
            connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
            UNIQUE KEY unique_voice_state (user_id),
            INDEX idx_channel (channel_id),
            INDEX idx_guild (guild_id)
        )
    ");
    echo "- voice_statesテーブル作成完了\n";

    // Webhookテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS webhooks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT NOT NULL,
            channel_id INT NOT NULL,
            name VARCHAR(80) NOT NULL,
            avatar_url VARCHAR(255) DEFAULT NULL,
            token VARCHAR(68) NOT NULL UNIQUE,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_channel (channel_id),
            INDEX idx_token (token)
        )
    ");
    echo "- webhooksテーブル作成完了\n";

    // ユーザーアクティビティ・プレゼンステーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_presence (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            status ENUM('online', 'away', 'busy', 'offline', 'invisible') DEFAULT 'offline',
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_presence (user_id),
            INDEX idx_last_seen (last_seen)
        )
    ");
    echo "- user_presenceテーブル作成完了\n";

    // ギルドメンバーのオンライン状態テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS guild_member_presence (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id INT NOT NULL,
            user_id INT NOT NULL,
            status ENUM('online', 'away', 'busy', 'offline', 'invisible') DEFAULT 'offline',
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_guild_presence (guild_id, user_id),
            INDEX idx_last_seen (last_seen)
        )
    ");
    echo "- guild_member_presenceテーブル作成完了\n";

    // ユーザーセッション詳細テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_sessions_detailed (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_token VARCHAR(255) NOT NULL UNIQUE,
            device_name VARCHAR(100) DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            user_agent TEXT DEFAULT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_expires (expires_at),
            INDEX idx_user (user_id)
        )
    ");
    echo "- user_sessions_detailedテーブル作成完了\n";

    // ユーザー設定テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            theme ENUM('light', 'dark', 'auto') DEFAULT 'dark',
            language VARCHAR(10) DEFAULT 'ja',
            status_message VARCHAR(200) DEFAULT NULL,
            show_online_status BOOLEAN DEFAULT TRUE,
            allow_dms BOOLEAN DEFAULT TRUE,
            compact_mode BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_settings (user_id)
        )
    ");
    echo "- user_settingsテーブル作成完了\n";

    // 通知設定テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notification_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            guild_id INT DEFAULT NULL,
            channel_id INT DEFAULT NULL,
            notification_type ENUM('all', 'mentions', 'none') DEFAULT 'all',
            sound_enabled BOOLEAN DEFAULT TRUE,
            push_enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            INDEX idx_guild (guild_id),
            INDEX idx_user (user_id)
        )
    ");
    echo "- notification_settingsテーブル作成完了\n";

    // メッセージピン留めテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pinned_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NOT NULL,
            channel_id INT NOT NULL,
            pinned_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_pinned_message (message_id),
            INDEX idx_message (message_id),
            INDEX idx_channel (channel_id)
        )
    ");
    echo "- pinned_messagesテーブル作成完了\n";

    // メッセージ編集履歴テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS message_edit_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NOT NULL,
            old_content TEXT NOT NULL,
            edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            INDEX idx_message_edited (message_id, edited_at)
        )
    ");
    echo "- message_edit_historyテーブル作成完了\n";

    // ファイル添付情報テーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS file_attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_size INT NOT NULL,
            file_url VARCHAR(500) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            width INT DEFAULT NULL,
            height INT DEFAULT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            INDEX idx_message (message_id),
            INDEX idx_mime_type (mime_type)
        )
    ");
    echo "- file_attachmentsテーブル作成完了\n";

    // 公開ファイルテーブル
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS public_files (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            message_id INT DEFAULT NULL,
            original_filename VARCHAR(255) NOT NULL,
            public_filename VARCHAR(255) NOT NULL UNIQUE,
            file_size BIGINT NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            access_url VARCHAR(500) NOT NULL,
            download_count INT DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed_at TIMESTAMP NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
            INDEX idx_user (user_id),
            INDEX idx_public_filename (public_filename),
            INDEX idx_active (is_active),
            INDEX idx_created_at (created_at)
        )
    ");
    echo "- public_filesテーブル作成完了\n";

    echo "\n初期データを挿入中...\n";

    // システムユーザーと管理者アカウントを作成
    $pdo->exec("
        INSERT INTO users (username, email, password_hash) VALUES 
        ('システム', 'system@lazychillroom.com', '$2y$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
        ('Admin', 'admin@lazychillroom.com', '$2y$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
    ");
    echo "- システムユーザーとAdmin用ユーザーデータ投入完了\n";

    // デフォルトサーバー（Guild）を作成
    $pdo->exec("
        INSERT INTO guilds (name, description, owner_id) VALUES 
        ('LazyChillRoom', 'メインサーバー - 自由にチャットを楽しもう！', 2)
        ON DUPLICATE KEY UPDATE name = name
    ");
    echo "- ギルドデータ投入完了\n";

    // デフォルトロールを作成
    $pdo->exec("
        INSERT INTO roles (guild_id, name, color, permissions, position, hoist, mentionable) VALUES 
        (1, '@everyone', '#99aab5', 1049600, 0, FALSE, FALSE),
        (1, 'Admin', '#f04747', 2147483647, 10, TRUE, TRUE),
        (1, 'Moderator', '#5865f2', 268697600, 5, TRUE, TRUE),
        (1, 'Member', '#57f287', 1081344, 1, FALSE, FALSE)
        ON DUPLICATE KEY UPDATE name = name
    ");
    echo "- ロールデータ投入完了\n";

    // チャンネルカテゴリを作成
    $pdo->exec("
        INSERT INTO channel_categories (guild_id, name, position) VALUES 
        (1, 'テキストチャンネル', 0),
        (1, 'ボイスチャンネル', 1)
        ON DUPLICATE KEY UPDATE name = name
    ");
    echo "- チャンネルカテゴリデータ投入完了\n";

    // デフォルトチャンネルを作成
    $pdo->exec("
        INSERT INTO channels (guild_id, category_id, name, type, topic, position) VALUES 
        (1, 1, '一般', 'text', 'みんなで雑談しよう！', 0),
        (1, 1, '雑談', 'text', '日常的な会話やおしゃべり', 1),
        (1, 1, '質問', 'text', '分からないことがあったら聞いてみよう', 2),
        (1, 1, '技術', 'text', 'プログラミングや技術の話題', 3),
        (1, 1, '画像', 'text', '画像や写真の共有', 4),
        (1, 2, 'General', 'voice', NULL, 0),
        (1, 2, 'Music', 'voice', NULL, 1),
        (1, 2, 'Gaming', 'voice', NULL, 2)
        ON DUPLICATE KEY UPDATE name = name
    ");
    echo "- チャンネルデータ投入完了\n";

    // ギルドメンバーを追加
    $pdo->exec("
        INSERT INTO guild_members (guild_id, user_id, nickname) VALUES 
        (1, 1, NULL),
        (1, 2, 'Administrator')
        ON DUPLICATE KEY UPDATE nickname = nickname
    ");
    echo "- ギルドメンバーデータ投入完了\n";

    // メンバーにロールを付与
    $pdo->exec("
        INSERT INTO member_roles (guild_id, user_id, role_id) VALUES 
        (1, 1, 1),
        (1, 2, 1),
        (1, 2, 2)
        ON DUPLICATE KEY UPDATE role_id = role_id
    ");
    echo "- メンバーロールデータ投入完了\n";

    // ユーザープレゼンス初期データ
    $pdo->exec("
        INSERT INTO user_presence (user_id, status, last_seen) VALUES 
        (1, 'online', NOW()),
        (2, 'online', NOW())
        ON DUPLICATE KEY UPDATE status = VALUES(status), last_seen = VALUES(last_seen)
    ");
    echo "- ユーザープレゼンスデータ投入完了\n";

    // ギルドメンバープレゼンス初期データ
    $pdo->exec("
        INSERT INTO guild_member_presence (guild_id, user_id, status, last_seen) VALUES 
        (1, 1, 'online', NOW()),
        (1, 2, 'online', NOW())
        ON DUPLICATE KEY UPDATE status = VALUES(status), last_seen = VALUES(last_seen)
    ");
    echo "- ギルドメンバープレゼンスデータ投入完了\n";

    // ユーザー設定初期データ
    $pdo->exec("
        INSERT INTO user_settings (user_id, status_message) VALUES 
        (1, 'システムユーザー'),
        (2, '管理者です')
        ON DUPLICATE KEY UPDATE status_message = VALUES(status_message)
    ");
    echo "- ユーザー設定データ投入完了\n";

    // 通知設定初期データ
    $pdo->exec("
        INSERT INTO notification_settings (user_id, guild_id, notification_type) VALUES 
        (1, 1, 'mentions'),
        (2, 1, 'all')
        ON DUPLICATE KEY UPDATE notification_type = VALUES(notification_type)
    ");
    echo "- 通知設定データ投入完了\n";

    // 基本的なユニコード絵文字を追加
    $pdo->exec("
        INSERT INTO emojis (guild_id, name, emoji_unicode) VALUES 
        (NULL, '👍', '👍'),
        (NULL, '👎', '👎'),
        (NULL, '❤️', '❤️'),
        (NULL, '😂', '😂'),
        (NULL, '😮', '😮'),
        (NULL, '😢', '😢'),
        (NULL, '😡', '😡'),
        (NULL, '🎉', '🎉')
        ON DUPLICATE KEY UPDATE name = name
    ");
    echo "- 絵文字データ投入完了\n";

    // フレンド関係は省略（システムユーザーとAdminのみのため）
    echo "- フレンドデータは省略\n";

    // DMチャンネルも省略（システム用のため）
    echo "- DMチャンネルデータは省略\n";

    // DM参加者も省略
    echo "- DM参加者データは省略\n";

    // 招待リンクを作成
    $pdo->exec("
        INSERT INTO invites (code, guild_id, channel_id, inviter_id, max_uses, max_age) VALUES 
        ('welcome123', 1, 1, 2, 0, 0)
        ON DUPLICATE KEY UPDATE code = code
    ");
    echo "- 招待リンクデータ投入完了\n";

    // 既存ユーザーのマイサーバーを作成
    echo "\n既存ユーザーのマイサーバーを作成中...\n";
    createPersonalServersForExistingUsers($pdo);

    // 追加のユーザーは本番では作成しない
    echo "- 本番環境では追加ユーザーを作成しません\n";

    echo "\n✅ データベースの初期化が完了しました！\n";
    echo "作成されたテーブル数: " . count($pdo->query("SHOW TABLES")->fetchAll()) . "\n";

} catch (PDOException $e) {
    echo "❌ エラーが発生しました: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "❌ 予期しないエラーが発生しました: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n🎉 初期化スクリプトの実行が完了しました！\n";

// 既存ユーザーのマイサーバーを作成する関数
function createPersonalServersForExistingUsers($pdo) {
    try {
        // マイサーバーを持たないユーザーを取得
        $stmt = $pdo->query("
            SELECT u.id, u.username 
            FROM users u 
            WHERE NOT EXISTS (
                SELECT 1 FROM guilds g 
                WHERE g.owner_id = u.id AND g.is_personal_server = 1
            )
        ");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($users as $user) {
            echo "- {$user['username']} のマイサーバーを作成中...\n";
            createUserPersonalServer($pdo, $user['id'], $user['username']);
            echo "  ✓ 完了\n";
        }
        
        echo "✅ マイサーバー作成完了\n";
        
    } catch (Exception $e) {
        echo "❌ マイサーバー作成エラー: " . $e->getMessage() . "\n";
    }
}

// マイサーバーを作成する関数
function createUserPersonalServer($pdo, $userId, $username) {
    try {
        // マイサーバーを作成
        $stmt = $pdo->prepare("
            INSERT INTO guilds (name, owner_id, icon_url, is_personal_server, created_at) 
            VALUES (?, ?, NULL, 1, NOW())
        ");
        $stmt->execute(["{$username}のサーバー", $userId]);
        $guildId = $pdo->lastInsertId();
        
        // ギルドメンバーとして追加
        $stmt = $pdo->prepare("
            INSERT INTO guild_members (guild_id, user_id, joined_at) 
            VALUES (?, ?, NOW())
        ");
        $stmt->execute([$guildId, $userId]);
        
        // アップローダーカテゴリを作成
        $stmt = $pdo->prepare("
            INSERT INTO channel_categories (guild_id, name, position) 
            VALUES (?, 'アップローダー', 0)
        ");
        $stmt->execute([$guildId]);
        $categoryId = $pdo->lastInsertId();
        
        // 公開チャンネルを作成
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '公開', 'uploader_public', 0, '公開ファイルアップローダー - アップロードしたファイルはインターネット上で公開されます')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        // 非公開チャンネルを作成
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '非公開', 'uploader_private', 1, '非公開ファイルアップローダー - アップロードしたファイルはあなただけがアクセスできます')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        // 設定チャンネルを作成（非公開チャンネルの下）
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '設定', 'text', 2, 'プロフィール設定やアカウント管理')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        return $guildId;
        
    } catch (Exception $e) {
        throw new Exception("Personal server creation failed for user $userId: " . $e->getMessage());
    }
}
?>