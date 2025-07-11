<?php
/**
 * チャンネル管理API
 * チャンネルの作成、編集、削除機能を提供
 */

require_once __DIR__ . '/config.php';

// CORS対応
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// プリフライトリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $pdo = getDbConnection();
    
    // 認証トークンの確認
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => '認証が必要です']);
        exit;
    }
    
    $token = $matches[1];
    
    // トークンからユーザー情報を取得
    $stmt = $pdo->prepare("
        SELECT u.id, u.username, u.email 
        FROM users u
        JOIN user_sessions us ON u.id = us.user_id
        WHERE us.token = ? AND us.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => '無効なトークンです']);
        exit;
    }
    
    $method = $_SERVER['REQUEST_METHOD'];
    $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $basePath = '/api/manage_channels.php';
    
    switch ($method) {
        case 'POST':
            handleCreateChannel($pdo, $user);
            break;
            
        case 'PUT':
            handleUpdateChannel($pdo, $user);
            break;
            
        case 'DELETE':
            handleDeleteChannel($pdo, $user);
            break;
            
        case 'GET':
            handleGetChannels($pdo, $user);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'サポートされていないメソッドです']);
    }
    
} catch (Exception $e) {
    error_log("Channel management error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'サーバーエラーが発生しました']);
}

/**
 * チャンネル作成処理
 */
function handleCreateChannel($pdo, $user) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $guildId = $input['guild_id'] ?? null;
    $categoryId = $input['category_id'] ?? null;
    $name = trim($input['name'] ?? '');
    $topic = trim($input['topic'] ?? '');
    $type = $input['type'] ?? 'text';
    
    // バリデーション
    if (!$guildId || !$name) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ギルドIDとチャンネル名は必須です']);
        return;
    }
    
    if (strlen($name) > 100) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'チャンネル名は100文字以内で入力してください']);
        return;
    }
    
    // チャンネル名の形式チェック（英数字、ハイフン、アンダースコア、日本語）
    if (!preg_match('/^[\w\-ぁ-んァ-ヶ一-龯]+$/u', $name)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'チャンネル名に使用できない文字が含まれています']);
        return;
    }
    
    // ギルドの存在確認とメンバーシップ確認
    $stmt = $pdo->prepare("
        SELECT g.id, g.name, g.owner_id,
               gm.user_id as is_member,
               mr.role_id
        FROM guilds g
        LEFT JOIN guild_members gm ON g.id = gm.guild_id AND gm.user_id = ?
        LEFT JOIN member_roles mr ON g.id = mr.guild_id AND mr.user_id = ? 
        LEFT JOIN roles r ON mr.role_id = r.id
        WHERE g.id = ?
    ");
    $stmt->execute([$user['id'], $user['id'], $guildId]);
    $guildInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$guildInfo || !$guildInfo['is_member']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'このギルドのメンバーではありません']);
        return;
    }
    
    // 管理者権限のチェック（ギルドオーナーまたはAdminロール）
    $isOwner = ($guildInfo['owner_id'] == $user['id']);
    
    $stmt = $pdo->prepare("
        SELECT r.name, r.permissions
        FROM member_roles mr
        JOIN roles r ON mr.role_id = r.id
        WHERE mr.guild_id = ? AND mr.user_id = ?
    ");
    $stmt->execute([$guildId, $user['id']]);
    $userRoles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $hasAdminPermission = $isOwner;
    foreach ($userRoles as $role) {
        if ($role['name'] === 'Admin' || $role['name'] === 'Moderator') {
            $hasAdminPermission = true;
            break;
        }
    }
    
    if (!$hasAdminPermission) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'チャンネルを作成する権限がありません']);
        return;
    }
    
    // 同名チャンネルの存在確認
    $stmt = $pdo->prepare("
        SELECT id FROM channels 
        WHERE guild_id = ? AND name = ? AND type = ?
    ");
    $stmt->execute([$guildId, $name, $type]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => '同じ名前のチャンネルが既に存在します']);
        return;
    }
    
    // カテゴリの存在確認（指定されている場合）
    if ($categoryId) {
        $stmt = $pdo->prepare("
            SELECT id FROM channel_categories 
            WHERE id = ? AND guild_id = ?
        ");
        $stmt->execute([$categoryId, $guildId]);
        if (!$stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '指定されたカテゴリが見つかりません']);
            return;
        }
    }
    
    // 新しいポジションを決定
    $stmt = $pdo->prepare("
        SELECT COALESCE(MAX(position), -1) + 1 as next_position
        FROM channels 
        WHERE guild_id = ? AND category_id " . ($categoryId ? "= ?" : "IS NULL") . " AND type = ?"
    );
    $params = [$guildId];
    if ($categoryId) {
        $params[] = $categoryId;
    }
    $params[] = $type;
    $stmt->execute($params);
    $position = $stmt->fetchColumn();
    
    // チャンネルを作成
    $stmt = $pdo->prepare("
        INSERT INTO channels (guild_id, category_id, name, type, topic, position, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$guildId, $categoryId, $name, $type, $topic, $position]);
    
    $channelId = $pdo->lastInsertId();
    
    // 作成されたチャンネル情報を取得
    $stmt = $pdo->prepare("
        SELECT c.*, cc.name as category_name
        FROM channels c
        LEFT JOIN channel_categories cc ON c.category_id = cc.id
        WHERE c.id = ?
    ");
    $stmt->execute([$channelId]);
    $channel = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // 監査ログに記録
    $stmt = $pdo->prepare("
        INSERT INTO audit_logs (guild_id, user_id, target_id, action_type, reason, changes)
        VALUES (?, ?, ?, 'channel_create', ?, ?)
    ");
    $changes = json_encode([
        'name' => $name,
        'type' => $type,
        'topic' => $topic,
        'category_id' => $categoryId
    ]);
    $stmt->execute([$guildId, $user['id'], $channelId, "チャンネル「{$name}」を作成", $changes]);
    
    echo json_encode([
        'success' => true,
        'message' => 'チャンネルが正常に作成されました',
        'channel' => $channel
    ]);
}

/**
 * チャンネル更新処理
 */
function handleUpdateChannel($pdo, $user) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $channelId = $input['channel_id'] ?? null;
    $name = trim($input['name'] ?? '');
    $topic = trim($input['topic'] ?? '');
    
    if (!$channelId || !$name) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'チャンネルIDと名前は必須です']);
        return;
    }
    
    // チャンネルの存在確認と権限チェック
    $stmt = $pdo->prepare("
        SELECT c.*, g.owner_id
        FROM channels c
        JOIN guilds g ON c.guild_id = g.id
        JOIN guild_members gm ON g.id = gm.guild_id AND gm.user_id = ?
        WHERE c.id = ?
    ");
    $stmt->execute([$user['id'], $channelId]);
    $channel = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$channel) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'チャンネルが見つからないか、権限がありません']);
        return;
    }
    
    // 権限チェック（簡略化）
    $isOwner = ($channel['owner_id'] == $user['id']);
    
    if (!$isOwner) {
        // 管理者ロールチェックは省略（実装可能）
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'チャンネルを編集する権限がありません']);
        return;
    }
    
    // チャンネルを更新
    $stmt = $pdo->prepare("
        UPDATE channels 
        SET name = ?, topic = ?, updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$name, $topic, $channelId]);
    
    echo json_encode([
        'success' => true,
        'message' => 'チャンネルが正常に更新されました'
    ]);
}

