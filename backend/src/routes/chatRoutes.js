const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getOrCreateConversation,
  getConversations,
  getConversationById,
  getMessages,
  sendMessage,
  getUnreadCount,
  markConversationAsRead,
  deleteConversation
} = require('../controllers/chatController');

// 所有路由都需要认证
router.use(authenticateToken);

// 创建或获取会话
router.post('/conversations', getOrCreateConversation);

// 获取用户的所有会话列表
router.get('/conversations', getConversations);

// 获取会话详情
router.get('/conversations/:id', getConversationById);

// 获取会话的消息列表
router.get('/conversations/:id/messages', getMessages);

// 发送消息
router.post('/conversations/:id/messages', sendMessage);

// 获取未读消息数量
router.get('/unread-count', getUnreadCount);

// 标记会话为已读
router.put('/conversations/:id/read', markConversationAsRead);

// 删除会话
router.delete('/conversations/:id', deleteConversation);

module.exports = router;




