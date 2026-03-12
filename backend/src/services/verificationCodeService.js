// 验证码服务（模拟发送）
// 在生产环境中，应该使用真实的短信或邮件服务

// 存储验证码的内存缓存（key: email, value: { code, expiresAt, attempts }）
const verificationCodes = new Map();

// 验证码有效期（5分钟）
const CODE_EXPIRY_TIME = 5 * 60 * 1000;

// 验证码长度
const CODE_LENGTH = 6;

// 最大尝试次数
const MAX_ATTEMPTS = 5;

/**
 * 生成随机验证码
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 发送验证码（模拟）
 * @param {string} email - 邮箱地址
 * @returns {Promise<{success: boolean, message: string, code?: string}>}
 */
async function sendVerificationCode(email) {
  try {
    // 检查是否在60秒内发送过验证码（防止频繁发送）
    const existingCode = verificationCodes.get(email);
    if (existingCode && Date.now() - existingCode.createdAt < 60 * 1000) {
      return {
        success: false,
        message: '验证码发送过于频繁，请稍后再试'
      };
    }

    // 生成验证码
    const code = generateCode();
    const expiresAt = Date.now() + CODE_EXPIRY_TIME;

    // 存储验证码
    verificationCodes.set(email, {
      code,
      expiresAt,
      createdAt: Date.now(),
      attempts: 0
    });

    // 模拟发送验证码（在实际环境中，这里应该调用短信或邮件服务）
    console.log(`📧 [模拟] 验证码已发送到 ${email}: ${code}`);
    console.log(`⏰ 验证码有效期：5分钟`);

    return {
      success: true,
      message: '验证码已发送，请查收（开发环境：验证码已输出到控制台）',
      // 开发环境返回验证码，生产环境不应返回
      code: process.env.NODE_ENV === 'development' ? code : undefined
    };
  } catch (error) {
    console.error('发送验证码错误:', error);
    return {
      success: false,
      message: '发送验证码失败，请稍后重试'
    };
  }
}

/**
 * 验证验证码
 * @param {string} email - 邮箱地址
 * @param {string} code - 验证码
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function verifyCode(email, code) {
  try {
    const stored = verificationCodes.get(email);

    // 检查验证码是否存在
    if (!stored) {
      return {
        success: false,
        message: '验证码不存在或已过期，请重新获取'
      };
    }

    // 检查验证码是否过期
    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(email);
      return {
        success: false,
        message: '验证码已过期，请重新获取'
      };
    }

    // 检查尝试次数
    if (stored.attempts >= MAX_ATTEMPTS) {
      verificationCodes.delete(email);
      return {
        success: false,
        message: '验证码尝试次数过多，请重新获取'
      };
    }

    // 验证验证码
    if (stored.code !== code) {
      stored.attempts += 1;
      const remainingAttempts = MAX_ATTEMPTS - stored.attempts;
      return {
        success: false,
        message: `验证码错误，还有 ${remainingAttempts} 次尝试机会`
      };
    }

    // 验证成功，删除验证码
    verificationCodes.delete(email);

    return {
      success: true,
      message: '验证码验证成功'
    };
  } catch (error) {
    console.error('验证验证码错误:', error);
    return {
      success: false,
      message: '验证验证码失败，请稍后重试'
    };
  }
}

/**
 * 清理过期的验证码（定期清理）
 */
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}

// 每10分钟清理一次过期验证码
setInterval(cleanupExpiredCodes, 10 * 60 * 1000);

module.exports = {
  sendVerificationCode,
  verifyCode
};

