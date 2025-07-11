<?php
/**
 * ユーザーアバター画像アップロードAPI
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once __DIR__ . '/config.php';

// OPTIONS リクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// POST リクエストのみ許可
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    // 認証チェック（Bearer トークン優先、セッションも対応）
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    $user_id = null;
    
    if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
        // Bearer トークン認証
        $token = substr($authHeader, 7);
        $user = getUserFromToken($token);
        if ($user) {
            $user_id = $user['id'];
        }
    } else {
        // セッション認証（既存機能の維持）
        session_start();
        if (isset($_SESSION['user_id'])) {
            $user_id = $_SESSION['user_id'];
        }
    }
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'ログインが必要です']);
        exit;
    }

    // ファイルのアップロード確認
    if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'ファイルのアップロードに失敗しました']);
        exit;
    }

    $file = $_FILES['avatar'];
    
    // ファイルサイズ制限（5MB）
    $maxSize = 5 * 1024 * 1024; // 5MB
    if ($file['size'] > $maxSize) {
        http_response_code(400);
        echo json_encode(['error' => 'ファイルサイズが大きすぎます（最大5MB）']);
        exit;
    }

    // ファイル形式チェック
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedTypes)) {
        http_response_code(400);
        echo json_encode(['error' => '対応していないファイル形式です（JPEG, PNG, GIF, WebPのみ）']);
        exit;
    }

    // ファイル拡張子を取得
    $extension = match($mimeType) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        default => 'jpg'
    };

    // アップロードディレクトリの作成
    $uploadDir = __DIR__ . '/../uploads/avatars/' . date('Y/m/');
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // ファイル名生成（ユーザーIDとタイムスタンプを使用）
    $filename = 'avatar_' . $user_id . '_' . time() . '.' . $extension;
    $filepath = $uploadDir . $filename;
    $publicPath = '/uploads/avatars/' . date('Y/m/') . $filename;

    // ファイルを保存
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        http_response_code(500);
        echo json_encode(['error' => 'ファイルの保存に失敗しました']);
        exit;
    }

    // データベース接続
    $pdo = getDbConnection();

    // 古いアバター画像のパスを取得
    $stmt = $pdo->prepare("SELECT avatar_url FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $oldAvatar = $stmt->fetchColumn();

    // ユーザーのアバターURLを更新
    $stmt = $pdo->prepare("UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$publicPath, $user_id]);

    // 古いアバター画像を削除（デフォルト画像でない場合）
    if ($oldAvatar && $oldAvatar !== '/uploads/avatars/default.png') {
        $oldFilePath = __DIR__ . '/..' . $oldAvatar;
        if (file_exists($oldFilePath)) {
            unlink($oldFilePath);
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'アバター画像を更新しました',
        'avatar_url' => $publicPath
    ]);

} catch (Exception $e) {
    error_log("Avatar upload error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
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
