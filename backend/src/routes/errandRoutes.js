const express = require('express');
const {
  createErrand,
  getErrands,
  getErrandById,
  acceptErrand,
  completeErrand,
  cancelErrand,
  getMyErrands,
  updateErrand,
  deleteErrand
} = require('../controllers/errandController');
const { authenticateToken, ensureProfileComplete } = require('../middlewares/authMiddleware');

const router = express.Router();

// 获取跑腿任务列表（公开）
router.get('/', getErrands);

// 获取单个跑腿任务详情（公开）
router.get('/:id', getErrandById);

// 发布跑腿任务（需要认证）
router.post('/', authenticateToken, ensureProfileComplete, createErrand);

// 接单（需要认证）
router.post('/:id/accept', authenticateToken, ensureProfileComplete, acceptErrand);

// 完成任务（需要认证）
router.post('/:id/complete', authenticateToken, ensureProfileComplete, completeErrand);

// 确认完成任务（需要认证，需要双方确认）
router.post('/:id/confirm-complete', authenticateToken, ensureProfileComplete, completeErrand);

// 取消任务（需要认证）
router.post('/:id/cancel', authenticateToken, ensureProfileComplete, cancelErrand);

// 获取我的跑腿任务（需要认证）
router.get('/user/my-errands', authenticateToken, getMyErrands);

// 更新跑腿任务（需要认证）
router.put('/:id', authenticateToken, ensureProfileComplete, updateErrand);

// 删除跑腿任务（需要认证）
router.delete('/:id', authenticateToken, ensureProfileComplete, deleteErrand);

module.exports = router;






