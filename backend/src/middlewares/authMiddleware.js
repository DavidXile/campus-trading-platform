const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { ensureUserProfileColumns } = require('../utils/schemaUtils');

// JWT 认证中间件
const authenticateToken = async (req, res, next) => {
  // 从请求头获取 token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '访问令牌缺失'
    });
  }

  // 验证 token
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '无效的访问令牌'
      });
    }

    // 从数据库获取用户最新信息（包括角色和封禁状态）
    try {
      await ensureUserProfileColumns();
      
      // 检查封禁相关字段是否存在
      const dbName = process.env.DB_NAME || 'campus_trading';
      const [isBannedCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_banned'",
        [dbName]
      );
      const [banExpiresAtCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_expires_at'",
        [dbName]
      );
      const [banReasonCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_reason'",
        [dbName]
      );

      // 构建查询字段
      let selectFields = 'id, username, email, role, phone, college';
      if (isBannedCol.length > 0) {
        selectFields += ', COALESCE(is_banned, 0) as is_banned';
      }
      if (banExpiresAtCol.length > 0) {
        selectFields += ', ban_expires_at';
      }
      if (banReasonCol.length > 0) {
        selectFields += ', ban_reason';
      }

      const [users] = await query(
        `SELECT ${selectFields} FROM users WHERE id = ?`,
        [decoded.userId]
      );
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      const user = users[0];

      // 检查用户是否被封禁
      if (isBannedCol.length > 0 && user.is_banned) {
        // 检查是否为临时封禁且已过期
        let isExpired = false;
        if (banExpiresAtCol.length > 0 && user.ban_expires_at) {
          const expiresAt = new Date(user.ban_expires_at);
          const now = new Date();
          if (expiresAt < now) {
            // 封禁已过期，自动解封
            isExpired = true;
            await query('UPDATE users SET is_banned = FALSE, ban_expires_at = NULL, ban_reason = NULL WHERE id = ?', [user.id]);
            // 更新封禁记录
            await query(
              `UPDATE ban_records 
               SET is_active = FALSE, 
                   lifted_at = NOW()
               WHERE user_id = ? AND is_active = TRUE`,
              [user.id]
            );
          }
        }

        if (!isExpired) {
          // 用户仍被封禁，拒绝访问
          const banMessage = user.ban_expires_at 
            ? `您的账户已被临时封禁，到期时间：${new Date(user.ban_expires_at).toLocaleString('zh-CN')}。${user.ban_reason ? `原因：${user.ban_reason}` : ''}`
            : `您的账户已被永久封禁。${user.ban_reason ? `原因：${user.ban_reason}` : ''}`;
          
          return res.status(403).json({
            success: false,
            message: banMessage
          });
        }
      }

      // 将解码后的用户信息附加到请求对象，包含角色信息
      req.user = {
        ...decoded,
        role: user.role,
        phone: user.phone,
        college: user.college
      };
      next();
    } catch (error) {
      console.error('获取用户信息错误:', error);
      return res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  });
};

// 管理员权限验证中间件
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '需要登录'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  }

  next();
};

// 确保用户已完善资料
const ensureProfileComplete = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '需要登录'
    });
  }

  if (!req.user.phone || !req.user.college) {
    return res.status(403).json({
      success: false,
      message: '请先完善个人资料后再进行买卖',
      requiresProfileCompletion: true
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  ensureProfileComplete
};

