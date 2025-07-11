<?php
// デバッグ用エラー表示を有効化
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'config.php';

// データベース接続を取得
$pdo = getDbConnection();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin($input);
        break;
    case 'register':
        handleRegister($input);
        break;
    case 'check':
    case 'verify':  // 互換性のため
        handleAuthCheck();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        break;
}

function handleLogin($input) {
    global $pdo;
    
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'メールアドレスとパスワードを入力してください']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT id, username, email, password_hash, status FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'メールアドレスまたはパスワードが間違っています']);
            return;
        }
        
        // セッション開始
        session_start();
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['email'] = $user['email'];
        
        // ユーザーセッションを記録
        $sessionToken = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + 86400); // 24時間後
        
        $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$user['id'], $sessionToken, $expiresAt]);
        
        // ユーザーがデフォルトギルド（ID=1）のメンバーでない場合は自動参加させる
        try {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM guild_members WHERE guild_id = 1 AND user_id = ?");
            $stmt->execute([$user['id']]);
            $isMember = $stmt->fetchColumn() > 0;
            
            if (!$isMember) {
                // ギルドメンバーとして追加
                $stmt = $pdo->prepare("INSERT IGNORE INTO guild_members (guild_id, user_id) VALUES (1, ?)");
                $stmt->execute([$user['id']]);
                
                // @everyoneロール（ID=1）を付与
                $stmt = $pdo->prepare("INSERT IGNORE INTO member_roles (guild_id, user_id, role_id) VALUES (1, ?, 1)");
                $stmt->execute([$user['id']]);
                
                // ユーザープレゼンスを追加
                $stmt = $pdo->prepare("INSERT IGNORE INTO user_presence (user_id, status) VALUES (?, 'online')");
                $stmt->execute([$user['id']]);
                
                // ギルドメンバープレゼンスを追加
                $stmt = $pdo->prepare("INSERT IGNORE INTO guild_member_presence (guild_id, user_id, status) VALUES (1, ?, 'online')");
                $stmt->execute([$user['id']]);
                
                // ユーザー設定を追加
                $stmt = $pdo->prepare("INSERT IGNORE INTO user_settings (user_id) VALUES (?)");
                $stmt->execute([$user['id']]);
                
                // 通知設定を追加
                $stmt = $pdo->prepare("INSERT IGNORE INTO notification_settings (user_id, guild_id, notification_type) VALUES (?, 1, 'all')");
                $stmt->execute([$user['id']]);
            }
        } catch (PDOException $e) {
            // ギルド参加エラーはログに記録するが、ログインは成功とする
            error_log("Guild auto-join error for user {$user['id']}: " . $e->getMessage());
        }
        
        echo json_encode([
            'success' => true,
            'token' => $sessionToken,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'status' => $user['status']
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'データベースエラーが発生しました']);
        error_log("Login error: " . $e->getMessage());
    }
}

