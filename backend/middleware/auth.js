const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// JWT token verification middleware
async function authenticateToken(req, res, next) {
  console.log('🔐 Authentication attempt for:', req.method, req.path);
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({
      success: false,
      message: '認証トークンが必要です'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded for user:', decoded.userId);
    
    // Get user from database to ensure they still exist
    const user = await query(
      'SELECT id, userid, nickname, avatar_url, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user || user.length === 0) {
      console.log('❌ User not found in database:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    console.log('✅ User authenticated:', user[0].userid);
    req.user = user[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      console.log('❌ Token expired for request:', req.path);
      return res.status(401).json({
        success: false,
        message: 'トークンの有効期限が切れています'
      });
    }
    
    console.log('❌ Invalid token for request:', req.path);
    return res.status(403).json({
      success: false,
      message: '無効なトークンです'
    });
  }
}

// Generate JWT token
function generateToken(userId) {
  return jwt.sign(
    { userId: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.SESSION_EXPIRY || '24h' }
  );
}

// Verify token without middleware (for socket.io)
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await query(
      'SELECT id, userid, nickname, avatar_url, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user || user.length === 0) {
      return null;
    }

    return user[0];
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

module.exports = {
  authenticateToken,
  generateToken,
  verifyToken
};
