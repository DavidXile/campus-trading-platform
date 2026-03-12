const express = require('express');
const { 
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
} = require('../controllers/userController');
const { depositWallet, getWalletInfo } = require('../controllers/walletController');
const { getMyCreditRecords } = require('../controllers/creditController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// 发送验证码路由
router.post('/send-code', sendCode);

// 用户注册路由
router.post('/register', registerUser);

// 用户登录路由
router.post('/login', loginUser);

// 忘记密码 - 发送验证码
router.post('/forgot-password/send-code', forgotPasswordSendCode);

// 忘记密码 - 重置密码
router.post('/forgot-password/reset', resetPassword);

// 获取当前用户信息路由（需要认证）
router.get('/me', authenticateToken, getCurrentUser);
router.get('/profile', authenticateToken, getCurrentUser); // 兼容旧接口

// 更新当前用户信息（需要认证）
router.put('/profile', authenticateToken, updateUserProfile);

// 修改密码（需要认证）
router.post('/change-password', authenticateToken, changePassword);

// 上传用户头像（需要认证）
router.post('/avatar', authenticateToken, uploadAvatar);

// 获取公开卖家信息（可选认证，如果已登录可以获取更多信息）
router.get('/public/:userId', (req, res, next) => {
  // 尝试认证，但不强制要求
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { userId: decoded.userId };
    } catch (err) {
      // token无效，继续执行但不设置req.user
    }
  }
  next();
}, getPublicUserProfile);

// 钱包相关路由
router.post('/wallet/deposit', authenticateToken, depositWallet);
router.get('/wallet/info', authenticateToken, getWalletInfo);

// 信用记录相关路由
router.get('/credit-records', authenticateToken, getMyCreditRecords);

module.exports = router;



