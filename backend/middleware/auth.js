const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// JWT token verification middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '認証トークンが必要です'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist
    const user = await query(
      'SELECT id, userid, nickname, avatar_url, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user || user.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    req.user = user[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'トークンの有効期限が切れています'
      });
    }
    
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
