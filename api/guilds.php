<?php
/**
 * ギルド管理API
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
            handleGetGuilds($pdo, $user);
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

function handleGetGuilds($pdo, $user) {
    $guildId = $_GET['guild_id'] ?? null;
    
    if ($guildId) {
        // 特定のギルドの詳細情報を取得
        $stmt = $pdo->prepare("
            SELECT 
                g.id,
                g.name,
                g.description,
                g.icon_url,
                g.banner_url,
                g.member_count,
                g.owner_id,
                g.created_at
            FROM guilds g
            JOIN guild_members gm ON g.id = gm.guild_id
            WHERE g.id = ? AND gm.user_id = ?
        ");
        $stmt->execute([$guildId, $user['id']]);
        $guild = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$guild) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'ギルドが見つかりません']);
            return;
        }
        
        // ギルドメンバーを取得
        $stmt = $pdo->prepare("
            SELECT 
                u.id,
                u.username,
                u.avatar_url,
                gm.nickname,
                gm.joined_at,
                gmp.status,
                gmp.last_seen
            FROM guild_members gm
            JOIN users u ON gm.user_id = u.id
            LEFT JOIN guild_member_presence gmp ON gm.guild_id = gmp.guild_id AND gm.user_id = gmp.user_id
            WHERE gm.guild_id = ?
            ORDER BY 
                CASE gmp.status 
                    WHEN 'online' THEN 1
                    WHEN 'away' THEN 2
                    WHEN 'busy' THEN 3
                    ELSE 4
                END,
                u.username
        ");
        $stmt->execute([$guildId]);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $guild['members'] = $members;
        
        echo json_encode([
            'success' => true,
            'guild' => $guild
        ]);
    } else {
        // ユーザーが参加しているギルド一覧を取得
        $stmt = $pdo->prepare("
            SELECT 
                g.id,
                g.name,
                g.description,
                g.icon_url,
                g.member_count,
                g.owner_id,
                gm.joined_at
            FROM guilds g
            JOIN guild_members gm ON g.id = gm.guild_id
            WHERE gm.user_id = ?
            ORDER BY gm.joined_at DESC
        ");
        $stmt->execute([$user['id']]);
        $guilds = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'guilds' => $guilds
        ]);
    }
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
