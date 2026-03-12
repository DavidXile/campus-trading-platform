const { query } = require('../config/db');

// 创建或获取会话（按商品或任务维度）
const getOrCreateConversation = async (req, res) => {
  try {
    const { item_id, errand_id } = req.body;
    const userId = req.user.userId;

    // 验证参数：必须提供item_id或errand_id之一
    if (!item_id && !errand_id) {
      return res.status(400).json({
        success: false,
        message: '必须提供item_id或errand_id'
      });
    }

    if (item_id && errand_id) {
      return res.status(400).json({
        success: false,
        message: '不能同时提供item_id和errand_id'
      });
    }

    let otherUserId;
    let relatedId;
    let relatedType;

    // 获取对方用户ID
    if (item_id) {
      relatedId = item_id;
      relatedType = 'item';
      const [items] = await query(
        'SELECT seller_id, buyer_id FROM items WHERE id = ?',
        [item_id]
      );
      if (items.length === 0) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }
      const item = items[0];
      
      
      // 如果是卖家，对方是买家（如果有）或潜在买家；如果是买家或潜在买家，对方是卖家
      // 使用 Number() 确保类型一致
      if (Number(item.seller_id) === Number(userId)) {
        // 卖家：如果有买家，对方是买家；如果没有买家，卖家不能主动创建会话
        // 因为卖家不知道要联系哪个潜在买家，应该等待买家主动联系
        // 所以这里返回错误，提示卖家等待买家联系
        if (item.buyer_id) {
          // 如果有买家，对方是买家
        otherUserId = item.buyer_id;
        } else {
          // 如果没有买家，卖家不能主动创建会话（需要等待买家联系）
          return res.status(400).json({
            success: false,
            message: '商品尚未售出，请等待买家联系您'
          });
        }
      } else {
        // 买家或潜在买家：对方是卖家（购买前可以聊天）
        // 允许任何非卖家用户联系卖家，即使商品还没有被购买
        otherUserId = item.seller_id;
      }
    } else {
      relatedId = errand_id;
      relatedType = 'errand';
      const [errands] = await query(
        'SELECT publisher_id, accepter_id FROM errands WHERE id = ?',
        [errand_id]
      );
      if (errands.length === 0) {
        return res.status(404).json({
          success: false,
          message: '跑腿任务不存在'
        });
      }
      const errand = errands[0];
      // 如果是发布者，对方是接单者（如果有）或潜在接单者；如果是接单者或潜在接单者，对方是发布者
      if (errand.publisher_id === userId) {
        // 发布者：对方是接单者（如果有），如果没有接单者，允许与任何潜在接单者聊天
        // 但为了简化，如果没有接单者，返回错误提示发布者等待接单者联系
        otherUserId = errand.accepter_id;
        // 如果没有接单者，返回错误提示发布者等待接单者联系
        if (!errand.accepter_id) {
          return res.status(400).json({
            success: false,
            message: '任务尚未被接单，请等待接单者联系您'
          });
        }
      } else {
        // 接单者或潜在接单者：对方是发布者（接单前可以聊天）
        otherUserId = errand.publisher_id;
      }
    }

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: '无法确定对方用户'
      });
    }

    // 不能和自己聊天
    if (otherUserId === userId) {
      return res.status(400).json({
        success: false,
        message: '不能和自己聊天'
      });
    }

    // 查找是否已存在会话（确保user1_id < user2_id以保持一致性）
    const user1Id = Math.min(userId, otherUserId);
    const user2Id = Math.max(userId, otherUserId);

    let sql, params;
    if (item_id) {
      sql = 'SELECT * FROM conversations WHERE item_id = ? AND user1_id = ? AND user2_id = ?';
      params = [item_id, user1Id, user2Id];
    } else {
      sql = 'SELECT * FROM conversations WHERE errand_id = ? AND user1_id = ? AND user2_id = ?';
      params = [errand_id, user1Id, user2Id];
    }

    const [conversations] = await query(sql, params);

    let conversation;
    if (conversations.length > 0) {
      conversation = conversations[0];
      
      // 检查是否被永久删除
      const isUser1 = conversation.user1_id === userId;
      const isPermanentlyDeleted = isUser1 
        ? (conversation.permanently_deleted_by_user1 === 1 || conversation.permanently_deleted_by_user1 === true)
        : (conversation.permanently_deleted_by_user2 === 1 || conversation.permanently_deleted_by_user2 === true);
      
      if (isPermanentlyDeleted) {
        // 如果被永久删除，不恢复，而是创建新会话
        conversation = null;
      } else {
        // 如果会话存在但被当前用户暂时删除了，恢复它（清除删除标记）
        const isTemporarilyDeleted = isUser1 
          ? (conversation.deleted_by_user1 === 1 || conversation.deleted_by_user1 === true)
          : (conversation.deleted_by_user2 === 1 || conversation.deleted_by_user2 === true);
        
        if (isTemporarilyDeleted) {
          if (isUser1) {
            await query('UPDATE conversations SET deleted_by_user1 = FALSE WHERE id = ?', [conversation.id]);
    } else {
            await query('UPDATE conversations SET deleted_by_user2 = FALSE WHERE id = ?', [conversation.id]);
          }
          // 重新获取会话信息
          const [updatedConversations] = await query('SELECT * FROM conversations WHERE id = ?', [conversation.id]);
          if (updatedConversations.length > 0) {
            conversation = updatedConversations[0];
          }
        }
      }
    }
    
    if (!conversation) {
      // 创建新会话
      try {
        const insertSql = item_id
          ? 'INSERT INTO conversations (item_id, user1_id, user2_id) VALUES (?, ?, ?)'
          : 'INSERT INTO conversations (errand_id, user1_id, user2_id) VALUES (?, ?, ?)';
        const [result] = await query(insertSql, [relatedId, user1Id, user2Id]);
        
        const [newConversations] = await query('SELECT * FROM conversations WHERE id = ?', [result.insertId]);
        if (newConversations.length === 0) {
          throw new Error('创建会话后无法找到会话记录');
        }
        conversation = newConversations[0];
      } catch (insertError) {
        // 如果是唯一键冲突，重新查询会话
        if (insertError.code === 'ER_DUP_ENTRY') {
          const [existingConversations] = await query(sql, params);
          if (existingConversations.length > 0) {
            conversation = existingConversations[0];
          } else {
            throw insertError;
          }
        } else {
          throw insertError;
        }
      }
    }

    // 获取对方用户信息
    const [otherUsers] = await query('SELECT id, username, email FROM users WHERE id = ?', [otherUserId]);
    if (otherUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: '对方用户不存在'
      });
    }
    const otherUser = otherUsers[0];

    // 获取最后一条消息
    const [lastMessages] = await query(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
      [conversation.id]
    );

    res.json({
      success: true,
      conversationId: conversation.id,
      conversation: {
        ...conversation,
        other_user: otherUser,
        last_message: lastMessages[0] || null
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取用户的所有会话列表
const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 检查删除相关字段是否存在
    const dbName = process.env.DB_NAME || 'campus_trading';
    let whereClause = '(c.user1_id = ? OR c.user2_id = ?)';
    const params = [userId, userId];

    try {
      const [deleteFields] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'conversations' AND COLUMN_NAME IN ('deleted_by_user1', 'deleted_by_user2')",
        [dbName]
      );
      
      if (deleteFields.length > 0) {
        whereClause += ` AND NOT (
          (c.user1_id = ? AND COALESCE(c.deleted_by_user1, FALSE) = TRUE) OR
          (c.user2_id = ? AND COALESCE(c.deleted_by_user2, FALSE) = TRUE)
        )`;
        params.push(userId, userId);
      }
    } catch (e) {
      // 忽略字段检查错误，继续执行
    }

    const [conversations] = await query(
      `SELECT c.*,
              CASE 
                WHEN c.user1_id = ? THEN c.user2_id
                ELSE c.user1_id
              END as other_user_id,
              u.username as other_username,
              u.email as other_email,
              (SELECT COUNT(*) FROM messages m 
               WHERE m.conversation_id = c.id 
               AND m.sender_id != ? 
               AND m.is_read = FALSE) as unread_count,
              (SELECT m.content FROM messages m 
               WHERE m.conversation_id = c.id 
               ORDER BY m.created_at DESC LIMIT 1) as last_message_content,
              (SELECT m.created_at FROM messages m 
               WHERE m.conversation_id = c.id 
               ORDER BY m.created_at DESC LIMIT 1) as last_message_time,
              i.title as item_title,
              i.image_url as item_image,
              e.title as errand_title
       FROM conversations c
       LEFT JOIN users u ON (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END) = u.id
       LEFT JOIN items i ON c.item_id = i.id
       LEFT JOIN errands e ON c.errand_id = e.id
       WHERE ${whereClause}
       ORDER BY c.last_message_at DESC, c.created_at DESC`,
      [userId, userId, userId, ...params]
    );

    res.json({
      success: true,
      conversations: conversations
    });

  } catch (error) {
    console.error('获取会话列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取会话的详细信息
const getConversationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 检查删除相关字段是否存在
    const dbName = process.env.DB_NAME || 'campus_trading';
    let whereClause = `c.id = ? AND (c.user1_id = ? OR c.user2_id = ?)`;
    const params = [userId, id, userId, userId];

    try {
      const [deleteFields] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'conversations' AND COLUMN_NAME IN ('deleted_by_user1', 'deleted_by_user2', 'permanently_deleted_by_user1', 'permanently_deleted_by_user2')",
        [dbName]
      );
      
      if (deleteFields.length > 0) {
        const hasDeleted = deleteFields.some(f => f.COLUMN_NAME.includes('deleted_by_user'));
        const hasPermanentlyDeleted = deleteFields.some(f => f.COLUMN_NAME.includes('permanently_deleted_by_user'));
        
        if (hasDeleted) {
          whereClause += ` AND NOT (
            (c.user1_id = ? AND COALESCE(c.deleted_by_user1, FALSE) = TRUE) OR
            (c.user2_id = ? AND COALESCE(c.deleted_by_user2, FALSE) = TRUE)
          )`;
          params.push(userId, userId);
        }
        
        if (hasPermanentlyDeleted) {
          whereClause += ` AND NOT (
            (c.user1_id = ? AND COALESCE(c.permanently_deleted_by_user1, FALSE) = TRUE) OR
            (c.user2_id = ? AND COALESCE(c.permanently_deleted_by_user2, FALSE) = TRUE)
          )`;
          params.push(userId, userId);
        }
      }
    } catch (e) {
      // 忽略字段检查错误，继续执行
    }

    // 获取会话信息
    const [conversations] = await query(
      `SELECT c.*,
              CASE 
                WHEN c.user1_id = ? THEN c.user2_id
                ELSE c.user1_id
              END as other_user_id,
              u.username as other_username,
              u.email as other_email,
              i.title as item_title,
              i.image_url as item_image,
              i.status as item_status,
              e.title as errand_title,
              e.status as errand_status
       FROM conversations c
       LEFT JOIN users u ON (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END) = u.id
       LEFT JOIN items i ON c.item_id = i.id
       LEFT JOIN errands e ON c.errand_id = e.id
       WHERE ${whereClause}`,
      [userId, userId, ...params]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        message: '会话不存在'
      });
    }

    const conversation = conversations[0];

    res.json({
      success: true,
      conversation: conversation
    });

  } catch (error) {
    console.error('获取会话详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取会话的消息列表
const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(Math.min(parseInt(req.query.limit) || 50, 100), 1); // 限制在1-100之间
    const offset = Math.max((page - 1) * limit, 0); // 确保offset >= 0

    // 验证用户是否有权限访问此会话
    const [conversations] = await query(
      'SELECT id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [id, userId, userId]
    );

    if (conversations.length === 0) {
      return res.status(403).json({
        success: false,
        message: '无权访问此会话'
      });
    }

    // 获取消息列表
    let messages = [];
    let total = 0;
    try {
      // 检查 deleted_by_users 字段是否存在
      const dbName = process.env.DB_NAME || 'campus_trading';
      let messageWhereClause = 'm.conversation_id = ?';
      let countWhereClause = 'conversation_id = ?';
      const messageParams = [id];
      const countParams = [id];
      
      try {
        const [deletedFields] = await query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'deleted_by_users'",
          [dbName]
        );
        
        if (deletedFields.length > 0) {
          // 字段存在，添加过滤条件
          messageWhereClause += ` AND (
            m.deleted_by_users IS NULL 
            OR JSON_CONTAINS(m.deleted_by_users, CAST(? AS JSON)) = 0
          )`;
          messageParams.push(JSON.stringify([Number(userId)]));
          
          countWhereClause += ` AND (
            deleted_by_users IS NULL 
            OR JSON_CONTAINS(deleted_by_users, CAST(? AS JSON)) = 0
          )`;
          countParams.push(JSON.stringify([Number(userId)]));
        }
      } catch (e) {
        // 忽略字段检查错误
      }
      
      // 直接获取消息列表
      const [messagesResult] = await query(
        `SELECT 
          m.id,
          m.conversation_id,
          m.sender_id,
          m.content,
          m.image_url,
          m.attachment_url,
          m.attachment_name,
          m.is_read,
          m.created_at,
          u.username as sender_username
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE ${messageWhereClause}
         ORDER BY m.created_at ASC
         LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
        messageParams
      );
      
      // query函数返回 [rows]，所以messagesResult已经是数组
      messages = Array.isArray(messagesResult) ? messagesResult : [];

      // 获取总数
      const [countResult] = await query(
        `SELECT COUNT(*) as total FROM messages 
         WHERE ${countWhereClause}`,
        countParams
      );
      total = countResult[0]?.total || 0;

      // 标记消息为已读（只标记对方发送的消息）
      await query(
        'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE',
        [id, userId]
      );
    } catch (dbError) {
      // 如果表不存在或其他数据库错误，记录详细日志
      // 返回空消息列表，允许用户继续使用
      messages = [];
      total = 0;
    }

    // 消息已经是按时间升序排列的，不需要反转
    res.json({
      success: true,
      messages: messages, // 已经是正确顺序（时间升序）
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 发送消息
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, image_url, attachment_url, attachment_name } = req.body;
    const userId = req.user.userId;

    // 验证参数
    if (!content && !image_url && !attachment_url) {
      return res.status(400).json({
        success: false,
        message: '消息内容、图片或附件至少需要提供一个'
      });
    }

    // 验证用户是否有权限访问此会话
    const [conversations] = await query(
      'SELECT id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [id, userId, userId]
    );

    if (conversations.length === 0) {
      return res.status(403).json({
        success: false,
        message: '无权访问此会话'
      });
    }

    // 插入消息
    const [result] = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, image_url, attachment_url, attachment_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, content || null, image_url || null, attachment_url || null, attachment_name || null]
    );

    // 更新会话的最后消息时间
    await query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
      [id]
    );

    // 获取刚插入的消息
    const [messages] = await query(
      `SELECT m.*, u.username as sender_username
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: messages[0]
    });

  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取未读消息数量
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [result] = await query(
      `SELECT COUNT(*) as unread_count
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE (c.user1_id = ? OR c.user2_id = ?)
       AND m.sender_id != ?
       AND m.is_read = FALSE`,
      [userId, userId, userId]
    );

    const unreadCount = result[0]?.unread_count || 0;

    res.json({
      success: true,
      unread_count: unreadCount
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 标记会话的所有消息为已读
const markConversationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 验证用户是否有权限访问此会话
    const [conversations] = await query(
      'SELECT id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [id, userId, userId]
    );

    if (conversations.length === 0) {
      return res.status(403).json({
        success: false,
        message: '无权访问此会话'
      });
    }

    // 标记消息为已读（只标记对方发送的消息）
    const [updateResult] = await query(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE',
      [id, userId]
    );


    res.json({
      success: true,
      message: '已标记为已读',
      affected_rows: updateResult.affectedRows
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 删除会话（支持两种方式：暂时删除和永久删除）
// query参数: type=temporary（暂时删除，默认）或 permanent（永久删除）
const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const deleteType = req.query.type || 'temporary'; // 'temporary' 或 'permanent'

    // 验证用户是否有权限删除此会话，并获取会话信息
    const [conversations] = await query(
      'SELECT id, user1_id, user2_id, deleted_by_user1, deleted_by_user2, permanently_deleted_by_user1, permanently_deleted_by_user2 FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [id, userId, userId]
    );

    if (conversations.length === 0) {
      return res.status(403).json({
        success: false,
        message: '无权删除此会话'
      });
    }

    const conversation = conversations[0];
    const isUser1 = conversation.user1_id === userId;

    if (deleteType === 'permanent') {
      // 永久删除：标记永久删除，并删除该用户在此会话中的所有消息
      if (isUser1) {
        await query(
          'UPDATE conversations SET permanently_deleted_by_user1 = TRUE, deleted_by_user1 = TRUE WHERE id = ?',
          [id]
        );
      } else {
        await query(
          'UPDATE conversations SET permanently_deleted_by_user2 = TRUE, deleted_by_user2 = TRUE WHERE id = ?',
          [id]
        );
      }

      // 标记该用户在此会话中的所有消息为已删除（使用 JSON 字段）
      // 先获取所有消息
      const [allMessages] = await query(
        'SELECT id, deleted_by_users FROM messages WHERE conversation_id = ?',
      [id]
    );

      // 更新每条消息，将当前用户ID添加到 deleted_by_users JSON 数组中
      for (const msg of allMessages) {
        let deletedByUsers = [];
        if (msg.deleted_by_users) {
          try {
            // 确保解析为数组
            const parsed = JSON.parse(msg.deleted_by_users);
            deletedByUsers = Array.isArray(parsed) ? parsed : [];
            // 确保所有元素都是数字类型
            deletedByUsers = deletedByUsers.map(id => Number(id));
          } catch (e) {
            deletedByUsers = [];
          }
        }
        
        // 确保 userId 是数字类型
        const userIdNum = Number(userId);
        
        // 如果用户ID不在数组中，添加进去
        if (!deletedByUsers.includes(userIdNum)) {
          deletedByUsers.push(userIdNum);
          await query(
            'UPDATE messages SET deleted_by_users = ? WHERE id = ?',
            [JSON.stringify(deletedByUsers), msg.id]
          );
        }
      }


    res.json({
      success: true,
        message: '会话和所有聊天记录已永久删除'
    });
    } else {
      // 暂时删除：只标记删除，新消息来了会恢复
      if (isUser1) {
        await query(
          'UPDATE conversations SET deleted_by_user1 = TRUE WHERE id = ?',
          [id]
        );
      } else {
        await query(
          'UPDATE conversations SET deleted_by_user2 = TRUE WHERE id = ?',
          [id]
        );
      }

      // 检查双方是否都已删除，如果是则真正删除会话和消息
      const [updatedConversations] = await query(
        'SELECT deleted_by_user1, deleted_by_user2, permanently_deleted_by_user1, permanently_deleted_by_user2 FROM conversations WHERE id = ?',
        [id]
      );

      if (updatedConversations.length > 0) {
        const updated = updatedConversations[0];
        const bothDeleted = 
          (updated.deleted_by_user1 === 1 || updated.deleted_by_user1 === true) &&
          (updated.deleted_by_user2 === 1 || updated.deleted_by_user2 === true);
        
        // 只有双方都暂时删除（不是永久删除）时才真正删除会话
        const bothPermanentDeleted = 
          (updated.permanently_deleted_by_user1 === 1 || updated.permanently_deleted_by_user1 === true) &&
          (updated.permanently_deleted_by_user2 === 1 || updated.permanently_deleted_by_user2 === true);

        if (bothDeleted && !bothPermanentDeleted) {
          // 双方都已暂时删除，真正删除会话（由于外键约束，相关的消息也会被删除）
          await query('DELETE FROM conversations WHERE id = ?', [id]);
        } else {
        }
      }

      res.json({
        success: true,
        message: '会话已暂时删除，新消息会重新显示'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getOrCreateConversation,
  getConversations,
  getConversationById,
  getMessages,
  sendMessage,
  getUnreadCount,
  markConversationAsRead,
  deleteConversation
};

