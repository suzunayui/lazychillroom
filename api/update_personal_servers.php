<?php
/**
 * 既存のマイサーバーに設定チャンネルを追加するスクリプト
 * 非公開チャンネルの下（position 2）に配置
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();
    echo "データベースに接続しました。\n";
    
    // 既存のマイサーバーを取得
    $stmt = $pdo->query("
        SELECT g.id, g.name, g.owner_id 
        FROM guilds g
        WHERE g.is_personal_server = 1
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
        
        // アップローダーカテゴリを取得
        $stmt = $pdo->prepare("
            SELECT id FROM channel_categories 
            WHERE guild_id = ? AND name = 'アップローダー'
        ");
        $stmt->execute([$server['id']]);
        $categoryId = $stmt->fetchColumn();
        
        if (!$categoryId) {
            echo "  - アップローダーカテゴリが見つかりません。スキップ。\n";
            continue;
        }
        
        // 設定チャンネルを作成（非公開チャンネルの下、position 2）
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '設定', 'text', 2, 'プロフィール設定やアカウント管理')
        ");
        $stmt->execute([$server['id'], $categoryId]);
        
        echo "  - 設定チャンネルを作成しました。\n";
    }
    
    echo "\n✅ すべてのマイサーバーの処理が完了しました！\n";
    
} catch (Exception $e) {
    echo "❌ エラーが発生しました: " . $e->getMessage() . "\n";
    exit(1);
}
?>
