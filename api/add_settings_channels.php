<?php
/**
 * 既存のマイサーバーに設定チャンネルを追加するスクリプト
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();
    echo "データベースに接続しました。\n";
    
    // 既存のマイサーバーを取得
    $stmt = $pdo->query("
        SELECT id, name, owner_id 
        FROM guilds 
        WHERE is_personal_server = 1
    ");
    $personalServers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($personalServers as $server) {
        echo "マイサーバー '{$server['name']}' (ID: {$server['id']}) を処理中...\n";
        
        // 設定チャンネルが既に存在するかチェック
        $stmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM channels 
            WHERE guild_id = ? AND name = '設定' AND type = 'text'
        ");
        $stmt->execute([$server['id']]);
        $settingsChannelExists = $stmt->fetchColumn() > 0;
        
        if ($settingsChannelExists) {
            echo "  - 設定チャンネルは既に存在します。スキップ。\n";
            continue;
        }
        
        // テキストチャンネルカテゴリを取得または作成
        $stmt = $pdo->prepare("
            SELECT id FROM channel_categories 
            WHERE guild_id = ? AND name = 'テキストチャンネル'
        ");
        $stmt->execute([$server['id']]);
        $textCategoryId = $stmt->fetchColumn();
        
        if (!$textCategoryId) {
            // テキストチャンネルカテゴリを作成
            $stmt = $pdo->prepare("
                INSERT INTO channel_categories (guild_id, name, position) 
                VALUES (?, 'テキストチャンネル', 0)
            ");
            $stmt->execute([$server['id']]);
            $textCategoryId = $pdo->lastInsertId();
            echo "  - テキストチャンネルカテゴリを作成しました。\n";
            
            // 既存のアップローダーカテゴリの位置を調整
            $stmt = $pdo->prepare("
                UPDATE channel_categories 
                SET position = position + 1 
                WHERE guild_id = ? AND name != 'テキストチャンネル'
            ");
            $stmt->execute([$server['id']]);
        }
        
        // 設定チャンネルを作成
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '設定', 'text', 0, 'プロフィール設定やアカウント管理')
        ");
        $stmt->execute([$server['id'], $textCategoryId]);
        
        echo "  - 設定チャンネルを作成しました。\n";
    }
    
    echo "\n✅ すべてのマイサーバーの処理が完了しました！\n";
    
} catch (Exception $e) {
    echo "❌ エラーが発生しました: " . $e->getMessage() . "\n";
    exit(1);
}
?>
