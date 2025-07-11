<?php
/**
 * ファイルアップロードAPI
 */

require_once __DIR__ . '/config.php';

// CORS設定
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    handleFileUpload($pdo, $user);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'メソッドが許可されていません']);
}

function handleFileUpload($pdo, $user) {
    // ファイルとチャンネルIDの確認
    if (!isset($_FILES['file']) || !isset($_POST['channel_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ファイルとチャンネルIDが必要です']);
        return;
    }
    
    $file = $_FILES['file'];
    $channelId = $_POST['channel_id'];
    $content = $_POST['content'] ?? '';
    
    // チャンネルへのアクセス権限をチェック
    if (!hasChannelAccess($pdo, $user['id'], $channelId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'このチャンネルへのアクセス権限がありません']);
        return;
    }
    
    // ファイルのバリデーション
    $uploadResult = validateAndUploadFile($file);
    if (!$uploadResult['success']) {
        http_response_code(400);
        echo json_encode($uploadResult);
        return;
    }
    
    // メッセージタイプを決定
    $messageType = 'file';
    if (in_array($uploadResult['mime_type'], ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'])) {
        $messageType = 'image';
    }
    
    try {
        // トランザクション開始
        $pdo->beginTransaction();
        
        // メッセージを保存
        $stmt = $pdo->prepare("
            INSERT INTO messages (channel_id, user_id, content, type, file_url, file_name, file_size) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $channelId, 
            $user['id'], 
            $content, 
            $messageType, 
            $uploadResult['file_url'], 
            $uploadResult['file_name'], 
            $uploadResult['file_size']
        ]);
        
        $messageId = $pdo->lastInsertId();
        
        // ファイル添付情報を保存
        $stmt = $pdo->prepare("
            INSERT INTO file_attachments (message_id, file_name, file_size, file_url, mime_type, width, height) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $messageId,
            $uploadResult['file_name'],
            $uploadResult['file_size'],
            $uploadResult['file_url'],
            $uploadResult['mime_type'],
            $uploadResult['width'],
            $uploadResult['height']
        ]);
        
        // トランザクション完了
        $pdo->commit();
        
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
            'message' => $message,
            'file_info' => $uploadResult
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        
        // アップロードしたファイルを削除
        if (file_exists($uploadResult['file_path'])) {
            unlink($uploadResult['file_path']);
        }
        
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'ファイルアップロードに失敗しました']);
    }
}

function validateAndUploadFile($file) {
    // エラーチェック
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['success' => false, 'message' => 'ファイルアップロードエラーが発生しました'];
    }
    
    // ファイルサイズチェック（10MB制限）
    $maxSize = 10 * 1024 * 1024; // 10MB
    if ($file['size'] > $maxSize) {
        return ['success' => false, 'message' => 'ファイルサイズが大きすぎます（最大10MB）'];
    }
    
    // MIMEタイプチェック
    $allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes)) {
        return ['success' => false, 'message' => 'サポートされていないファイルタイプです'];
    }
    
    // アップロードディレクトリの作成
    $uploadDir = __DIR__ . '/../uploads/' . date('Y/m/d');
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // ファイル名の生成（重複を避けるため）
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $fileName = uniqid() . '_' . time() . '.' . $extension;
    $filePath = $uploadDir . '/' . $fileName;
    $fileUrl = 'uploads/' . date('Y/m/d') . '/' . $fileName;
    
    // ファイルを移動
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        return ['success' => false, 'message' => 'ファイルの保存に失敗しました'];
    }
    
    // 画像の場合、サイズを取得
    $width = null;
    $height = null;
    if (in_array($mimeType, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'])) {
        $imageInfo = getimagesize($filePath);
        if ($imageInfo) {
            $width = $imageInfo[0];
            $height = $imageInfo[1];
        }
    }
    
    return [
        'success' => true,
        'file_name' => $file['name'],
        'file_path' => $filePath,
        'file_url' => $fileUrl,
        'file_size' => $file['size'],
        'mime_type' => $mimeType,
        'width' => $width,
        'height' => $height
    ];
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
