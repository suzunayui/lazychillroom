<?php
/**
 * 既存のマイサーバーの設定チャンネルタイプを更新するスクリプト
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();
    echo "データベースに接続しました。\n";
    
    // 既存のマイサーバーの設定チャンネルを取得
    $stmt = $pdo->query("
        SELECT c.id, c.name, g.name as guild_name
        FROM channels c
        JOIN guilds g ON c.guild_id = g.id
        WHERE g.is_personal_server = 1 
        AND c.name = '設定' 
        AND c.type = 'text'
    ");
    $settingsChannels = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($settingsChannels)) {
        echo "更新対象の設定チャンネルは見つかりませんでした。\n";
        exit(0);
    }
    
    echo "見つかった設定チャンネル: " . count($settingsChannels) . "個\n";
    
    foreach ($settingsChannels as $channel) {
        echo "マイサーバー '{$channel['guild_name']}' の設定チャンネル (ID: {$channel['id']}) を更新中...\n";
        
        // チャンネルタイプを settings に更新
        $stmt = $pdo->prepare("
            UPDATE channels 
            SET type = 'settings', updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$channel['id']]);
        
        echo "  - 設定チャンネルタイプを 'settings' に更新しました。\n";
    }
    
    echo "\n✅ すべての設定チャンネルの更新が完了しました！\n";
    
} catch (Exception $e) {
    echo "❌ エラーが発生しました: " . $e->getMessage() . "\n";
    exit(1);
}
?>