function handleRegister($input) {
    global $pdo;
    
    $username = trim($input['username'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    
    if (empty($username) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '全ての項目を入力してください']);
        return;
    }
    
    // バリデーション
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '正しいメールアドレスを入力してください']);
        return;
    }
    
    if (strlen($username) < 2 || strlen($username) > 50) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ユーザー名は2文字以上50文字以下で入力してください']);
        return;
    }
    
    if (strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'パスワードは6文字以上で入力してください']);
        return;
    }
    
    try {
        // 重複チェック
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = ? OR username = ?");
        $stmt->execute([$email, $username]);
        $count = $stmt->fetchColumn();
        
        if ($count > 0) {
            // より詳細なエラーメッセージ
            $stmt = $pdo->prepare("SELECT email, username FROM users WHERE email = ? OR username = ?");
            $stmt->execute([$email, $username]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existing['email'] === $email) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'このメールアドレスは既に使用されています']);
            } else {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'このユーザー名は既に使用されています']);
            }
            return;
        }
        
        // ユーザー作成
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash, status) VALUES (?, ?, ?, 'online')");
        $stmt->execute([$username, $email, $passwordHash]);
        
        $userId = $pdo->lastInsertId();
        
        // セッション開始
        session_start();
        $_SESSION['user_id'] = $userId;
        $_SESSION['username'] = $username;
        $_SESSION['email'] = $email;
        
        // ユーザーセッションを記録
        $sessionToken = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + 86400); // 24時間後
        
        $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $sessionToken, $expiresAt]);
        
        // 新規ユーザーをデフォルトギルド（ID=1）に自動参加させる
        try {
            // ギルドメンバーとして追加
            $stmt = $pdo->prepare("INSERT IGNORE INTO guild_members (guild_id, user_id) VALUES (1, ?)");
            $stmt->execute([$userId]);
            
            // @everyoneロール（ID=1）を付与
            $stmt = $pdo->prepare("INSERT IGNORE INTO member_roles (guild_id, user_id, role_id) VALUES (1, ?, 1)");
            $stmt->execute([$userId]);
            
            // ユーザープレゼンスを追加
            $stmt = $pdo->prepare("INSERT IGNORE INTO user_presence (user_id, status) VALUES (?, 'online')");
            $stmt->execute([$userId]);
            
            // ギルドメンバープレゼンスを追加
            $stmt = $pdo->prepare("INSERT IGNORE INTO guild_member_presence (guild_id, user_id, status) VALUES (1, ?, 'online')");
            $stmt->execute([$userId]);
            
            // ユーザー設定を追加
            $stmt = $pdo->prepare("INSERT IGNORE INTO user_settings (user_id) VALUES (?)");
            $stmt->execute([$userId]);
            
            // 通知設定を追加
            $stmt = $pdo->prepare("INSERT IGNORE INTO notification_settings (user_id, guild_id, notification_type) VALUES (?, 1, 'all')");
            $stmt->execute([$userId]);
            
        } catch (PDOException $e) {
            // ギルド参加エラーはログに記録するが、登録は成功とする
            error_log("Guild auto-join error for user $userId: " . $e->getMessage());
        }
        
        // マイサーバーを自動作成
        try {
            $personalGuildId = createUserPersonalServer($pdo, $userId, $username);
            error_log("Personal server created for user $userId: Guild ID $personalGuildId");
        } catch (Exception $e) {
            error_log("Personal server creation error for user $userId: " . $e->getMessage());
            // マイサーバー作成失敗はログに記録するが、登録は成功とする
        }
        
        echo json_encode([
            'success' => true,
            'token' => $sessionToken,
            'user' => [
                'id' => $userId,
                'username' => $username,
                'email' => $email,
                'status' => 'online'
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'アカウント作成中にエラーが発生しました']);
        error_log("Register error: " . $e->getMessage());
    }
}

function handleAuthCheck() {
    global $pdo;
    
    try {
        $userId = null;
        
        // Authorizationヘッダーからトークンを取得
        $authHeader = null;
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $authHeader = $headers['Authorization'] ?? null;
        } else {
            // apache_request_headers が使えない場合の代替手段
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
        }
        
        if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
            
            // トークンからユーザーIDを取得
            $stmt = $pdo->prepare("SELECT user_id FROM user_sessions WHERE token = ? AND expires_at > NOW()");
            $stmt->execute([$token]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($session) {
                $userId = $session['user_id'];
            }
        }
        
        // トークンで認証できなかった場合はセッションをチェック
        if (!$userId) {
            session_start();
            if (isset($_SESSION['user_id'])) {
                $userId = $_SESSION['user_id'];
            }
        }
        
        if (!$userId) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => '認証が必要です']);
            return;
        }
        
        // ユーザー情報を取得
        $stmt = $pdo->prepare("SELECT id, username, email, status FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            if (isset($_SESSION['user_id'])) {
                session_destroy();
            }
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'ユーザーが見つかりません']);
            return;
        }
        
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'status' => $user['status']
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'データベースエラーが発生しました']);
        error_log("Auth check error: " . $e->getMessage());
    }
}

// マイサーバーを作成する関数
function createUserPersonalServer($pdo, $userId, $username) {
    try {
        // マイサーバーを作成
        $stmt = $pdo->prepare("
            INSERT INTO guilds (name, owner_id, icon_url, is_personal_server, created_at) 
            VALUES (?, ?, NULL, 1, NOW())
        ");
        $stmt->execute(["{$username}のサーバー", $userId]);
        $guildId = $pdo->lastInsertId();
        
        // ギルドメンバーとして追加
        $stmt = $pdo->prepare("
            INSERT INTO guild_members (guild_id, user_id, joined_at) 
            VALUES (?, ?, NOW())
        ");
        $stmt->execute([$guildId, $userId]);
        
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
            VALUES (?, ?, '公開', 'uploader_public', 0, '公開ファイルアップローダー - アップロードしたファイルはインターネット上で公開されます')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        // 非公開チャンネルを作成
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '非公開', 'uploader_private', 1, '非公開ファイルアップローダー - アップロードしたファイルはあなただけがアクセスできます')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        // 設定チャンネルを作成（非公開チャンネルの下）
        $stmt = $pdo->prepare("
            INSERT INTO channels (guild_id, category_id, name, type, position, topic) 
            VALUES (?, ?, '設定', 'text', 2, 'プロフィール設定やアカウント管理')
        ");
        $stmt->execute([$guildId, $categoryId]);
        
        return $guildId;
        
    } catch (Exception $e) {
        error_log("Personal server creation error: " . $e->getMessage());
        throw $e;
    }
}
?>
