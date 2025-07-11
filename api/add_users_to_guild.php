<?php
/**
 * ユーザーをデフォルトギルドに自動参加させるスクリプト
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();
    
    // 現在ログインしている全ユーザーを取得
    $stmt = $pdo->prepare("
        SELECT DISTINCT u.id, u.username 
        FROM users u 
        JOIN user_sessions us ON u.id = us.user_id 
        WHERE us.expires_at > NOW() 
        AND u.id NOT IN (
            SELECT user_id 
            FROM guild_members 
            WHERE guild_id = 1
        )
    ");
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($users as $user) {
        // ユーザーをデフォルトギルド（ID=1）のメンバーに追加
        $stmt = $pdo->prepare("
            INSERT IGNORE INTO guild_members (guild_id, user_id) 
            VALUES (1, ?)
        ");
        $stmt->execute([$user['id']]);
        
        // @everyoneロールを付与
        $stmt = $pdo->prepare("
            INSERT IGNORE INTO member_roles (guild_id, user_id, role_id) 
            VALUES (1, ?, 1)
        ");
        $stmt->execute([$user['id']]);
        
        echo "✓ ユーザー {$user['username']} (ID: {$user['id']}) をデフォルトギルドに追加しました\n";
    }
    
    if (empty($users)) {
        echo "追加するユーザーが見つかりませんでした\n";
    }
    
    echo "完了しました\n";
    
} catch (Exception $e) {
    echo "エラー: " . $e->getMessage() . "\n";
}
?>
