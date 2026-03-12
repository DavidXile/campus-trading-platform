const express = require('express');
const {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
  getUserItems,
  purchaseItem,
  getPurchasedItems,
  getSoldItems
} = require('../controllers/itemController');
const { authenticateToken, ensureProfileComplete } = require('../middlewares/authMiddleware');

const router = express.Router();

// 获取所有在售物品 (公开)
router.get('/', getItems);

// 获取单个物品详情 (公开)
router.get('/:id', getItemById);

// 购买物品 (需要认证)
router.post('/:id/purchase', authenticateToken, ensureProfileComplete, purchaseItem);

// 创建新物品 (需要认证)
router.post('/', authenticateToken, ensureProfileComplete, createItem);

// 更新物品 (需要认证，且验证所有权在控制器中)
router.put('/:id', authenticateToken, ensureProfileComplete, updateItem);

// 删除物品 (需要认证，且验证所有权在控制器中)
router.delete('/:id', authenticateToken, ensureProfileComplete, deleteItem);

// 获取当前用户的物品列表 (需要认证)
router.get('/user/my-items', authenticateToken, getUserItems);

// 获取购买的物品 (需要认证)
router.get('/user/purchased', authenticateToken, getPurchasedItems);

// 获取已售出的物品 (需要认证)
router.get('/user/sold', authenticateToken, getSoldItems);

module.exports = router;



