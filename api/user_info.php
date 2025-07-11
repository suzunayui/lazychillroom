<?php
/**
 * ユーザー情報取得API
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once __DIR__ . '/config.php';

// OPTIONS リクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// GET リクエストのみ許可
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    // セッション確認
    session_start();
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'ログインが必要です']);
        exit;
    }

    $user_id = $_SESSION['user_id'];

    // データベース接続
    $pdo = getDbConnection();

    // ユーザー情報を取得
    $stmt = $pdo->prepare("
        SELECT 
            id,
            username,
            display_name,
            email,
            avatar_url,
            status,
            created_at,
            updated_at
        FROM users 
        WHERE id = ?
    ");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'ユーザーが見つかりません']);
        exit;
    }

    // パスワードやセンシティブな情報は除外
    unset($user['password_hash']);

    echo json_encode([
        'success' => true,
        'user' => $user
    ]);

} catch (Exception $e) {
    error_log("User info error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
?>
