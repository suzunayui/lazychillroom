<?php
/**
 * チャンネル管理API
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
            handleGetChannels($pdo, $user);
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

function handleGetChannels($pdo, $user) {
    $guildId = $_GET['guild_id'] ?? null;
    $type = $_GET['type'] ?? null; // 'guild' or 'dm'
    
    if ($type === 'dm') {
        // DMチャンネルを取得
        $stmt = $pdo->prepare("
            SELECT 
                c.id,
                c.name,
                c.type,
                c.created_at,
                GROUP_CONCAT(
                    CONCAT(u.id, ':', u.username, ':', COALESCE(u.avatar_url, ''))
                    ORDER BY u.username
                    SEPARATOR ';'
                ) as participants
            FROM channels c
            JOIN dm_participants dp ON c.id = dp.channel_id
            JOIN users u ON dp.user_id = u.id
            WHERE c.type IN ('dm', 'group_dm')
            AND c.id IN (
                SELECT channel_id 
                FROM dm_participants 
                WHERE user_id = ?
            )
            GROUP BY c.id, c.name, c.type, c.created_at
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$user['id']]);
        $channels = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 参加者情報を整理
        foreach ($channels as &$channel) {
            $participants = [];
            if ($channel['participants']) {
                $parts = explode(';', $channel['participants']);
                foreach ($parts as $part) {
                    list($id, $username, $avatar) = explode(':', $part);
                    if ($id != $user['id']) { // 自分以外
                        $participants[] = [
                            'id' => $id,
                            'username' => $username,
                            'avatar_url' => $avatar ?: null
                        ];
                    }
                }
            }
            $channel['participants'] = $participants;
            
            // DM名を設定（相手の名前）
            if ($channel['type'] === 'dm' && count($participants) > 0) {
                $channel['display_name'] = $participants[0]['username'];
            } else {
                $channel['display_name'] = $channel['name'] ?: 'グループDM';
            }
        }
        
        echo json_encode([
            'success' => true,
            'channels' => $channels
        ]);
    } else {
        // ギルドチャンネルを取得
        if (!$guildId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ギルドIDが必要です']);
            return;
        }
        
        // ギルドメンバーかチェック
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as count 
            FROM guild_members 
            WHERE guild_id = ? AND user_id = ?
        ");
        $stmt->execute([$guildId, $user['id']]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result['count'] == 0) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'このギルドのメンバーではありません']);
            return;
        }
        
        // チャンネルとカテゴリを取得
        $stmt = $pdo->prepare("
            SELECT 
                c.id,
                c.name,
                c.type,
                c.topic,
                c.position,
                c.nsfw,
                cc.id as category_id,
                cc.name as category_name,
                cc.position as category_position
            FROM channels c
            LEFT JOIN channel_categories cc ON c.category_id = cc.id
            WHERE c.guild_id = ?
            ORDER BY 
                COALESCE(cc.position, 999),
                c.position
        ");
        $stmt->execute([$guildId]);
        $channels = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'channels' => $channels
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
