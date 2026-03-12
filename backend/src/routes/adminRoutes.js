const express = require('express');
const {
  getDashboardStats,
  getAllUsers,
  updateUserRole,
  deleteUser,
  banUser,
  unbanUser,
  getAllItems,
  deleteItem,
  getAllDisputes,
  getDisputeDetail,
  reviewDispute
} = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// 所有管理员路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 仪表板统计
router.get('/dashboard/stats', getDashboardStats);

// 用户管理
router.get('/users', getAllUsers);
router.put('/users/:userId/role', updateUserRole);
router.delete('/users/:userId', deleteUser);
router.post('/users/:userId/ban', banUser);
router.post('/users/:userId/unban', unbanUser);

// 商品管理
router.get('/items', getAllItems);
router.delete('/items/:itemId', deleteItem);

// 纠纷管理
router.get('/disputes', getAllDisputes);
router.get('/disputes/:id', getDisputeDetail);
router.post('/disputes/:id/review', reviewDispute);

module.exports = router;






