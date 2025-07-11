<?php
/**
 * メッセージ管理API
 */

require_once __DIR__ . '/config.php';

// CORS設定
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// OPTIONSリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 認証チェック
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '認証が必要です']);
    exit;
}

$token = substr($authHeader, 7);
$user = getUserFromToken($token);

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '無効なトークンです']);
    exit;
}

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGetMessages($pdo, $user);
            break;
        case 'POST':
            handleSendMessage($pdo, $user);
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'メソッドが許可されていません']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'サーバーエラーが発生しました']);
}

function handleGetMessages($pdo, $user) {
    $channelId = $_GET['channel_id'] ?? null;
    $limit = min(100, max(1, intval($_GET['limit'] ?? 50)));
    $before = $_GET['before'] ?? null;
    
    if (!$channelId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'チャンネルIDが必要です']);
        return;
    }
    
    // チャンネルへのアクセス権限をチェック
    if (!hasChannelAccess($pdo, $user['id'], $channelId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'このチャンネルへのアクセス権限がありません']);
        return;
    }
    
    // メッセージを取得
    $sql = "
        SELECT 
            m.id,
            m.content,
            m.type,
            m.file_url,
            m.file_name,
            m.file_size,
            m.created_at,
            m.edited_at,
            u.id as user_id,
            u.username,
            u.avatar_url
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.channel_id = ?
    ";
    
    $params = [$channelId];
    
    if ($before) {
        $sql .= " AND m.created_at < ?";
        $params[] = $before;
    }
    
    $sql .= " ORDER BY m.created_at DESC LIMIT ?";
    $params[] = $limit;
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 時系列順に並び替え
    $messages = array_reverse($messages);
    
    echo json_encode([
        'success' => true,
        'messages' => $messages
    ]);
}

function handleSendMessage($pdo, $user) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $channelId = $input['channel_id'] ?? null;
    $content = trim($input['content'] ?? '');
    $type = $input['type'] ?? 'text';
    
    if (!$channelId || !$content) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'チャンネルIDとメッセージ内容が必要です']);
        return;
    }
    
    // チャンネルへのアクセス権限をチェック
    if (!hasChannelAccess($pdo, $user['id'], $channelId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'このチャンネルへのアクセス権限がありません']);
        return;
    }
    
    // メッセージを保存
    $stmt = $pdo->prepare("
        INSERT INTO messages (channel_id, user_id, content, type) 
        VALUES (?, ?, ?, ?)
    ");
    
    $stmt->execute([$channelId, $user['id'], $content, $type]);
    $messageId = $pdo->lastInsertId();
    
    // 送信したメッセージを取得
    $stmt = $pdo->prepare("
        SELECT 
            m.id,
            m.content,
            m.type,
            m.file_url,
            m.file_name,
            m.file_size,
            m.created_at,
            m.edited_at,
            u.id as user_id,
            u.username,
            u.avatar_url
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
    ");
    
    $stmt->execute([$messageId]);
    $message = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => $message
    ]);
}

function hasChannelAccess($pdo, $userId, $channelId) {
    // チャンネル情報を取得
    $stmt = $pdo->prepare("
        SELECT c.*, g.id as guild_id 
        FROM channels c
        LEFT JOIN guilds g ON c.guild_id = g.id
        WHERE c.id = ?
    ");
    $stmt->execute([$channelId]);
    $channel = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$channel) {
        return false;
    }
    
    // DMチャンネルの場合
    if ($channel['type'] === 'dm' || $channel['type'] === 'group_dm') {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as count 
            FROM dm_participants 
            WHERE channel_id = ? AND user_id = ?
        ");
        $stmt->execute([$channelId, $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['count'] > 0;
    }
    
    // ギルドチャンネルの場合
    if ($channel['guild_id']) {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as count 
            FROM guild_members 
            WHERE guild_id = ? AND user_id = ?
        ");
        $stmt->execute([$channel['guild_id'], $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['count'] > 0;
    }
    
    return false;
}

function getUserFromToken($token) {
    $pdo = getDbConnection();
    
    $stmt = $pdo->prepare("
        SELECT u.* 
        FROM users u
        JOIN user_sessions s ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > NOW()
    ");
    
    $stmt->execute([$token]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}
?>
