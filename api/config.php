<?php
/**
 * LazyChillRoom 設定ファイル
 * データベース接続設定やアプリケーション共通設定を管理
 */

// データベース接続設定（環境変数から取得、デフォルト値を設定）
define('DB_HOST', $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: 'mysql');
define('DB_PORT', $_ENV['DB_PORT'] ?? getenv('DB_PORT') ?: 3306);
define('DB_NAME', $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: 'lazychillroom');
define('DB_USERNAME', $_ENV['DB_USER'] ?? getenv('DB_USER') ?: 'lazychillroom_user');
define('DB_PASSWORD', $_ENV['DB_PASSWORD'] ?? getenv('DB_PASSWORD') ?: 'lazychillroom_password');
define('DB_CHARSET', 'utf8mb4');

// アプリケーション設定
define('APP_NAME', 'LazyChillRoom');
define('APP_VERSION', '1.0.0');
define('API_VERSION', 'v1');

// セキュリティ設定
define('JWT_SECRET', 'your-jwt-secret-key-change-this-in-production');
define('SESSION_LIFETIME', 86400); // 24時間（秒）
define('PASSWORD_MIN_LENGTH', 6);

// ファイルアップロード設定
define('MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB
define('UPLOAD_DIR', '../uploads/');
define('ALLOWED_FILE_TYPES', ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'txt', 'doc', 'docx', 'mp4', 'mp3']);

// CORS設定
define('ALLOWED_ORIGINS', ['http://localhost:8080', 'http://127.0.0.1:8080']);

// エラーレポート設定（開発環境）
error_reporting(E_ALL);
ini_set('display_errors', 1);

/**
 * データベース接続を取得
 * @return PDO PDOインスタンス
 * @throws PDOException 接続エラー時
 */
function getDbConnection() {
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            $dsn = sprintf(
                "mysql:host=%s;port=%d;dbname=%s;charset=%s",
                DB_HOST,
                DB_PORT,
                DB_NAME,
                DB_CHARSET
            );
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET,
                PDO::ATTR_PERSISTENT => false,
                PDO::ATTR_EMULATE_PREPARES => false
            ];
            
            $pdo = new PDO($dsn, DB_USERNAME, DB_PASSWORD, $options);
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            throw new PDOException("データベース接続に失敗しました");
        }
    }
    
    return $pdo;
}

/**
 * APIレスポンスを標準形式で返す
 * @param bool $success 成功フラグ
 * @param mixed $data レスポンスデータ
 * @param string $message メッセージ
 * @param int $code HTTPステータスコード
 */
function sendApiResponse($success, $data = null, $message = '', $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    
    $response = [
        'success' => $success,
        'data' => $data,
        'message' => $message,
        'timestamp' => date('c')
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * エラーレスポンスを返す
 * @param string $message エラーメッセージ
 * @param int $code HTTPステータスコード
 * @param mixed $details エラー詳細
 */
function sendErrorResponse($message, $code = 400, $details = null) {
    $data = $details ? ['error_details' => $details] : null;
    sendApiResponse(false, $data, $message, $code);
}

/**
 * CORS ヘッダーを設定
 */
function setCorsHeaders() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    if (in_array($origin, ALLOWED_ORIGINS)) {
        header("Access-Control-Allow-Origin: $origin");
    }
    
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
    
    // OPTIONSリクエストの場合は早期終了
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

/**
 * リクエストボディのJSONを取得
 * @return array パースされたJSONデータ
 */
function getJsonInput() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendErrorResponse('Invalid JSON format', 400);
    }
    
    return $data ?? [];
}

/**
 * 必須パラメータの検証
 * @param array $data 検証するデータ
 * @param array $required 必須フィールド名の配列
 * @return bool 検証結果
 */
function validateRequiredFields($data, $required) {
    $missing = [];
    
    foreach ($required as $field) {
        if (!isset($data[$field]) || trim($data[$field]) === '') {
            $missing[] = $field;
        }
    }
    
    if (!empty($missing)) {
        sendErrorResponse('Missing required fields: ' . implode(', ', $missing), 400);
        return false;
    }
    
    return true;
}

/**
 * パスワードハッシュを生成
 * @param string $password プレーンテキストパスワード
 * @return string ハッシュ化されたパスワード
 */
function hashPassword($password) {
    return password_hash($password, PASSWORD_DEFAULT);
}

/**
 * パスワードを検証
 * @param string $password プレーンテキストパスワード
 * @param string $hash ハッシュ化されたパスワード
 * @return bool 検証結果
 */
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

/**
 * ランダムトークンを生成
 * @param int $length トークン長
 * @return string ランダムトークン
 */
function generateRandomToken($length = 32) {
    return bin2hex(random_bytes($length));
}

/**
 * 現在時刻をタイムスタンプとして取得
 * @return string ISO 8601 形式のタイムスタンプ
 */
function getCurrentTimestamp() {
    return date('Y-m-d H:i:s');
}

/**
 * ログを出力
 * @param string $message ログメッセージ
 * @param string $level ログレベル（INFO, ERROR, DEBUG等）
 */
function writeLog($message, $level = 'INFO') {
    $timestamp = date('Y-m-d H:i:s');
    $log = "[$timestamp] [$level] $message" . PHP_EOL;
    error_log($log, 3, '../logs/app.log');
}

// 初期化処理
setCorsHeaders();
?>