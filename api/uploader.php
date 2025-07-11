<?php
/**
 * ファイルアップローダー専用API
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
    handleUploaderUpload($pdo, $user);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'メソッドが許可されていません']);
}

function handleUploaderUpload($pdo, $user) {
    // ファイルとチャンネルIDの確認
    if (!isset($_FILES['file']) || !isset($_POST['channel_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ファイルとチャンネルIDが必要です']);
        return;
    }
    
    $file = $_FILES['file'];
    $channelId = $_POST['channel_id'];
    
    // チャンネルがアップローダーチャンネルかチェック
    $stmt = $pdo->prepare("
        SELECT c.*, g.owner_id, g.is_personal_server
        FROM channels c
        JOIN guilds g ON c.guild_id = g.id
        WHERE c.id = ? AND g.owner_id = ? AND g.is_personal_server = 1
        AND c.type IN ('uploader_public', 'uploader_private')
    ");
    $stmt->execute([$channelId, $user['id']]);
    $channel = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$channel) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'このチャンネルへのアップロード権限がありません']);
        return;
    }
    
    // ファイルのバリデーション
    $uploadResult = validateAndUploadUploaderFile($file, $channel['type'] === 'uploader_public');
    if (!$uploadResult['success']) {
        http_response_code(400);
        echo json_encode($uploadResult);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // メッセージタイプを決定
        $messageType = 'file';
        if (in_array($uploadResult['mime_type'], ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'])) {
            $messageType = 'image';
        }
        
        // メッセージを保存
        $stmt = $pdo->prepare("
            INSERT INTO messages (channel_id, user_id, content, type, file_url, file_name, file_size) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        
        $content = $_POST['content'] ?? "ファイルをアップロードしました";
        $stmt->execute([
            $channelId, 
            $user['id'], 
            $content,
            $messageType,
            $uploadResult['access_url'], 
            $uploadResult['original_filename'], 
            $uploadResult['file_size']
        ]);
        
        $messageId = $pdo->lastInsertId();
        
        // 公開ファイルの場合、public_filesテーブルに記録
        if ($channel['type'] === 'uploader_public') {
            $stmt = $pdo->prepare("
                INSERT INTO public_files (user_id, message_id, original_filename, public_filename, file_size, mime_type, access_url, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ");
            
            $stmt->execute([
                $user['id'],
                $messageId,
                $uploadResult['original_filename'],
                $uploadResult['public_filename'],
                $uploadResult['file_size'],
                $uploadResult['mime_type'],
                $uploadResult['access_url']
            ]);
        }
        
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
            'upload_info' => $uploadResult
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

function validateAndUploadUploaderFile($file, $isPublic) {
    // エラーチェック
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['success' => false, 'message' => 'ファイルアップロードエラーが発生しました'];
    }
    
    // ファイルサイズチェック（100MB制限）
    $maxSize = 100 * 1024 * 1024; // 100MB
    if ($file['size'] > $maxSize) {
        return ['success' => false, 'message' => 'ファイルサイズが大きすぎます（最大100MB）'];
    }
    
    // MIMEタイプチェック
    $allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
        'application/pdf', 'text/plain', 'text/csv',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip', 'application/x-zip-compressed',
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
        'audio/mp3', 'audio/wav', 'audio/aac'
    ];
    
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes)) {
        return ['success' => false, 'message' => 'サポートされていないファイルタイプです'];
    }
    
    // ファイル名を生成（衝突回避）
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $randomFilename = generateUniqueFilename($extension, $isPublic);
    
    // アップロードディレクトリの作成
    $uploadDir = $isPublic ? 
        __DIR__ . '/../uploads/public' :
        __DIR__ . '/../uploads/private/' . date('Y/m/d');
    
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $filePath = $uploadDir . '/' . $randomFilename;
    $accessUrl = $isPublic ? 
        "/f/{$randomFilename}" :
        "uploads/private/" . date('Y/m/d') . '/' . $randomFilename;
    
    // ファイルを移動
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        return ['success' => false, 'message' => 'ファイルの保存に失敗しました'];
    }
    
    return [
        'success' => true,
        'original_filename' => $file['name'],
        'public_filename' => $randomFilename,
        'file_path' => $filePath,
        'access_url' => $accessUrl,
        'file_size' => $file['size'],
        'mime_type' => $mimeType
    ];
}

function generateUniqueFilename($extension, $isPublic) {
    $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $length = 8;
    
    do {
        $filename = '';
        for ($i = 0; $i < $length; $i++) {
            $filename .= $characters[random_int(0, strlen($characters) - 1)];
        }
        $filename .= '.' . $extension;
        
        // ファイルの存在チェック
        $checkPath = $isPublic ? 
            __DIR__ . '/../uploads/public/' . $filename :
            __DIR__ . '/../uploads/private/' . date('Y/m/d') . '/' . $filename;
            
    } while (file_exists($checkPath));
    
    return $filename;
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
