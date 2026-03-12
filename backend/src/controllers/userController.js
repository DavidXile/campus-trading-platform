const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { ensureUserProfileColumns } = require('../utils/schemaUtils');
const { sendVerificationCode, verifyCode } = require('../services/verificationCodeService');

const formatUserResponse = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role || 'user',
  phone: user.phone || '',
  college: user.college || '',
  avatar: user.avatar || null,
  wallet_balance: parseFloat(user.wallet_balance || 0),
  credit_score: parseInt(user.credit_score || 100),
  is_banned: Boolean(user.is_banned),
  ban_reason: user.ban_reason || null,
  banned_at: user.banned_at || null,
  ban_expires_at: user.ban_expires_at || null,
  created_at: user.created_at,
  isProfileComplete: Boolean(user.phone && user.college)
});

// 用户注册
const registerUser = async (req, res) => {
  try {
    await ensureUserProfileColumns();
    const { username, email, password, avatar, verificationCode } = req.body;

    // 验证必填字段
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名、邮箱和密码都是必填项'
      });
    }

    // 验证邮箱格式（必须是学生邮箱）
    const emailRegex = /^[a-zA-Z0-9._%+-]+@student\.must\.edu\.mo$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '只允许使用澳门科技大学学生邮箱注册（@student.must.edu.mo）'
      });
    }

    // 先检查邮箱是否已被注册（在验证验证码之前）
    const [existingUsers] = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: '该邮箱已被注册，请使用其他邮箱或直接登录'
      });
    }

    // 验证验证码
    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: '请输入验证码'
      });
    }

    const codeVerification = await verifyCode(email, verificationCode);
    if (!codeVerification.success) {
      return res.status(400).json({
        success: false,
        message: codeVerification.message
      });
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码长度至少为6个字符'
      });
    }

    // 如果提供了头像，验证头像格式
    if (avatar) {
      const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
      if (!base64Regex.test(avatar)) {
        return res.status(400).json({
          success: false,
          message: '头像格式不正确，请使用图片格式（PNG、JPEG、JPG、GIF、WEBP）'
        });
      }

      // 验证图片大小（限制为2MB，base64编码后约为2.67MB）
      const base64Data = avatar.split(',')[1];
      const imageSize = (base64Data.length * 3) / 4;
      if (imageSize > 2 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: '头像大小不能超过2MB'
        });
      }
    }

    // 检查用户名是否已被使用
    const [existingUsernames] = await query('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsernames.length > 0) {
      return res.status(409).json({
        success: false,
        message: '该用户名已被使用'
      });
    }

    // 哈希密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 插入新用户（如果提供了头像，则包含在插入语句中）
    let result;
    if (avatar) {
      [result] = await query(
        'INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, avatar]
      );
    } else {
      [result] = await query(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username, email, hashedPassword]
      );
    }

    res.status(201).json({
      success: true,
      message: '用户注册成功',
      userId: result.insertId
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 用户登录
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '邮箱和密码都是必填项'
      });
    }

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
    let selectFields = 'id, username, email, password_hash, role, phone, college, avatar, created_at';
    if (isBannedCol.length > 0) {
      selectFields += ', COALESCE(is_banned, 0) as is_banned';
    }
    if (banExpiresAtCol.length > 0) {
      selectFields += ', ban_expires_at';
    }
    if (banReasonCol.length > 0) {
      selectFields += ', ban_reason';
    }

    // 查找用户
    const [users] = await query(
      `SELECT ${selectFields} FROM users WHERE email = ?`,
      [email]
    );
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    const user = users[0];

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

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
        // 用户仍被封禁
        const banMessage = user.ban_expires_at 
          ? `您的账户已被临时封禁，到期时间：${new Date(user.ban_expires_at).toLocaleString('zh-CN')}。${user.ban_reason ? `原因：${user.ban_reason}` : ''}`
          : `您的账户已被永久封禁。${user.ban_reason ? `原因：${user.ban_reason}` : ''}`;
        
        return res.status(403).json({
          success: false,
          message: banMessage
        });
      }
    }

    // 生成 JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d' // token 7天过期
      }
    );

    res.json({
      success: true,
      message: '登录成功',
      token: token,
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取当前用户信息
const getCurrentUser = async (req, res) => {
  try {
    await ensureUserProfileColumns();
    
    // 动态检查字段是否存在，避免查询不存在的字段导致错误
    const [columns] = await query("SHOW COLUMNS FROM users");
    const columnNames = columns.map(col => col.Field);
    
    const selectFields = [
      'id', 'username', 'email', 'role', 'phone', 'college', 'avatar',
      'COALESCE(wallet_balance, 0) as wallet_balance',
      'COALESCE(credit_score, 100) as credit_score'
    ];
    
    // 只选择存在的字段
    if (columnNames.includes('is_banned')) {
      selectFields.push('COALESCE(is_banned, 0) as is_banned');
    }
    if (columnNames.includes('ban_reason')) {
      selectFields.push('ban_reason');
    }
    if (columnNames.includes('banned_at')) {
      selectFields.push('banned_at');
    }
    if (columnNames.includes('ban_expires_at')) {
      selectFields.push('ban_expires_at');
    }
    
    selectFields.push('created_at');
    
    const [users] = await query(
      `SELECT ${selectFields.join(', ')} FROM users WHERE id = ?`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = users[0];
    console.log(`🔍 获取用户信息: ID=${user.id}, 用户名=${user.username}, 信用分=${user.credit_score}`);

    res.json({
      success: true,
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('❌ 获取用户信息错误:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 更新用户手机号与学院信息
const updateUserProfile = async (req, res) => {
  try {
    await ensureUserProfileColumns();
    const { phone, college } = req.body;
    const trimmedPhone = (phone || '').trim();
    const trimmedCollege = (college || '').trim();

    if (!trimmedPhone || !trimmedCollege) {
      return res.status(400).json({
        success: false,
        message: '手机号和学院信息不能为空'
      });
    }

    if (trimmedCollege.length > 100) {
      return res.status(400).json({
        success: false,
        message: '学院信息长度不能超过100个字符'
      });
    }

    const phonePattern = /^[0-9+\-\s]{6,20}$/;
    if (!phonePattern.test(trimmedPhone)) {
      return res.status(400).json({
        success: false,
        message: '请输入有效的手机号（仅支持数字、+、- 和空格）'
      });
    }

    const sanitizedPhone = trimmedPhone.replace(/\s+/g, '');

    await query(
      'UPDATE users SET phone = ?, college = ? WHERE id = ?',
      [sanitizedPhone, trimmedCollege, req.user.userId]
    );

    const [users] = await query(
      'SELECT id, username, email, role, phone, college, avatar, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '个人资料已更新',
      user: formatUserResponse(users[0])
    });

  } catch (error) {
    console.error('更新用户资料错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 上传用户头像
const uploadAvatar = async (req, res) => {
  try {
    await ensureUserProfileColumns();
    const { avatar } = req.body;

    // 验证avatar是否为base64格式的图片
    if (!avatar) {
      return res.status(400).json({
        success: false,
        message: '请提供头像数据'
      });
    }

    // 验证base64格式
    const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
    if (!base64Regex.test(avatar)) {
      return res.status(400).json({
        success: false,
        message: '头像格式不正确，请使用图片格式（PNG、JPEG、JPG、GIF、WEBP）'
      });
    }

    // 验证图片大小（限制为2MB，base64编码后约为2.67MB）
    const base64Data = avatar.split(',')[1];
    const imageSize = (base64Data.length * 3) / 4;
    if (imageSize > 2 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: '头像大小不能超过2MB'
      });
    }

    // 更新用户头像
    await query(
      'UPDATE users SET avatar = ? WHERE id = ?',
      [avatar, req.user.userId]
    );

    // 获取更新后的用户信息
    const [users] = await query(
      'SELECT id, username, email, role, phone, college, avatar, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '头像上传成功',
      user: formatUserResponse(users[0])
    });

  } catch (error) {
    console.error('上传头像错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取公开的用户资料（卖家页面）
const getPublicUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const [users] = await query(
      'SELECT id, username, email, phone, avatar, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const [items] = await query(
      `
      SELECT id, title, price, category, status, created_at
      FROM items
      WHERE seller_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    // 获取发布的跑腿任务
    const [publishedErrands] = await query(
      `
      SELECT e.id, e.title, e.reward, e.category, e.status, e.location, e.destination, e.created_at,
             e.accepter_id, e.confirmed_by_publisher, e.confirmed_by_accepter,
             u.id as accepter_user_id, u.username as accepter_username, u.email as accepter_email
      FROM errands e
      LEFT JOIN users u ON e.accepter_id = u.id
      WHERE e.publisher_id = ?
      ORDER BY e.created_at DESC
      `,
      [userId]
    );

    // 获取接单的跑腿任务
    const [acceptedErrands] = await query(
      `
      SELECT e.id, e.title, e.reward, e.category, e.status, e.location, e.destination, e.created_at,
             e.publisher_id, e.confirmed_by_publisher, e.confirmed_by_accepter,
             u.id as publisher_user_id, u.username as publisher_username, u.email as publisher_email
      FROM errands e
      LEFT JOIN users u ON e.publisher_id = u.id
      WHERE e.accepter_id = ?
      ORDER BY e.created_at DESC
      `,
      [userId]
    );

    // 合并跑腿任务列表
    const allErrands = [...publishedErrands, ...acceptedErrands].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    // 获取当前查看者ID（如果已登录）
    const viewerId = req.user?.userId ? Number(req.user.userId) : null;
    const isViewingSelf = viewerId && Number(userId) === viewerId;

    // 如果不是查看自己的主页，需要对对方信息进行加密
    const processedErrands = allErrands.map(errand => {
      const processed = { ...errand };
      
      // 如果是查看他人主页，需要加密对方信息
      if (!isViewingSelf) {
        // 如果当前用户是发布者，加密接单者信息
        if (Number(errand.publisher_id) === Number(userId) && errand.accepter_id) {
          processed.accepter_username = '***';
          processed.accepter_email = '***@***.***';
        }
        // 如果当前用户是接单者，加密发布者信息
        if (Number(errand.accepter_id) === Number(userId) && errand.publisher_id) {
          processed.publisher_username = '***';
          processed.publisher_email = '***@***.***';
        }
      }
      
      return processed;
    });

    res.json({
      success: true,
      user: users[0],
      items,
      errands: processedErrands
    });

  } catch (error) {
    console.error('获取公开用户资料错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 发送验证码
const sendCode = async (req, res) => {
  try {
    const { email, type } = req.body; // type: 'register' | 'forgotPassword'

    if (!email) {
      return res.status(400).json({
        success: false,
        message: '请输入邮箱地址'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[a-zA-Z0-9._%+-]+@student\.must\.edu\.mo$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '只允许使用澳门科技大学学生邮箱（@student.must.edu.mo）'
      });
    }

    // 如果是注册，检查邮箱是否已被注册
    if (type === 'register') {
      const [existingUsers] = await query('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: '该邮箱已被注册'
        });
      }
    }

    // 如果是忘记密码，检查邮箱是否存在
    if (type === 'forgotPassword') {
      const [existingUsers] = await query('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: '该邮箱未注册'
        });
      }
    }

    const result = await sendVerificationCode(email);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        // 开发环境返回验证码
        ...(result.code && { code: result.code })
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 修改密码（需要旧密码）
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // 验证必填字段
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请输入旧密码和新密码'
      });
    }

    // 验证新密码长度
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度至少为6个字符'
      });
    }

    // 获取用户信息
    const [users] = await query(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = users[0];

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '旧密码错误'
      });
    }

    // 检查新密码是否与旧密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: '新密码不能与旧密码相同'
      });
    }

    // 哈希新密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 更新密码
    await query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 忘记密码 - 发送验证码
const forgotPasswordSendCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: '请输入邮箱地址'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[a-zA-Z0-9._%+-]+@student\.must\.edu\.mo$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '只允许使用澳门科技大学学生邮箱（@student.must.edu.mo）'
      });
    }

    // 检查邮箱是否存在
    const [existingUsers] = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该邮箱未注册'
      });
    }

    const result = await sendVerificationCode(email);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        // 开发环境返回验证码
        ...(result.code && { code: result.code })
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 忘记密码 - 重置密码
const resetPassword = async (req, res) => {
  try {
    const { email, verificationCode, newPassword } = req.body;

    // 验证必填字段
    if (!email || !verificationCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '邮箱、验证码和新密码都是必填项'
      });
    }

    // 验证新密码长度
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度至少为6个字符'
      });
    }

    // 验证验证码
    const codeVerification = await verifyCode(email, verificationCode);
    if (!codeVerification.success) {
      return res.status(400).json({
        success: false,
        message: codeVerification.message
      });
    }

    // 检查邮箱是否存在
    const [existingUsers] = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该邮箱未注册'
      });
    }

    // 哈希新密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 更新密码
    await query(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hashedPassword, email]
    );

    res.json({
      success: true,
      message: '密码重置成功，请使用新密码登录'
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserProfile,
  getPublicUserProfile,
  uploadAvatar,
  sendCode,
  changePassword,
  forgotPasswordSendCode,
  resetPassword
};