/**
 * チャンネル削除処理
 */
function handleDeleteChannel($pdo, $user) {
    $input = json_decode(file_get_contents('php://input'), true);
    $channelId = $input['channel_id'] ?? null;
    
    if (!$channelId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'チャンネルIDが必要です']);
        return;
    }
    
    // チャンネルの存在確認と権限チェック
    $stmt = $pdo->prepare("
        SELECT c.*, g.owner_id
        FROM channels c
        JOIN guilds g ON c.guild_id = g.id
        JOIN guild_members gm ON g.id = gm.guild_id AND gm.user_id = ?
        WHERE c.id = ?
    ");
    $stmt->execute([$user['id'], $channelId]);
    $channel = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$channel) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'チャンネルが見つからないか、権限がありません']);
        return;
    }
    
    // 権限チェック
    $isOwner = ($channel['owner_id'] == $user['id']);
    
    if (!$isOwner) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'チャンネルを削除する権限がありません']);
        return;
    }
    
    // チャンネルを削除（CASCADE設定により関連データも削除される）
    $stmt = $pdo->prepare("DELETE FROM channels WHERE id = ?");
    $stmt->execute([$channelId]);
    
    echo json_encode([
        'success' => true,
        'message' => 'チャンネルが正常に削除されました'
    ]);
}

/**
 * チャンネル一覧取得処理
 */
function handleGetChannels($pdo, $user) {
    $guildId = $_GET['guild_id'] ?? null;
    
    if (!$guildId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ギルドIDが必要です']);
        return;
    }
    
    // ギルドメンバーシップ確認
    $stmt = $pdo->prepare("
        SELECT 1 FROM guild_members 
        WHERE guild_id = ? AND user_id = ?
    ");
    $stmt->execute([$guildId, $user['id']]);
    if (!$stmt->fetch()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'このギルドのメンバーではありません']);
        return;
    }
    
    // チャンネル一覧を取得
    $stmt = $pdo->prepare("
        SELECT c.*, cc.name as category_name
        FROM channels c
        LEFT JOIN channel_categories cc ON c.category_id = cc.id
        WHERE c.guild_id = ?
        ORDER BY c.category_id, c.position, c.created_at
    ");
    $stmt->execute([$guildId]);
    $channels = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'channels' => $channels
    ]);
}
?>
