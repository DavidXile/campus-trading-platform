const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const { testConnection } = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const itemRoutes = require('./routes/itemRoutes');
const errandRoutes = require('./routes/errandRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const jwt = require('jsonwebtoken');
const { query } = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API 路由
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/errands', errandRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/disputes', disputeRoutes);

// 基础路由
app.get('/', (req, res) => {
  res.json({
    message: '欢迎使用校园二手交易平台 API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/users',
      items: '/api/items',
      docs: 'API documentation coming soon'
    }
  });
});

// WebSocket 连接管理
// 支持同一用户多个连接（多设备/多标签页）
// userId -> Set<socketId>
const userSockets = new Map(); 

// Socket.IO 连接处理
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('未提供认证令牌'));
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return next(new Error('无效的认证令牌'));
      }

      // 从数据库获取用户信息
      const [users] = await query('SELECT id, username, email FROM users WHERE id = ?', [decoded.userId]);
      if (users.length === 0) {
        return next(new Error('用户不存在'));
      }

      socket.userId = decoded.userId;
      socket.user = users[0];
      next();
    });
  } catch (error) {
    next(new Error('认证失败'));
  }
});

io.on('connection', (socket) => {
  console.log(`用户 ${socket.user?.username || 'Unknown'} (ID: ${socket.userId}) 已连接`);

  // 存储用户socket连接（支持多个连接）
  if (!userSockets.has(socket.userId)) {
    userSockets.set(socket.userId, new Set());
  }
  userSockets.get(socket.userId).add(socket.id);

  // 加入用户专属房间
  socket.join(`user_${socket.userId}`);

  // 监听加入会话房间
  socket.on('join_conversation', (conversationId) => {
    const roomName = `conversation_${conversationId}`;
    socket.join(roomName);
    // 确认加入成功
    socket.emit('joined_conversation', { conversationId, room: roomName });
  });

  // 监听离开会话房间
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
  });

  // 监听发送消息
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, content, image_url, attachment_url, attachment_name } = data;

      // 验证用户是否有权限访问此会话（动态检查字段）
      const dbName = process.env.DB_NAME || 'campus_trading';
      let selectFields = 'user1_id, user2_id';
      const deleteFields = [];
      
      try {
        const [fields] = await query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'conversations' AND COLUMN_NAME IN ('deleted_by_user1', 'deleted_by_user2', 'permanently_deleted_by_user1', 'permanently_deleted_by_user2')",
          [dbName]
        );
        fields.forEach(f => {
          deleteFields.push(f.COLUMN_NAME);
          selectFields += `, ${f.COLUMN_NAME}`;
        });
      } catch (e) {
        // 忽略字段检查错误
      }

      const [conversations] = await query(
        `SELECT ${selectFields} FROM conversations WHERE id = ?`,
        [conversationId]
      );

      if (conversations.length === 0) {
        socket.emit('error', { message: '会话不存在' });
        return;
      }

      const conversation = conversations[0];
      if (conversation.user1_id !== socket.userId && conversation.user2_id !== socket.userId) {
        socket.emit('error', { message: '无权访问此会话' });
        return;
      }

      // 如果会话被当前用户暂时删除了，自动恢复它（如果字段存在）
      if (deleteFields.length > 0) {
        const isUser1 = conversation.user1_id === socket.userId;
        const deletedField = isUser1 ? 'deleted_by_user1' : 'deleted_by_user2';
        
        if (deleteFields.includes(deletedField)) {
          const isTemporarilyDeleted = conversation[deletedField] === 1 || conversation[deletedField] === true;
          
          if (isTemporarilyDeleted) {
            await query(`UPDATE conversations SET ${deletedField} = FALSE WHERE id = ?`, [conversationId]);
          }
        }
      }

      // 插入消息到数据库
      const [result] = await query(
        `INSERT INTO messages (conversation_id, sender_id, content, image_url, attachment_url, attachment_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [conversationId, socket.userId, content || null, image_url || null, attachment_url || null, attachment_name || null]
      );

      // 更新会话的最后消息时间
      await query('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [conversationId]);

      // 获取刚插入的消息
      const [messages] = await query(
        `SELECT m.*, u.username as sender_username
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.id = ?`,
        [result.insertId]
      );

      if (messages.length === 0) {
        socket.emit('error', { message: '消息创建失败' });
        return;
      }

      const message = {
        ...messages[0],
        conversation_id: conversationId // 确保包含会话ID
      };

      // 确定接收者
      const receiverId = conversation.user1_id === socket.userId 
        ? conversation.user2_id 
        : conversation.user1_id;

      // 发送消息到会话房间（所有在此会话中的用户都会收到）
      const conversationRoom = `conversation_${conversationId}`;
      io.to(conversationRoom).emit('new_message', message);

      // 如果接收方删除了会话，自动恢复它（清除暂时删除标记，但保留永久删除标记）
      // 这样永久删除的用户虽然看不到历史消息，但能收到新消息（如果字段存在）
      if (deleteFields.length > 0) {
        const isReceiverUser1 = conversation.user1_id === receiverId;
        const receiverDeletedField = isReceiverUser1 ? 'deleted_by_user1' : 'deleted_by_user2';
        
        if (deleteFields.includes(receiverDeletedField)) {
          const receiverTemporarilyDeleted = conversation[receiverDeletedField] === 1 || conversation[receiverDeletedField] === true;
          
          if (receiverTemporarilyDeleted) {
            // 清除暂时删除标记，让会话重新出现在列表中
            await query(`UPDATE conversations SET ${receiverDeletedField} = FALSE WHERE id = ?`, [conversationId]);
          }
        }
      }

      // 发送通知到接收者的用户房间（即使不在会话页面也能收到通知）
      const userRoom = `user_${receiverId}`;
      io.to(userRoom).emit('new_message_notification', {
        conversationId,
        message,
        unread_count: await getUnreadCountForUser(receiverId)
      });
    } catch (error) {
      console.error('发送消息错误:', error);
      socket.emit('error', { message: '发送消息失败' });
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`用户 ${socket.user?.username || 'Unknown'} (ID: ${socket.userId}) 已断开连接`);
    
    // 从用户的连接集合中移除这个socket
    if (userSockets.has(socket.userId)) {
      const socketSet = userSockets.get(socket.userId);
      socketSet.delete(socket.id);
      
      // 如果该用户没有其他连接了，删除整个集合
      if (socketSet.size === 0) {
        userSockets.delete(socket.userId);
      }
    }
  });
});

// 辅助函数：获取用户的未读消息数
async function getUnreadCountForUser(userId) {
  try {
    const [result] = await query(
      `SELECT COUNT(*) as unread_count
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE (c.user1_id = ? OR c.user2_id = ?)
       AND m.sender_id != ?
       AND m.is_read = FALSE`,
      [userId, userId, userId]
    );
    return result[0].unread_count;
  } catch (error) {
    console.error('获取未读消息数错误:', error);
    return 0;
  }
}

// 导出io供其他模块使用
app.set('io', io);

// 启动服务器
const startServer = async () => {
  // 测试数据库连接
  const dbConnected = await testConnection();

  if (dbConnected) {
    server.listen(PORT, () => {
      console.log(`🚀 服务器运行在端口 ${PORT}`);
      console.log(`📊 数据库连接正常`);
      console.log(`💬 WebSocket 服务已启动`);
    });
  } else {
    console.error('❌ 无法启动服务器：数据库连接失败');
    process.exit(1);
  }
};

// 测试环境下不自动启动服务器，便于使用 Supertest 进行无端口测试
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
