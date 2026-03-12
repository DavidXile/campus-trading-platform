const express = require('express');
const {
  createDispute,
  respondToDispute,
  getDisputeById,
  getMyDisputes,
  confirmDisputeResult
} = require('../controllers/disputeController');
const { authenticateToken, ensureProfileComplete } = require('../middlewares/authMiddleware');

const router = express.Router();

// 发起纠纷（需要认证）
router.post('/', authenticateToken, ensureProfileComplete, createDispute);

// 响应纠纷（需要认证）
router.post('/:id/respond', authenticateToken, ensureProfileComplete, respondToDispute);

// 获取纠纷详情（需要认证）
router.get('/:id', authenticateToken, getDisputeById);

// 获取我的纠纷列表（需要认证）
router.get('/user/my-disputes', authenticateToken, getMyDisputes);

// 确认处理结果（接受或申诉）（需要认证）
router.post('/:id/confirm', authenticateToken, ensureProfileComplete, confirmDisputeResult);

module.exports = router;

