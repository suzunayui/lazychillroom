<?php
/**
 * マイサーバー管理API
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

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        handleGetMyServer($pdo, $user);
        break;
    case 'POST':
        handleCreateMyServer($pdo, $user);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'メソッドが許可されていません']);
}

function handleGetMyServer($pdo, $user) {
    try {
        // ユーザーのマイサーバーを取得
        $stmt = $pdo->prepare("
            SELECT g.*, 
                   (SELECT COUNT(*) FROM guild_members gm WHERE gm.guild_id = g.id) as member_count
            FROM guilds g 
            WHERE g.owner_id = ? AND g.is_personal_server = 1
        ");
        $stmt->execute([$user['id']]);
        $myServer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($myServer) {
            // チャンネルとカテゴリを取得
            $stmt = $pdo->prepare("
                SELECT c.*, cc.name as category_name, cc.position as category_position
                FROM channels c
                LEFT JOIN channel_categories cc ON c.category_id = cc.id
                WHERE c.guild_id = ?
                ORDER BY cc.position, c.position
            ");
            $stmt->execute([$myServer['id']]);
            $channels = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $myServer['channels'] = $channels;
        }
        
        echo json_encode([
            'success' => true,
            'server' => $myServer
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'サーバー情報の取得に失敗しました']);
    }
}

function handleCreateMyServer($pdo, $user) {
    try {
        // 既にマイサーバーが存在するかチェック
        $stmt = $pdo->prepare("
            SELECT id FROM guilds 
            WHERE owner_id = ? AND is_personal_server = 1
        ");
        $stmt->execute([$user['id']]);
        
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => 'マイサーバーは既に存在します']);
            return;
        }
        
        $pdo->beginTransaction();
        
        // マイサーバーを作成
        $stmt = $pdo->prepare("
            INSERT INTO guilds (name, owner_id, icon_url, is_personal_server, created_at) 
            VALUES (?, ?, NULL, 1, NOW())
        ");
        $stmt->execute(["{$user['username']}のサーバー", $user['id']]);
        $guildId = $pdo->lastInsertId();
        
        // ギルドメンバーとして追加
        $stmt = $pdo->prepare("
            INSERT INTO guild_members (guild_id, user_id, joined_at) 
            VALUES (?, ?, NOW())
        ");
        $stmt->execute([$guildId, $user['id']]);
        
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
            VALUES (?, ?, '公開', 'uploader_public', 0, '公開ファイルアップローダー')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        // 非公開チャンネルを作成
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '非公開', 'uploader_private', 1, '非公開ファイルアップローダー')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        // 設定チャンネルを作成
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '設定', 'settings', 2, 'プロフィール設定やアカウント管理')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'マイサーバーを作成しました',
            'guild_id' => $guildId
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'マイサーバーの作成に失敗しました']);
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
