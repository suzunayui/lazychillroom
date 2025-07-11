<?php
/**
 * 公開ファイルアクセスAPI
 * /f/{filename} で公開ファイルにアクセス
 */

// デバッグ用エラー表示を有効化
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

// デバッグ情報をログに記録
error_log("Public file access request: " . $_SERVER['REQUEST_URI']);

// パスからファイル名を取得
$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);

error_log("Parsed path: " . $path);

// /f/ で始まるパスをチェック（8桁の英数字ファイル名に対応）
if (!preg_match('/^\/f\/([0-9a-zA-Z]{8}\.[a-zA-Z0-9]+)$/', $path, $matches)) {
    error_log("Path does not match pattern: " . $path);
    http_response_code(404);
    echo json_encode(['error' => 'ファイルが見つかりません', 'path' => $path, 'uri' => $requestUri]);
    exit;
}

$filename = $matches[1];
error_log("Extracted filename: " . $filename);

try {
    $pdo = getDbConnection();
    
    // 公開ファイルかどうかをチェック
    $stmt = $pdo->prepare("
        SELECT pf.*, u.username 
        FROM public_files pf
        JOIN users u ON pf.user_id = u.id
        WHERE pf.public_filename = ? AND pf.is_active = 1
    ");
    $stmt->execute([$filename]);
    $file = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$file) {
        http_response_code(404);
        echo json_encode(['error' => 'ファイルが見つかりません']);
        exit;
    }
    
    // ファイルパスを構築
    $filePath = __DIR__ . '/../uploads/public/' . $file['public_filename'];
    
    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'ファイルが存在しません']);
        exit;
    }
    
    // ダウンロード数を増加
    $stmt = $pdo->prepare("
        UPDATE public_files 
        SET download_count = download_count + 1, last_accessed_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$file['id']]);
    
    // ファイルのMIMEタイプを取得
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $filePath);
    finfo_close($finfo);
    
    // ヘッダーを設定
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($filePath));
    header('Content-Disposition: inline; filename="' . $file['original_filename'] . '"');
    header('Cache-Control: public, max-age=3600');
    
    // ファイルを出力
    readfile($filePath);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
?>
